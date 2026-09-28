// Request policy for the /api/trading proxy: allowlist, body schemas, trading mode,
// origin checks and rate limiting. Server-only and dependency-free (no imports), so
// the tests can transpile and load it directly.

export type RouteKind = "read" | "login" | "order" | "watchlist" | "denied";
export type TradingMode = "enabled" | "close-only" | "halted";
export type DeployEnv = "production" | "staging" | "development";
export type EnvLike = Record<string, string | undefined>;
export interface HeaderReader {
  get(name: string): string | null;
}
export type Validation =
  | { ok: true; body: unknown }
  | { ok: false; error: string };
export type GateResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

export const MESSAGES = {
  notFound: "This terminal endpoint is not available.",
  halted: "Trading is temporarily unavailable. Your account remains accessible.",
  closeOnly:
    "Close-only mode: you can close or reduce positions, but new orders are paused.",
  unknown:
    "We couldn't confirm this request. Check your positions before trying again.",
  notConfigured: "The trading service is not configured.",
  unreachable:
    "The trading service could not be reached. This request was not sent.",
  unavailable:
    "The account service is temporarily unavailable. Please try again.",
  unexpected:
    "The account service returned an unexpected response. Please try again.",
  rejected: "The trading service rejected this request.",
  crossOrigin: "This request must come from the terminal.",
  notJson: "Requests must be sent as JSON.",
  tooLarge: "Request is too large.",
  invalidJson: "The request body is not valid JSON.",
  invalidIdempotencyKey: "The Idempotency-Key header is invalid.",
  rateLimited: "Too many requests. Please wait a moment and try again.",
} as const;

export const READ_PATHS = new Set([
  "v1/users/auth/brokers",
  "v1/users/auth/servers",
  "v1/users/trading/account",
  "v1/users/watchlist/added-stocks",
  "v1/users/watchlist/all-stocks",
  "v1/users/order/orders",
  "v1/users/order/orders-history",
  "v1/chart/historical",
  "users/user-profile",
]);
export const MUTATIONS: Record<string, RegExp> = {
  POST: /^(v1\/users\/trading\/login|v1\/users\/watchlist\/add-stock|v1\/users\/order\/(place-order|exit-order))$/,
  PATCH: /^v1\/users\/watchlist\/add-favorite$/,
  DELETE: /^v1\/users\/watchlist\/delete-stock\/\d+$/,
  PUT: /^v1\/users\/order\/modify\/\d+$/,
};

const PLACE_ORDER = "v1/users/order/place-order";
const EXIT_ORDER = "v1/users/order/exit-order";
const MODIFY_PREFIX = "v1/users/order/modify/";
const LOGIN = "v1/users/trading/login";
const SEGMENT = /^[A-Za-z0-9._-]+$/;
const ORDER_SYMBOL = /^[A-Z0-9._]{3,20}$/;
const WATCH_SYMBOL = /^[\x21-\x7e]{3,20}$/;

/** Every segment is plain ASCII, non-empty and not a dot-only (traversal) segment. */
export function safeSegments(segments: readonly string[]): boolean {
  return (
    segments.length > 0 &&
    segments.every((s) => SEGMENT.test(s) && !/^\.+$/.test(s))
  );
}

export function classify(method: string, route: string): { kind: RouteKind } {
  if (route.length > 200 || !safeSegments(route.split("/")))
    return { kind: "denied" };
  if (method === "GET")
    return { kind: READ_PATHS.has(route) ? "read" : "denied" };
  if (!Object.hasOwn(MUTATIONS, method) || !MUTATIONS[method].test(route))
    return { kind: "denied" };
  if (route === LOGIN) return { kind: "login" };
  if (route.startsWith("v1/users/order/")) return { kind: "order" };
  return { kind: "watchlist" };
}

// ---------------------------------------------------------------------------
// Body schemas. Unknown keys are rejected so nothing unvalidated reaches the backend.

type Body = Record<string, unknown>;

const isObject = (v: unknown): v is Body =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const positive = (v: unknown): v is number => finite(v) && v > 0;
// Float-tolerant "multiple of 0.01, at least 0.01" (0.29 * 100 is 28.999999999999996).
const lotStep = (v: unknown): v is number => {
  if (!positive(v)) return false;
  const steps = Math.round(v * 100);
  return steps >= 1 && Math.abs(v * 100 - steps) < 1e-6;
};
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const numericId = (v: unknown) =>
  (typeof v === "number" && Number.isSafeInteger(v) && v > 0) ||
  (typeof v === "string" && /^\d{1,20}$/.test(v) && /[1-9]/.test(v));

function unexpectedKey(body: Body, allowed: readonly string[]) {
  return Object.keys(body).find((key) => !allowed.includes(key));
}

function placeOrder(b: Body, maxLots: number): string | null {
  if (typeof b.symbol !== "string" || !ORDER_SYMBOL.test(b.symbol))
    return "Choose a valid instrument.";
  if (b.orderType !== "BUY" && b.orderType !== "SELL")
    return "Order side must be BUY or SELL.";
  if (!["MARKET", "LIMIT", "STOP"].includes(b.executionType as string))
    return "Order type must be MARKET, LIMIT or STOP.";
  if (!lotStep(b.lotSize) || b.lotSize > maxLots)
    return `Volume must be between 0.01 and ${maxLots} lots, in steps of 0.01.`;
  if (b.executionType === "MARKET") {
    if (b.limitPrice !== undefined)
      return "Market orders cannot include an entry price.";
  } else if (!positive(b.limitPrice))
    return "Limit and stop orders need a positive entry price.";
  if (b.sl !== undefined && !positive(b.sl))
    return "Stop loss must be a positive price.";
  if (b.tp !== undefined && !positive(b.tp))
    return "Take profit must be a positive price.";
  return null;
}

function exitOrder(b: Body): string | null {
  if (!numericId(b.orderId)) return "A valid order ID is required.";
  if (!lotStep(b.exitLotSize))
    return "Close volume must be greater than 0, in steps of 0.01.";
  return null;
}

function modifyOrder(b: Body): string | null {
  if (typeof b.cancelOrder !== "boolean")
    return "cancelOrder must be true or false.";
  if (b.sl !== undefined && !(finite(b.sl) && b.sl >= 0))
    return "Stop loss must be 0 (remove) or a positive price.";
  if (b.tp !== undefined && !(finite(b.tp) && b.tp >= 0))
    return "Take profit must be 0 (remove) or a positive price.";
  return null;
}

function login(b: Body): string | null {
  if (!text(b.tradingUsername, 128)) return "Enter a valid trading account ID.";
  if (
    typeof b.tradingPassword !== "string" ||
    !b.tradingPassword ||
    b.tradingPassword.length > 128
  )
    return "Enter a valid trading password.";
  const ref = (v: unknown) => finite(v) || text(v, 64);
  if (!ref(b.brokerId)) return "Choose a broker.";
  if (!ref(b.serverId)) return "Choose a server.";
  return null;
}

function watchlistSymbol(b: Body): string | null {
  if (typeof b.symbol !== "string" || !WATCH_SYMBOL.test(b.symbol))
    return "Choose a valid instrument.";
  if (
    b.stockId !== undefined &&
    !(typeof b.stockId === "number" && Number.isSafeInteger(b.stockId) && b.stockId >= 0)
  )
    return "stockId must be a whole number.";
  return null;
}

const SCHEMAS: Record<
  string,
  { keys: readonly string[]; check: (b: Body, maxLots: number) => string | null }
> = {
  [PLACE_ORDER]: {
    keys: ["symbol", "orderType", "executionType", "lotSize", "limitPrice", "sl", "tp"],
    check: placeOrder,
  },
  [EXIT_ORDER]: { keys: ["orderId", "exitLotSize"], check: exitOrder },
  modify: { keys: ["cancelOrder", "sl", "tp"], check: modifyOrder },
  [LOGIN]: {
    keys: ["tradingUsername", "tradingPassword", "brokerId", "serverId"],
    check: login,
  },
  "v1/users/watchlist/add-stock": { keys: ["symbol", "stockId"], check: watchlistSymbol },
  "v1/users/watchlist/add-favorite": { keys: ["symbol", "stockId"], check: watchlistSymbol },
};

export function validateBody(
  route: string,
  method: string,
  body: unknown,
  maxLots = 100,
): Validation {
  if (classify(method, route).kind === "denied")
    return { ok: false, error: MESSAGES.notFound };
  const schema = SCHEMAS[route.startsWith(MODIFY_PREFIX) ? "modify" : route];
  // Reads and delete-stock carry everything in the path.
  if (!schema || method === "GET")
    return body === undefined
      ? { ok: true, body }
      : { ok: false, error: "This request does not take a body." };
  if (!isObject(body))
    return { ok: false, error: "The request body must be a JSON object." };
  const extra = unexpectedKey(body, schema.keys);
  if (extra) return { ok: false, error: `Unexpected field: ${extra}.` };
  const error = schema.check(body, maxLots);
  return error ? { ok: false, error } : { ok: true, body };
}

export const validIdempotencyKey = (value: string) =>
  /^[A-Za-z0-9-]{1,128}$/.test(value);

// ---------------------------------------------------------------------------
// Trading mode (runtime kill switch).

const MODES: readonly TradingMode[] = ["enabled", "close-only", "halted"];

/** Unset means development; an unrecognised value fails safe as production. */
export function deployEnv(env: EnvLike): DeployEnv {
  const value = env.DEPLOY_ENV?.trim().toLowerCase();
  if (!value) return "development";
  return value === "production" || value === "staging" || value === "development"
    ? value
    : "production";
}

export function tradingMode(env: EnvLike): TradingMode {
  const requested = env.TRADING_MODE?.trim().toLowerCase() as TradingMode;
  const mode = MODES.includes(requested)
    ? requested
    : env.TRADING_ENABLED === "true"
      ? "enabled"
      : "halted";
  if (deployEnv(env) === "production") {
    const devFeed = env.NEXT_PUBLIC_WS_URL?.includes("mock-ws") ?? false;
    if (devFeed || !isHttpsUrl(env.BACKEND_URL)) return "halted";
  }
  return mode;
}

function isHttpsUrl(value: string | undefined) {
  try {
    return !!value && new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

export function haltedSymbols(env: EnvLike): string[] {
  const symbols = (env.HALTED_SYMBOLS ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => ORDER_SYMBOL.test(s));
  return [...new Set(symbols)];
}

export function gate(
  kind: RouteKind,
  route: string,
  body: unknown,
  mode: TradingMode,
  halted: readonly string[],
): GateResult {
  if (kind !== "order") return { ok: true };
  if (mode !== "enabled" && mode !== "close-only")
    return { ok: false, status: 503, message: MESSAGES.halted };
  if (route !== PLACE_ORDER) return { ok: true }; // exit / cancel / SL-TP edits
  if (mode === "close-only")
    return { ok: false, status: 503, message: MESSAGES.closeOnly };
  const symbol = isObject(body) && typeof body.symbol === "string" ? body.symbol : "";
  if (halted.includes(symbol.toUpperCase()))
    return { ok: false, status: 503, message: `Trading in ${symbol} is paused.` };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Request origin and content type (CSRF defence for mutations).

export function bodyIndicated(headers: HeaderReader): boolean {
  const length = headers.get("content-length");
  if (length !== null) return Number(length) > 0;
  return headers.get("transfer-encoding") !== null;
}

export const isJsonContentType = (headers: HeaderReader) =>
  (headers.get("content-type") ?? "").trim().toLowerCase().startsWith("application/json");

function originMatchesHost(headers: HeaderReader) {
  const origin = headers.get("origin");
  if (!origin || origin === "null") return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  // URL.host omits the default port, so strip it from the header too.
  const defaultPort = url.protocol === "https:" ? ":443" : ":80";
  return [headers.get("host"), headers.get("x-forwarded-host")?.split(",")[0]]
    .map((h) => h?.trim().toLowerCase() ?? "")
    .map((h) => (h.endsWith(defaultPort) ? h.slice(0, -defaultPort.length) : h))
    .some((h) => h !== "" && h === url.host);
}

/**
 * Mutations must come from this origin. Sec-Fetch-Site is set by the browser and
 * cannot be forged by page script, so when present it decides; otherwise the
 * Origin host must match Host / X-Forwarded-Host.
 */
export function sameOrigin(
  headers: HeaderReader,
  hasBody = bodyIndicated(headers),
): { ok: true } | { ok: false; message: string } {
  const site = headers.get("sec-fetch-site");
  const trusted = site ? site === "same-origin" : originMatchesHost(headers);
  if (!trusted) return { ok: false, message: MESSAGES.crossOrigin };
  if (hasBody && !isJsonContentType(headers))
    return { ok: false, message: MESSAGES.notJson };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rate limiting.

/** Requests per client IP per minute. */
export const RATE_LIMITS = { login: 5, order: 60, default: 300 } as const;
export type RateBucket = keyof typeof RATE_LIMITS;
export const rateBucket = (kind: RouteKind): RateBucket =>
  kind === "login" ? "login" : kind === "order" ? "order" : "default";

/**
 * Fixed-window counter per key. State lives in this process only, so each server
 * instance enforces its own limit; a shared store (Redis / edge KV) is needed to
 * enforce a global limit once the app is horizontally scaled.
 */
export class RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {}

  take(
    key: string,
    now = Date.now(),
  ): { ok: true; remaining: number } | { ok: false; retryAfter: number } {
    let entry = this.windows.get(key);
    if (!entry || entry.resetAt <= now) {
      this.windows.delete(key);
      if (this.windows.size >= this.maxKeys) this.prune(now);
      entry = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, entry);
    }
    if (entry.count >= this.limit)
      return { ok: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    entry.count++;
    return { ok: true, remaining: this.limit - entry.count };
  }

  // Bounded memory: drop expired windows, then the oldest if still full.
  private prune(now: number) {
    for (const [key, entry] of this.windows)
      if (entry.resetAt <= now) this.windows.delete(key);
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
  }
}

// ---------------------------------------------------------------------------
// Client address. X-Forwarded-For is only as trustworthy as the proxy in front of
// the app; the platform must overwrite (not append to) client-supplied values.

const ADDRESS = /^[A-Za-z0-9.:%[\]_-]{1,64}$/;

export function clientIp(headers: HeaderReader): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || "unknown";
}

/** X-Forwarded-For chain for the backend, ending with the client address. */
export function forwardedFor(headers: HeaderReader): string | undefined {
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ADDRESS.test(s))
    .slice(-10);
  const ip = clientIp(headers);
  if (ip !== "unknown" && ADDRESS.test(ip) && !chain.includes(ip)) chain.push(ip);
  return chain.length ? chain.join(", ") : undefined;
}

// ---------------------------------------------------------------------------
// Upstream failures. Only failures that prove nothing reached the backend (DNS,
// refused or timed-out TCP connect) are "not_sent"; anything else is "unknown".

const NOT_SENT_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
]);

export function failureOutcome(error: unknown): "not_sent" | "unknown" {
  const cause = (error as { cause?: { code?: unknown; errors?: unknown } } | null)?.cause;
  const code = (e: unknown) => (e as { code?: unknown } | null)?.code;
  const notSent = (e: unknown) => {
    const c = code(e);
    return typeof c === "string" && NOT_SENT_CODES.has(c);
  };
  if (notSent(cause)) return "not_sent";
  // Happy-eyeballs connects report an AggregateError of per-address failures.
  const errors = cause?.errors;
  if (Array.isArray(errors) && errors.length > 0 && errors.every(notSent))
    return "not_sent";
  return "unknown";
}

export const isTimeout = (error: unknown) =>
  (error as { name?: unknown } | null)?.name === "TimeoutError";
