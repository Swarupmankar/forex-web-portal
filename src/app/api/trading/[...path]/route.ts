import { NextRequest, NextResponse } from "next/server";
import { serverEnv, tradingStatus } from "@/lib/server/env";
import {
  MESSAGES,
  RATE_LIMITS,
  RateLimiter,
  classify,
  clientIp,
  failureOutcome,
  forwardedFor,
  gate,
  isJsonContentType,
  isTimeout,
  rateBucket,
  safeSegments,
  sameOrigin,
  validIdempotencyKey,
  validateBody,
  type RouteKind,
} from "@/lib/server/proxyPolicy";

export const dynamic = "force-dynamic";

const BODY_LIMIT = 16 * 1024;
const UPSTREAM_TIMEOUT_MS = 25_000;
const QUERY_KEYS = ["symbol", "interval", "period", "end_date", "brokerId"];
const limiters = {
  login: new RateLimiter(RATE_LIMITS.login, 60_000),
  order: new RateLimiter(RATE_LIMITS.order, 60_000),
  default: new RateLimiter(RATE_LIMITS.default, 60_000),
};

type LogOutcome = "ok" | "rejected" | "not_sent" | "unknown" | "upstream_error";
interface Result {
  status: number;
  /** undefined = empty response body */
  body: unknown;
  outcome: LogOutcome;
  reason?: string;
  headers?: Record<string, string>;
}

const notSent = (
  status: number,
  message: string,
  reason: string,
  headers?: Record<string, string>,
): Result => ({
  status,
  body: { message, outcome: "not_sent" },
  outcome: "not_sent",
  reason,
  headers,
});

const unknownOutcome = (status: number, reason: string): Result => ({
  status,
  body: { message: MESSAGES.unknown, outcome: "unknown" },
  outcome: "unknown",
  reason,
});

/** Reads at most `limit` bytes; null when the body is larger. Throws on invalid UTF-8. */
async function readCapped(request: NextRequest, limit: number) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function run(request: NextRequest, route: string, kind: RouteKind, reqId: string): Promise<Result> {
  const method = request.method;
  if (kind === "denied") return notSent(404, MESSAGES.notFound, "denied");

  const mutation = method !== "GET";
  if (mutation) {
    const origin = sameOrigin(request.headers);
    if (!origin.ok) return notSent(403, origin.message, "origin");
  }

  const limit = limiters[rateBucket(kind)].take(clientIp(request.headers));
  if (!limit.ok)
    return notSent(429, MESSAGES.rateLimited, "rate_limited", {
      "Retry-After": String(limit.retryAfter),
    });

  let body: unknown;
  if (mutation) {
    if (Number(request.headers.get("content-length") ?? 0) > BODY_LIMIT)
      return notSent(413, MESSAGES.tooLarge, "too_large");
    let text: string | null;
    try {
      text = await readCapped(request, BODY_LIMIT);
    } catch {
      return notSent(400, MESSAGES.invalidJson, "unreadable_body");
    }
    if (text === null) return notSent(413, MESSAGES.tooLarge, "too_large");
    if (text) {
      // Catches bodies sent without a Content-Length (chunked) that sameOrigin could not see.
      if (!isJsonContentType(request.headers))
        return notSent(403, MESSAGES.notJson, "content_type");
      try {
        body = JSON.parse(text);
      } catch {
        return notSent(400, MESSAGES.invalidJson, "invalid_json");
      }
    }
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (kind === "order" && idempotencyKey !== null && !validIdempotencyKey(idempotencyKey))
    return notSent(400, MESSAGES.invalidIdempotencyKey, "idempotency_key");

  const valid = validateBody(route, method, body);
  if (!valid.ok) return notSent(422, valid.error, "invalid_body");

  const { backend } = serverEnv();
  if (!backend) return notSent(503, MESSAGES.notConfigured, "not_configured");

  if (kind === "order") {
    const { mode, haltedSymbols } = tradingStatus();
    const allowed = gate(kind, route, valid.body, mode, haltedSymbols);
    if (!allowed.ok) return notSent(allowed.status, allowed.message, `mode_${mode}`);
  }

  const target = new URL("/" + route, backend);
  if (!mutation)
    for (const key of QUERY_KEYS) {
      const value = request.nextUrl.searchParams.get(key);
      if (value !== null) target.searchParams.set(key, value);
    }
  const headers = new Headers({ Accept: "application/json", "X-Request-Id": reqId });
  const auth = request.headers.get("authorization");
  if (auth) headers.set("Authorization", auth);
  const chain = forwardedFor(request.headers);
  if (chain) headers.set("X-Forwarded-For", chain);
  if (kind === "order" && idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  // Forward the validated object, not the raw text.
  const payload = valid.body === undefined ? undefined : JSON.stringify(valid.body);
  if (payload !== undefined) headers.set("Content-Type", "application/json");

  let response: Response;
  let text: string;
  try {
    response = await fetch(target, {
      method,
      headers,
      body: payload,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = isTimeout(error) ? "timeout" : "network";
    if (kind !== "order")
      return { status: 502, body: { message: MESSAGES.unavailable }, outcome: "upstream_error", reason };
    // Never invite a blind retry unless the connection provably never opened.
    if (reason === "network" && failureOutcome(error) === "not_sent")
      return notSent(503, MESSAGES.unreachable, "connect_failed");
    return unknownOutcome(504, reason);
  }
  try {
    text = await response.text();
  } catch (error) {
    const reason = isTimeout(error) ? "timeout" : "network";
    return kind === "order"
      ? unknownOutcome(504, reason)
      : { status: 502, body: { message: MESSAGES.unavailable }, outcome: "upstream_error", reason };
  }

  let data: unknown;
  let parsed = true;
  if (text)
    try {
      data = JSON.parse(text);
    } catch {
      parsed = false;
    }
  const upstream = response.status;

  if (kind === "order") {
    // 4xx is a definite rejection; 5xx or an unreadable success may have executed.
    if (upstream >= 400 && upstream < 500) {
      const detail =
        typeof data === "object" && data !== null && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : {};
      const message = typeof detail.message === "string" ? detail.message : MESSAGES.rejected;
      return { status: upstream, body: { ...detail, message, outcome: "rejected" }, outcome: "rejected" };
    }
    if (upstream >= 500) return unknownOutcome(502, `upstream_${upstream}`);
    if (!parsed) return unknownOutcome(502, "non_json");
    return { status: upstream, body: text ? data : undefined, outcome: "ok" };
  }

  if (!parsed)
    return { status: 502, body: { message: MESSAGES.unexpected }, outcome: "upstream_error", reason: "non_json" };
  return {
    status: upstream,
    body: text ? data : undefined,
    outcome: upstream < 400 ? "ok" : upstream < 500 ? "rejected" : "upstream_error",
  };
}

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const started = Date.now();
  const reqId = crypto.randomUUID();
  const { path } = await context.params;
  const route = path.join("/");
  const kind = safeSegments(path) ? classify(request.method, route).kind : "denied";

  let result: Result;
  try {
    result = await run(request, route, kind, reqId);
  } catch {
    // Unexpected failure: for orders we cannot tell whether it was sent.
    result =
      kind === "order"
        ? unknownOutcome(500, "internal")
        : { status: 500, body: { message: MESSAGES.unavailable }, outcome: "upstream_error", reason: "internal" };
  }

  const headers = new Headers({ "Cache-Control": "no-store", "X-Request-Id": reqId, ...result.headers });
  const response =
    result.body === undefined
      ? new NextResponse(null, { status: result.status, headers })
      : NextResponse.json(result.body, { status: result.status, headers });

  // One line per request: path only, never query values, bodies or tokens.
  const line = JSON.stringify({
    ts: new Date(started).toISOString(),
    reqId,
    method: request.method,
    route: route.slice(0, 200),
    kind,
    status: result.status,
    ms: Date.now() - started,
    outcome: result.outcome,
    ...(result.reason ? { reason: result.reason } : {}),
  });
  if (result.status >= 500) console.error(line);
  else console.log(line);
  return response;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
