import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";

const transpile = (path) =>
  ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const {
  classify,
  safeSegments,
  validateBody,
  validIdempotencyKey,
  tradingMode,
  deployEnv,
  haltedSymbols,
  gate,
  sameOrigin,
  RateLimiter,
  RATE_LIMITS,
  rateBucket,
  clientIp,
  forwardedFor,
  failureOutcome,
  isTimeout,
  MESSAGES,
} = await import(
  "data:text/javascript;base64," +
    Buffer.from(transpile("../src/lib/server/proxyPolicy.ts")).toString("base64")
);

const PLACE = "v1/users/order/place-order";
const EXIT = "v1/users/order/exit-order";
const MODIFY = "v1/users/order/modify/42";
const LOGIN = "v1/users/trading/login";
const market = { symbol: "EURUSD", orderType: "BUY", executionType: "MARKET", lotSize: 0.1 };
const place = (body) => validateBody(PLACE, "POST", body);
const rejects = (result, pattern) => {
  assert.equal(result.ok, false);
  if (pattern) assert.match(result.error, pattern);
};

test("allowlist classifies reads, logins, orders and watchlist writes; everything else is denied", () => {
  assert.equal(classify("GET", "v1/users/order/orders").kind, "read");
  assert.equal(classify("GET", "users/user-profile").kind, "read");
  assert.equal(classify("POST", LOGIN).kind, "login");
  assert.equal(classify("POST", PLACE).kind, "order");
  assert.equal(classify("POST", EXIT).kind, "order");
  assert.equal(classify("PUT", MODIFY).kind, "order");
  assert.equal(classify("POST", "v1/users/watchlist/add-stock").kind, "watchlist");
  assert.equal(classify("PATCH", "v1/users/watchlist/add-favorite").kind, "watchlist");
  assert.equal(classify("DELETE", "v1/users/watchlist/delete-stock/7").kind, "watchlist");
  for (const [method, route] of [
    ["POST", "v1/users/order/orders"],
    ["GET", PLACE],
    ["PUT", "v1/users/order/modify/abc"],
    ["DELETE", MODIFY],
    ["POST", "v1/users/trading/create-demo-account"],
    ["HEAD", "v1/users/order/orders"],
    ["constructor", PLACE],
    ["GET", ""],
  ])
    assert.equal(classify(method, route).kind, "denied", `${method} ${route}`);
});

test("path traversal and odd segments are rejected", () => {
  assert.equal(safeSegments(["v1", "users", "order", "orders"]), true);
  for (const segments of [
    [],
    ["v1", "..", "admin"],
    ["v1", ".", "users"],
    ["v1", "", "users"],
    ["v1/users"],
    ["v1", "users%2F.."],
    ["v1", "us ers"],
    ["v1", "ü"],
  ])
    assert.equal(safeSegments(segments), false, JSON.stringify(segments));
  assert.equal(classify("GET", "v1/users/../users/order/orders").kind, "denied");
  assert.equal(classify("GET", "v1//users/order/orders").kind, "denied");
  assert.equal(classify("GET", "v1/users/order/orders/").kind, "denied");
});

test("place-order accepts valid market, limit and stop orders", () => {
  assert.deepEqual(place(market), { ok: true, body: market });
  assert.equal(place({ ...market, sl: 1.05, tp: 1.2 }).ok, true);
  assert.equal(place({ ...market, lotSize: 0.29 }).ok, true);
  assert.equal(place({ ...market, lotSize: 100 }).ok, true);
  assert.equal(place({ ...market, executionType: "LIMIT", limitPrice: 1.08 }).ok, true);
  assert.equal(place({ ...market, orderType: "SELL", executionType: "STOP", limitPrice: 1.07 }).ok, true);
  assert.equal(place({ ...market, symbol: "XAU_USD.X" }).ok, true);
});

test("place-order rejects missing, mistyped and unknown fields", () => {
  for (const key of ["symbol", "orderType", "executionType", "lotSize"]) {
    const body = { ...market };
    delete body[key];
    rejects(place(body));
  }
  rejects(place({ ...market, symbol: "eurusd" }), /instrument/);
  rejects(place({ ...market, symbol: "EU" }), /instrument/);
  rejects(place({ ...market, symbol: "EUR/USD" }), /instrument/);
  rejects(place({ ...market, orderType: "buy" }), /BUY or SELL/);
  rejects(place({ ...market, executionType: "STOP_LIMIT" }), /MARKET, LIMIT or STOP/);
  rejects(place({ ...market, lotSize: "0.1" }), /Volume/);
  rejects(place({ ...market, lotSize: 0 }), /Volume/);
  rejects(place({ ...market, lotSize: -1 }), /Volume/);
  rejects(place({ ...market, lotSize: Infinity }), /Volume/);
  rejects(place({ ...market, sl: 0 }), /Stop loss/);
  rejects(place({ ...market, tp: "1.2" }), /Take profit/);
  rejects(place({ ...market, sl: null }), /Stop loss/);
  rejects(place({ ...market, comment: "hi" }), /Unexpected field: comment/);
  rejects(place(JSON.parse('{"symbol":"EURUSD","orderType":"BUY","executionType":"MARKET","lotSize":0.1,"__proto__":{}}')), /Unexpected field/);
  rejects(place(undefined), /JSON object/);
  rejects(place([market]), /JSON object/);
  rejects(place(null), /JSON object/);
});

test("place-order enforces lot size decimals and the maximum", () => {
  rejects(place({ ...market, lotSize: 0.015 }), /steps of 0.01/);
  rejects(place({ ...market, lotSize: 0.001 }), /steps of 0.01/);
  rejects(place({ ...market, lotSize: 1e-300 }), /steps of 0.01/);
  rejects(place({ ...market, lotSize: 100.01 }), /100 lots/);
  assert.equal(validateBody(PLACE, "POST", { ...market, lotSize: 5 }, 2).ok, false);
  assert.equal(validateBody(PLACE, "POST", { ...market, lotSize: 2 }, 2).ok, true);
});

test("place-order ties limitPrice to the execution type", () => {
  rejects(place({ ...market, limitPrice: 1.1 }), /Market orders cannot include/);
  rejects(place({ ...market, limitPrice: null }), /Market orders cannot include/);
  rejects(place({ ...market, executionType: "LIMIT" }), /entry price/);
  rejects(place({ ...market, executionType: "STOP", limitPrice: 0 }), /entry price/);
  rejects(place({ ...market, executionType: "LIMIT", limitPrice: "1.1" }), /entry price/);
});

test("exit-order schema", () => {
  const exit = (body) => validateBody(EXIT, "POST", body);
  assert.equal(exit({ orderId: 12, exitLotSize: 0.5 }).ok, true);
  assert.equal(exit({ orderId: "12", exitLotSize: 0.07 }).ok, true);
  rejects(exit({ exitLotSize: 0.5 }), /order ID/);
  rejects(exit({ orderId: 0, exitLotSize: 0.5 }), /order ID/);
  rejects(exit({ orderId: 1.5, exitLotSize: 0.5 }), /order ID/);
  rejects(exit({ orderId: "12a", exitLotSize: 0.5 }), /order ID/);
  rejects(exit({ orderId: "000", exitLotSize: 0.5 }), /order ID/);
  rejects(exit({ orderId: 12 }), /Close volume/);
  rejects(exit({ orderId: 12, exitLotSize: 0.123 }), /Close volume/);
  rejects(exit({ orderId: 12, exitLotSize: "1" }), /Close volume/);
  rejects(exit({ orderId: 12, exitLotSize: 1, all: true }), /Unexpected field: all/);
});

test("modify schema: cancelOrder required, 0 removes a level", () => {
  const modify = (body) => validateBody(MODIFY, "PUT", body);
  assert.equal(modify({ cancelOrder: true }).ok, true);
  assert.equal(modify({ cancelOrder: false, sl: 0, tp: 0 }).ok, true);
  assert.equal(modify({ cancelOrder: false, sl: 1.05, tp: 1.2 }).ok, true);
  rejects(modify({}), /cancelOrder/);
  rejects(modify({ cancelOrder: "true" }), /cancelOrder/);
  rejects(modify({ cancelOrder: false, sl: -1 }), /Stop loss/);
  rejects(modify({ cancelOrder: false, tp: NaN }), /Take profit/);
  rejects(modify({ cancelOrder: false, tp: "1.2" }), /Take profit/);
  rejects(modify({ cancelOrder: false, orderId: 42 }), /Unexpected field: orderId/);
});

test("trading login schema", () => {
  const ok = { tradingUsername: "1001", tradingPassword: "secret", brokerId: 1, serverId: "2" };
  const loginBody = (body) => validateBody(LOGIN, "POST", body);
  assert.equal(loginBody(ok).ok, true);
  for (const key of Object.keys(ok)) {
    const body = { ...ok };
    delete body[key];
    rejects(loginBody(body));
  }
  rejects(loginBody({ ...ok, tradingUsername: "   " }), /account ID/);
  rejects(loginBody({ ...ok, tradingUsername: "x".repeat(129) }), /account ID/);
  rejects(loginBody({ ...ok, tradingPassword: "" }), /password/);
  rejects(loginBody({ ...ok, tradingPassword: 1234 }), /password/);
  rejects(loginBody({ ...ok, tradingPassword: "x".repeat(129) }), /password/);
  rejects(loginBody({ ...ok, brokerId: null }), /broker/);
  rejects(loginBody({ ...ok, serverId: true }), /server/);
  rejects(loginBody({ ...ok, remember: true }), /Unexpected field: remember/);
});

test("watchlist schemas, and routes that take no body", () => {
  for (const [route, method] of [
    ["v1/users/watchlist/add-stock", "POST"],
    ["v1/users/watchlist/add-favorite", "PATCH"],
  ]) {
    assert.equal(validateBody(route, method, { symbol: "EURUSD" }).ok, true);
    assert.equal(validateBody(route, method, { symbol: "US30.cash", stockId: 3 }).ok, true);
    rejects(validateBody(route, method, { symbol: "EU" }), /instrument/);
    rejects(validateBody(route, method, { symbol: "x".repeat(21) }), /instrument/);
    rejects(validateBody(route, method, { symbol: 5 }), /instrument/);
    rejects(validateBody(route, method, { symbol: "EURUSD", stockId: "3" }), /stockId/);
    rejects(validateBody(route, method, { symbol: "EURUSD", extra: 1 }), /Unexpected field/);
  }
  assert.equal(validateBody("v1/users/watchlist/delete-stock/7", "DELETE", undefined).ok, true);
  rejects(validateBody("v1/users/watchlist/delete-stock/7", "DELETE", {}), /does not take a body/);
  assert.equal(validateBody("v1/users/order/orders", "GET", undefined).ok, true);
  rejects(validateBody("v1/users/admin", "POST", {}), /not available/);
});

test("idempotency keys are short and URL-safe", () => {
  assert.equal(validIdempotencyKey("8f14e45f-ceea-4e7a-9c1b-2f0e2d8d1a3b"), true);
  assert.equal(validIdempotencyKey("a".repeat(128)), true);
  assert.equal(validIdempotencyKey("a".repeat(129)), false);
  assert.equal(validIdempotencyKey(""), false);
  assert.equal(validIdempotencyKey("abc def"), false);
  assert.equal(validIdempotencyKey("abc_def"), false);
});

test("tradingMode prefers TRADING_MODE and falls back to TRADING_ENABLED", () => {
  assert.equal(tradingMode({}), "halted");
  assert.equal(tradingMode({ TRADING_ENABLED: "true" }), "enabled");
  assert.equal(tradingMode({ TRADING_ENABLED: "false" }), "halted");
  assert.equal(tradingMode({ TRADING_ENABLED: "1" }), "halted");
  assert.equal(tradingMode({ TRADING_MODE: "close-only", TRADING_ENABLED: "false" }), "close-only");
  assert.equal(tradingMode({ TRADING_MODE: " Enabled " }), "enabled");
  assert.equal(tradingMode({ TRADING_MODE: "halted", TRADING_ENABLED: "true" }), "halted");
  assert.equal(tradingMode({ TRADING_MODE: "on", TRADING_ENABLED: "true" }), "enabled");
  assert.equal(tradingMode({ TRADING_MODE: "on" }), "halted");
});

test("tradingMode forces halted in production on the development feed or without an https backend", () => {
  const live = {
    DEPLOY_ENV: "production",
    TRADING_MODE: "enabled",
    BACKEND_URL: "https://api.example.com",
    NEXT_PUBLIC_WS_URL: "https://feed.example.com",
  };
  assert.equal(tradingMode(live), "enabled");
  assert.equal(tradingMode({ ...live, NEXT_PUBLIC_WS_URL: "https://mock-ws-chart.onrender.com" }), "halted");
  assert.equal(tradingMode({ ...live, BACKEND_URL: undefined }), "halted");
  assert.equal(tradingMode({ ...live, BACKEND_URL: "http://api.example.com" }), "halted");
  assert.equal(tradingMode({ ...live, BACKEND_URL: "not a url" }), "halted");
  assert.equal(tradingMode({ ...live, TRADING_MODE: "close-only", NEXT_PUBLIC_WS_URL: "https://mock-ws.x" }), "halted");
  // An unrecognised DEPLOY_ENV is treated as production.
  assert.equal(tradingMode({ ...live, DEPLOY_ENV: "prod", NEXT_PUBLIC_WS_URL: "https://mock-ws.x" }), "halted");
  // Staging and development may use the development feed.
  assert.equal(tradingMode({ ...live, DEPLOY_ENV: "staging", NEXT_PUBLIC_WS_URL: "https://mock-ws.x" }), "enabled");
  assert.equal(tradingMode({ ...live, DEPLOY_ENV: undefined, BACKEND_URL: undefined }), "enabled");
});

test("deployEnv defaults to development and fails safe on unknown values", () => {
  assert.equal(deployEnv({}), "development");
  assert.equal(deployEnv({ DEPLOY_ENV: "" }), "development");
  assert.equal(deployEnv({ DEPLOY_ENV: "Staging" }), "staging");
  assert.equal(deployEnv({ DEPLOY_ENV: "production" }), "production");
  assert.equal(deployEnv({ DEPLOY_ENV: "live" }), "production");
});

test("haltedSymbols parses a comma list", () => {
  assert.deepEqual(haltedSymbols({}), []);
  assert.deepEqual(haltedSymbols({ HALTED_SYMBOLS: " btcusd, ETHUSD,,ETHUSD , bad symbol" }), ["BTCUSD", "ETHUSD"]);
});

test("gate: halted blocks every order route but not reads or watchlist", () => {
  for (const route of [PLACE, EXIT, MODIFY])
    assert.deepEqual(gate("order", route, {}, "halted", []), { ok: false, status: 503, message: MESSAGES.halted });
  assert.deepEqual(gate("read", "v1/users/order/orders", undefined, "halted", []), { ok: true });
  assert.deepEqual(gate("watchlist", "v1/users/watchlist/add-stock", {}, "halted", []), { ok: true });
  assert.deepEqual(gate("login", LOGIN, {}, "halted", []), { ok: true });
  assert.equal(gate("order", PLACE, market, "bogus", []).ok, false);
});

test("gate: close-only allows exits and modifications but blocks new orders", () => {
  assert.deepEqual(gate("order", PLACE, market, "close-only", []), { ok: false, status: 503, message: MESSAGES.closeOnly });
  assert.deepEqual(gate("order", EXIT, { orderId: 1, exitLotSize: 1 }, "close-only", []), { ok: true });
  assert.deepEqual(gate("order", MODIFY, { cancelOrder: true }, "close-only", []), { ok: true });
  assert.deepEqual(gate("order", MODIFY, { cancelOrder: false, sl: 1 }, "close-only", []), { ok: true });
});

test("gate: enabled allows orders except in halted symbols", () => {
  assert.deepEqual(gate("order", PLACE, market, "enabled", []), { ok: true });
  assert.deepEqual(gate("order", PLACE, { ...market, symbol: "BTCUSD" }, "enabled", ["BTCUSD"]), {
    ok: false,
    status: 503,
    message: "Trading in BTCUSD is paused.",
  });
  assert.deepEqual(gate("order", PLACE, market, "enabled", ["BTCUSD"]), { ok: true });
  assert.deepEqual(gate("order", EXIT, { orderId: 1, exitLotSize: 1 }, "enabled", ["EURUSD"]), { ok: true });
});

test("sameOrigin: Sec-Fetch-Site decides when present, else Origin must match Host", () => {
  const h = (init) => new Headers(init);
  const json = { "content-type": "application/json", "content-length": "20" };
  assert.deepEqual(sameOrigin(h({ ...json, "sec-fetch-site": "same-origin" })), { ok: true });
  assert.equal(sameOrigin(h({ ...json, "sec-fetch-site": "cross-site", origin: "https://t.example", host: "t.example" })).ok, false);
  assert.equal(sameOrigin(h({ ...json, "sec-fetch-site": "same-site", origin: "https://a.example", host: "t.example" })).ok, false);
  assert.deepEqual(sameOrigin(h({ ...json, origin: "https://t.example", host: "t.example" })), { ok: true });
  assert.deepEqual(sameOrigin(h({ ...json, origin: "https://t.example", host: "t.example:443" })), { ok: true });
  assert.deepEqual(sameOrigin(h({ ...json, origin: "http://127.0.0.1:9000", host: "127.0.0.1:9000" })), { ok: true });
  assert.deepEqual(sameOrigin(h({ ...json, origin: "https://T.example", host: "internal:3000", "x-forwarded-host": "t.example" })), { ok: true });
  assert.equal(sameOrigin(h({ ...json, origin: "https://evil.example", host: "t.example" })).ok, false);
  assert.equal(sameOrigin(h({ ...json, origin: "https://t.example.evil", host: "t.example" })).ok, false);
  assert.equal(sameOrigin(h({ ...json, origin: "http://127.0.0.1:9001", host: "127.0.0.1:9000" })).ok, false);
  assert.equal(sameOrigin(h({ ...json, origin: "null", host: "t.example" })).ok, false);
  assert.equal(sameOrigin(h({ ...json, host: "t.example" })).ok, false);
  assert.deepEqual(sameOrigin(h({ ...json, host: "t.example" })), { ok: false, message: MESSAGES.crossOrigin });
});

test("sameOrigin: a body must be declared as JSON", () => {
  const h = (init) => new Headers({ "sec-fetch-site": "same-origin", ...init });
  assert.deepEqual(sameOrigin(h({ "content-length": "2", "content-type": "text/plain" })), { ok: false, message: MESSAGES.notJson });
  assert.equal(sameOrigin(h({ "content-length": "2" })).ok, false);
  assert.equal(sameOrigin(h({ "transfer-encoding": "chunked", "content-type": "application/x-www-form-urlencoded" })).ok, false);
  assert.equal(sameOrigin(h({ "content-length": "2", "content-type": "application/json; charset=utf-8" })).ok, true);
  assert.equal(sameOrigin(h({ "content-length": "0" })).ok, true);
  assert.equal(sameOrigin(h({})).ok, true);
  assert.equal(sameOrigin(h({ "content-type": "text/plain" }), true).ok, false);
});

test("rate limiter counts per key within a fixed window and reports retry-after", () => {
  const limiter = new RateLimiter(2, 60_000);
  assert.deepEqual(limiter.take("a", 0), { ok: true, remaining: 1 });
  assert.deepEqual(limiter.take("a", 1_000), { ok: true, remaining: 0 });
  assert.deepEqual(limiter.take("a", 1_500), { ok: false, retryAfter: 59 });
  assert.deepEqual(limiter.take("a", 59_999), { ok: false, retryAfter: 1 });
  assert.equal(limiter.take("b", 2_000).ok, true);
  assert.deepEqual(limiter.take("a", 60_000), { ok: true, remaining: 1 });
});

test("rate limiter memory stays bounded", () => {
  const limiter = new RateLimiter(1, 60_000, 3);
  for (const key of ["a", "b", "c", "d"]) assert.equal(limiter.take(key, 0).ok, true);
  assert.equal(limiter.take("d", 1).ok, false);
  assert.equal(limiter.take("a", 1).ok, true); // oldest window was evicted
});

test("rate limit buckets per route kind", () => {
  assert.deepEqual(RATE_LIMITS, { login: 5, order: 60, default: 300 });
  assert.equal(rateBucket("login"), "login");
  assert.equal(rateBucket("order"), "order");
  assert.equal(rateBucket("read"), "default");
  assert.equal(rateBucket("watchlist"), "default");
});

test("clientIp and forwardedFor", () => {
  const h = (init) => new Headers(init);
  assert.equal(clientIp(h({ "x-forwarded-for": " 203.0.113.9 , 10.0.0.1" })), "203.0.113.9");
  assert.equal(clientIp(h({ "x-real-ip": "198.51.100.4" })), "198.51.100.4");
  assert.equal(clientIp(h({ "x-forwarded-for": "", "x-real-ip": "198.51.100.4" })), "198.51.100.4");
  assert.equal(clientIp(h({ "x-forwarded-for": "2001:db8::1" })), "2001:db8::1");
  assert.equal(clientIp(h({})), "unknown");
  assert.equal(forwardedFor(h({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9, 10.0.0.1");
  assert.equal(forwardedFor(h({ "x-real-ip": "198.51.100.4" })), "198.51.100.4");
  assert.equal(forwardedFor(h({ "x-forwarded-for": "203.0.113.9, <script>" })), "203.0.113.9");
  assert.equal(forwardedFor(h({})), undefined);
});

test("upstream failures are not_sent only when the connection provably never opened", () => {
  const fetchFailed = (cause) => Object.assign(new TypeError("fetch failed"), { cause });
  assert.equal(failureOutcome(fetchFailed({ code: "ECONNREFUSED" })), "not_sent");
  assert.equal(failureOutcome(fetchFailed({ code: "ENOTFOUND" })), "not_sent");
  assert.equal(failureOutcome(fetchFailed({ code: "UND_ERR_CONNECT_TIMEOUT" })), "not_sent");
  assert.equal(
    failureOutcome(fetchFailed({ errors: [{ code: "ECONNREFUSED" }, { code: "ECONNREFUSED" }] })),
    "not_sent",
  );
  assert.equal(failureOutcome(fetchFailed({ errors: [{ code: "ECONNREFUSED" }, { code: "ECONNRESET" }] })), "unknown");
  assert.equal(failureOutcome(fetchFailed({ code: "ECONNRESET" })), "unknown");
  assert.equal(failureOutcome(fetchFailed({ code: "UND_ERR_SOCKET" })), "unknown");
  assert.equal(failureOutcome(new TypeError("fetch failed")), "unknown");
  assert.equal(failureOutcome(null), "unknown");
  const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
  assert.equal(isTimeout(timeout), true);
  assert.equal(failureOutcome(timeout), "unknown");
  assert.equal(isTimeout(new Error("x")), false);
});

test("user-facing messages never invite a blind retry for unconfirmed orders", () => {
  assert.equal(MESSAGES.unknown, "We couldn't confirm this request. Check your positions before trying again.");
  assert.equal(MESSAGES.halted, "Trading is temporarily unavailable. Your account remains accessible.");
  assert.equal(MESSAGES.closeOnly, "Close-only mode: you can close or reduce positions, but new orders are paused.");
});
