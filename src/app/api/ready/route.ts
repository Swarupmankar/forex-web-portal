import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/env";
import { isTimeout } from "@/lib/server/proxyPolicy";

// Readiness: the backend is configured and answering. The result is shared for a
// few seconds so this unauthenticated endpoint cannot amplify load on the backend.
export const dynamic = "force-dynamic";

const PROBE_TIMEOUT_MS = 3000;
const CACHE_MS = 5000;

type Probe = { status: number; body: { status: "ready" | "not_ready"; reason?: string } };
let last: { at: number; probe: Promise<Probe> } | undefined;

async function probe(): Promise<Probe> {
  const { backend } = serverEnv();
  if (!backend)
    return { status: 503, body: { status: "not_ready", reason: "backend_not_configured" } };
  try {
    const response = await fetch(new URL("v1/users/auth/brokers", backend), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    await response.body?.cancel();
    return response.ok
      ? { status: 200, body: { status: "ready" } }
      : { status: 503, body: { status: "not_ready", reason: `backend_status_${response.status}` } };
  } catch (error) {
    return {
      status: 503,
      body: { status: "not_ready", reason: isTimeout(error) ? "backend_timeout" : "backend_unreachable" },
    };
  }
}

export async function GET() {
  if (!last || Date.now() - last.at > CACHE_MS) last = { at: Date.now(), probe: probe() };
  const { status, body } = await last.probe;
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
