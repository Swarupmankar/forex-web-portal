// Server-only configuration. Static settings (backend, deploy env, version) are
// parsed once per process; the trading mode and halted symbols are re-read on every
// call so the kill switch never depends on a cached or build-time value.
import {
  deployEnv,
  haltedSymbols,
  tradingMode,
  type DeployEnv,
  type EnvLike,
  type TradingMode,
} from "./proxyPolicy";

export interface ServerConfig {
  /** Backend origin, or null when it must not be used (see `problem`). */
  backend: URL | null;
  /** Trading-engine base (origin + routing path, no trailing slash) for order calls, or null. */
  engine: string | null;
  problem: string | null;
  deployEnv: DeployEnv;
  version: string;
  warnings: string[];
}

export interface TradingStatus {
  mode: TradingMode;
  haltedSymbols: string[];
  env: DeployEnv;
  version: string;
  serverTime: number;
}

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export function parseServerEnv(env: EnvLike): ServerConfig {
  const deploy = deployEnv(env);
  const version =
    env.GIT_COMMIT_SHA?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim() || "dev";
  const warnings: string[] = [];
  const declared = env.DEPLOY_ENV?.trim().toLowerCase();
  if (declared && declared !== deploy)
    warnings.push(`Unknown DEPLOY_ENV "${env.DEPLOY_ENV}"; treating it as production.`);
  if (!declared && env.NODE_ENV === "production")
    warnings.push("DEPLOY_ENV is not set; defaulting to development. Set DEPLOY_ENV=production on live deployments.");
  const allowed = list(env.BACKEND_ALLOWED_HOSTS);
  // Returns the parsed URL, or the reason it must not be used.
  const check = (name: string, raw: string | undefined): URL | string => {
    if (!raw?.trim()) return `${name} is not set.`;
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      return `${name} is not a valid URL.`;
    }
    if (url.username || url.password) return `${name} must not contain credentials.`;
    const httpAllowed = deploy === "development" && url.protocol === "http:";
    if (url.protocol !== "https:" && !httpAllowed)
      return `${name} must use https when DEPLOY_ENV is ${deploy}.`;
    if (allowed.length && !allowed.includes(url.hostname.toLowerCase()))
      return `${name} host ${url.hostname} is not listed in BACKEND_ALLOWED_HOSTS.`;
    return url;
  };
  // The engine base keeps its routing path (/broker/<broker>/<server>): the load balancer matches on it.
  let engineUrl = check("NEXT_PUBLIC_ENGINE_URL", env.NEXT_PUBLIC_ENGINE_URL);
  if (typeof engineUrl !== "string" && (engineUrl.search || engineUrl.hash))
    engineUrl = "NEXT_PUBLIC_ENGINE_URL must not contain a query or fragment.";
  if (typeof engineUrl === "string") warnings.push(`${engineUrl} Orders cannot be sent.`);
  const engine =
    typeof engineUrl === "string" ? null : (engineUrl.origin + engineUrl.pathname).replace(/\/+$/, "");
  const config = (backend: URL | null, problem: string | null): ServerConfig => ({
    backend,
    engine,
    problem,
    deployEnv: deploy,
    version,
    warnings,
  });

  const backend = check("BACKEND_URL", env.BACKEND_URL);
  return typeof backend === "string" ? config(null, backend) : config(new URL(backend.origin), null);
}

export function logEvent(level: "info" | "warn" | "error", event: string, message: string) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, message });
  if (level === "info") console.log(line);
  else console.error(line);
}

let cached: ServerConfig | undefined;

export function serverEnv(): ServerConfig {
  if (!cached) {
    cached = parseServerEnv(process.env);
    if (cached.problem) logEvent("error", "config", cached.problem);
    for (const warning of cached.warnings) logEvent("warn", "config", warning);
  }
  return cached;
}

/** Environment for the trading-mode policy, read fresh on every call. */
export function policyEnv(): EnvLike {
  return {
    ...process.env,
    // NEXT_PUBLIC_* is inlined at build time; the literal references give this code
    // the same feed and engine URLs the browser bundle was built with.
    NEXT_PUBLIC_PRICEFEED_URL: process.env.NEXT_PUBLIC_PRICEFEED_URL,
    NEXT_PUBLIC_ENGINE_URL: process.env.NEXT_PUBLIC_ENGINE_URL,
  };
}

export function tradingStatus(now = Date.now()): TradingStatus {
  const env = policyEnv();
  const config = serverEnv();
  return {
    mode: config.backend ? tradingMode(env) : "halted",
    haltedSymbols: haltedSymbols(env),
    env: config.deployEnv,
    version: config.version,
    serverTime: now,
  };
}
