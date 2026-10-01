# Operations runbook

Server-side behavior of the web terminal: configuration, the trading kill switch, probes, logs, limits and targets. Server code lives in `src/lib/server/` and `src/app/api/`.

## Environment

| Variable | Scope | Default | Purpose |
| --- | --- | --- | --- |
| `BACKEND_URL` | server | none (required) | Backend origin. If missing or invalid, every `/api/trading/*` call returns 503 "The trading service is not configured.", trading reports `halted`, and one config error is logged. Must be `https` unless `DEPLOY_ENV=development`. Credentials in the URL are rejected. |
| `BACKEND_ALLOWED_HOSTS` | server | empty (any) | Comma-separated hostnames `BACKEND_URL` may use. Guards against a mistyped or tampered URL. |
| `DEPLOY_ENV` | server | `development` | `production`, `staging` or `development`. An unrecognised value is treated as `production`. **Set `DEPLOY_ENV=production` on live deployments.** A warning is logged if `NODE_ENV=production` and it is unset. |
| `TRADING_MODE` | server, runtime | unset | `enabled`, `close-only` or `halted` (see Kill switch). |
| `HALTED_SYMBOLS` | server, runtime | empty | Comma-separated symbols that cannot receive new orders. |
| `TRADING_ENABLED` | server, legacy | `false` | Used only when `TRADING_MODE` is unset: `true` means `enabled`, anything else means `halted`. |
| `GIT_COMMIT_SHA` | server + build | `VERCEL_GIT_COMMIT_SHA`, then `dev` | Reported as `version`; also used as Next.js `deploymentId`. |
| `NEXT_PUBLIC_WS_URL` | public, build time | none | Market-data feed. Its origin is added to CSP `connect-src`. A URL containing `mock-ws` is the development feed. |
| `NEXT_PUBLIC_CLIENT_PORTAL_URL` | public, build time | `https://my.movementmarkets.com` | The client portal (user panel). Visitors without a session are sent to `<this>/accounts`; links for deposits and account management point here. |
| `NEXT_PUBLIC_TRADING_ENABLED` | public, legacy | `false` | Build-time UI flag, superseded by `GET /api/trading/status`. |

## Deploying on Vercel

`vercel.json` pins the framework (Next.js), `npm ci` and `npm run build`, and gives the trading proxy a 30 s function limit: the proxy waits up to 25 s for the backend, and a platform timeout below that would cut an order off mid-flight and leave its outcome unknown. `package.json` pins Node 22. `.vercelignore` keeps local `.env*` files out of CLI deploys.

**Project settings → Environment Variables** (Production; mirror them with staging values for Preview):

| Variable | Production value |
| --- | --- |
| `BACKEND_URL` | the backend origin, `https`, no path, e.g. `https://aznxt-fx-ts-backend-server-1.onrender.com` |
| `BACKEND_ALLOWED_HOSTS` | that hostname, e.g. `aznxt-fx-ts-backend-server-1.onrender.com` |
| `DEPLOY_ENV` | `production` (`staging` for Preview) |
| `NEXT_PUBLIC_WS_URL` | the production market-data feed (not `mock-ws`, or trading is forced to `halted`) |
| `NEXT_PUBLIC_CLIENT_PORTAL_URL` | the user panel's URL |
| `TRADING_MODE` | `halted` until go-live, then `enabled` |
| `HALTED_SYMBOLS` | empty, or symbols to pause |

`GIT_COMMIT_SHA` is not needed: Vercel provides `VERCEL_GIT_COMMIT_SHA`. `NEXT_PUBLIC_*` values are inlined at build time, so changing one needs a **redeploy**; the server-only values above apply on the next request after Vercel restarts the functions (saving them in the dashboard and redeploying the current build is enough).

**The other two services** must agree with this one:

- User panel (Vercel): `VITE_WEB_TERMINAL_URL` = this deployment's `https` URL (build time, redeploy after changing). Without it the Trade button falls back to the panel's Terminals page.
- Backend: `REDIS_URL` whenever it runs more than one instance, so a sign-in code issued by one instance can be redeemed on another.

**Region:** put the functions next to the backend (Project settings → Functions → Region). Every terminal request is proxied, so a region far from the backend adds that round trip to every order.

**Rate limits** are counted per function instance (see Rate limiting). Vercel runs several instances under load, so the effective limit is higher than the configured one; add Vercel's firewall rate limiting on `/api/trading/v1/users/trading/web-session/redeem` and the order routes for a global limit.

After the first deploy, check `/api/health` (200), `/api/ready` (200 `ready`), and `/api/trading/status` (`env: production` and the expected `mode`).

## Kill switch

`GET /api/trading/status` returns `{mode, haltedSymbols, env, version, serverTime}`. The UI polls it every 30 s and on window focus, and pauses connected-account order entry if it cannot be read. The proxy enforces the same mode on every order request, whatever the UI shows.

| Mode | New orders | Close / partial close | Cancel pending, edit SL/TP |
| --- | --- | --- | --- |
| `enabled` | allowed, except `HALTED_SYMBOLS` | allowed | allowed |
| `close-only` | 503 "Close-only mode: …" | allowed | allowed |
| `halted` | 503 "Trading is temporarily unavailable. …" | 503 | 503 |

Reads, login and watchlist changes stay available in every mode.

**Forced `halted`, regardless of `TRADING_MODE`:**
- `DEPLOY_ENV=production` and the development feed (`NEXT_PUBLIC_WS_URL` contains `mock-ws`).
- `DEPLOY_ENV=production` and `BACKEND_URL` is missing or not `https`.
- `BACKEND_URL` is unusable in any environment (missing, invalid, or not in `BACKEND_ALLOWED_HOSTS`).

**To act:**
- Stop new orders but let clients reduce risk: set `TRADING_MODE=close-only`.
- Stop all execution: set `TRADING_MODE=halted`.
- Pause one instrument: add it to `HALTED_SYMBOLS` (e.g. `BTCUSD,ETHUSD`). Closing positions in it stays possible.

**How fast it applies:** these values are read from the process environment on every request. They are not inlined at build time and not cached, so **no rebuild is needed**. A running process still only sees new values after the host restarts it. On most platforms, saving an environment variable restarts or redeploys the service from the existing build, typically within a minute. Every order request after the restart is enforced. The UI reflects the change within 30 s after that. Confirm with `curl -s https://<host>/api/trading/status`.

## Health and readiness

| Endpoint | Use | Response |
| --- | --- | --- |
| `GET /api/health` | Liveness and load-balancer checks. Never calls the backend. | 200 `{status:"ok", version, uptimeS}` |
| `GET /api/ready` | Deploy gating and monitoring. Checks that `BACKEND_URL` is configured and that `GET /v1/users/auth/brokers` answers within 3 s. The result is cached for 5 s. | 200 `{status:"ready"}` or 503 `{status:"not_ready", reason}` with reason `backend_not_configured`, `backend_timeout`, `backend_unreachable` or `backend_status_<code>` |

Don't use `/api/ready` as a liveness probe. A backend outage would take every instance out of rotation, and clients would lose the terminal's own error messages.

All three endpoints are unauthenticated and `Cache-Control: no-store`.

## Proxy request pipeline

Checks run in this order, and every response carries `X-Request-Id` and `Cache-Control: no-store`:

1. Allowlist and path check: 404.
2. Same origin for mutations (`Sec-Fetch-Site: same-origin`, or `Origin` host = `Host` / `X-Forwarded-Host`), and a JSON `Content-Type` for bodies: 403.
3. Rate limit: 429 with `Retry-After`.
4. Body over 16 KB: 413. Invalid JSON: 400. Invalid `Idempotency-Key` header (max 128 chars of `[A-Za-z0-9-]`): 400.
5. Strict body schema, with no unknown fields: 422.
6. Backend not configured: 503.
7. Trading mode and halted symbols: 503.
8. Forward to the backend with `Authorization`, `X-Forwarded-For`, `X-Request-Id` and `Idempotency-Key` (order routes). The upstream timeout is 25 s and redirects are refused.

Failures on order routes carry `{message, outcome}`:

| outcome | Meaning | Statuses |
| --- | --- | --- |
| `not_sent` | Stopped before reaching the backend. Safe to fix and retry. | 400, 403, 404, 413, 422, 429, 503 |
| `rejected` | The backend answered 4xx. The backend's `message` is preserved. | backend 4xx |
| `unknown` | It may have executed: timeout, connection lost after sending, backend 5xx, or an unreadable response. Check positions before retrying. | 504 (timeout/network), 502 (backend 5xx or unreadable), 500 (proxy fault) |

On order routes, a 503 always means `not_sent`. That includes "could not be reached", which is only reported when the connection provably never opened (DNS failure, refused or timed-out connect). Non-order routes pass backend statuses through, and upstream failures on them return 502.

## Logs

One JSON line per proxied request. Lines go to stdout, or stderr when status ≥ 500:

```json
{"ts":"2026-09-26T10:00:00.000Z","reqId":"…","method":"POST","route":"v1/users/order/place-order","kind":"order","status":504,"ms":25003,"outcome":"unknown","reason":"timeout"}
```

- `kind`: `read | login | order | watchlist | denied`
- `outcome`: `ok | rejected | not_sent | unknown | upstream_error`
- `reason`: the check that stopped the request, or the failure cause (`origin`, `rate_limited`, `invalid_body`, `mode_halted`, `timeout`, …)

Only the path is logged. Query values, bodies, tokens and client IPs are never logged. Configuration problems are logged once per process as `{"level":"error","event":"config",…}`. Search by `reqId`: the browser sees it as `X-Request-Id`, and the backend receives it as `X-Request-Id`.

## Rate limits

Per client IP, per minute, with a fixed window:

| Bucket | Limit |
| --- | --- |
| Trading login | 5 |
| Order routes (place, exit, modify) | 60 |
| Everything else | 300 |

Caveats:
- **Limits are per server instance** (in-memory). With N instances, the effective limit is up to N times higher. A shared store (Redis or edge KV) is needed to enforce a global limit once the app is horizontally scaled.
- The client IP is the first `X-Forwarded-For` entry, falling back to `X-Real-IP`. This is only trustworthy if the platform's proxy overwrites client-supplied `X-Forwarded-For`. Verify this on the chosen host before relying on the login limit.

## Security headers

Set in `next.config.mjs` for every route: `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'` (enforced), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation and payment disabled). In production they also include `Strict-Transport-Security: max-age=63072000; includeSubDomains`. The `x-powered-by` header is removed. `/email-preview/*` allows same-origin framing, because its index frames the templates.

**CSP plan.** A full policy ships as `Content-Security-Policy-Report-Only`:
1. Now: report-only. Violations appear in the browser console on the terminal, the email preview and a connected session with a live feed.
2. Review violations on staging with the production feed URL. Add any legitimate origins, such as a new feed or analytics.
3. Optional: add a `report-to` endpoint to collect reports from real users for a week.
4. Enforce by renaming the header to `Content-Security-Policy`, merged with the existing `frame-ancestors`. Then remove `'unsafe-inline'` from `script-src` when nonces are introduced.

`connect-src` is built at build time from `NEXT_PUBLIC_WS_URL` (http+ws or https+wss). Changing the feed requires a rebuild, just as the client bundle does.

## Service level objectives

| SLI | Target | Source |
| --- | --- | --- |
| Order acknowledgement latency | p99 < 1 s | proxy log `ms`, where `kind=order` and status < 500 |
| Quote age at the client | p95 < 2 s | client quote timestamp vs `serverTime` / receipt time |
| Proxy error rate | 5xx < 0.5% of requests | proxy log `status >= 500` / all lines, over a 30-day window |

Page when order `outcome=unknown` is above zero for 5 minutes or the 5xx rate is above 2% for 10 minutes. Consider `close-only` while the cause is investigated.

## CI

`.github/workflows/ci.yml` runs on every push and pull request with Node 22: `npm ci`, `next typegen`, typecheck, `npm test`, and `npm run build` with safe placeholder environment values. `npm audit --omit=dev --audit-level=high` runs as a separate job, which reports but does not block.
