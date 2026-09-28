// Exercises the real route handlers with a mocked upstream fetch. Each load() gets
// fresh module instances, so rate-limit windows and the cached env never leak between tests.
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const nextServerPath = require.resolve("next/server");

const transpile = (path) =>
  ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const dataUrl = (code) => "data:text/javascript;base64," + Buffer.from(code).toString("base64");
const replaceImport = (code, from, to) =>
  code.replace(new RegExp(`(["'])${from.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\1`, "g"), JSON.stringify(to));

const nextServerShim = dataUrl(
  `import { createRequire } from "node:module";
   const require = createRequire(${JSON.stringify(nextServerPath)});
   export const { NextRequest, NextResponse } = require(${JSON.stringify(nextServerPath)});`,
);

let loads = 0;
async function load() {
  const nonce = `\n// load ${++loads}`;
  const policy = dataUrl(transpile("../src/lib/server/proxyPolicy.ts") + nonce);
  const env = dataUrl(replaceImport(transpile("../src/lib/server/env.ts"), "./proxyPolicy", policy) + nonce);
  const route = (path) => {
    let code = transpile(path);
    code = replaceImport(code, "next/server", nextServerShim);
    code = replaceImport(code, "@/lib/server/env", env);
    code = replaceImport(code, "@/lib/server/proxyPolicy", policy);
    return import(dataUrl(code + nonce));
  };
  return {
    proxy: await route("../src/app/api/trading/[...path]/route.ts"),
    status: await route("../src/app/api/trading/status/route.ts"),
    health: await route("../src/app/api/health/route.ts"),
    ready: await route("../src/app/api/ready/route.ts"),
  };
}

const ORIGIN = "https://terminal.example";
const BASE_ENV = {
  BACKEND_URL: "https://api.example.com",
  DEPLOY_ENV: "staging",
  TRADING_MODE: "enabled",
  HALTED_SYMBOLS: "",
  GIT_COMMIT_SHA: "abc123",
  NEXT_PUBLIC_WS_URL: "https://feed.example.com",
};
const MANAGED = [...Object.keys(BASE_ENV), "TRADING_ENABLED", "VERCEL_GIT_COMMIT_SHA", "BACKEND_ALLOWED_HOSTS"];
function setEnv(overrides = {}) {
  for (const key of MANAGED) delete process.env[key];
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides }))
    if (value !== undefined) process.env[key] = value;
}

let calls = [];
let upstream = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
let logs = [];
const realFetch = globalThis.fetch;
const realLog = console.log;
const realError = console.error;
test.beforeEach(() => {
  setEnv();
  calls = [];
  logs = [];
  upstream = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return upstream(url, init);
  };
  console.log = (line) => logs.push({ level: "log", line });
  console.error = (line) => logs.push({ level: "error", line });
});
test.afterEach(() => {
  globalThis.fetch = realFetch;
  console.log = realLog;
  console.error = realError;
});

let ipCounter = 0;
function request(method, path, { body, headers = {}, query = "" } = {}) {
  const text = body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
  const init = {
    method,
    headers: {
      host: "terminal.example",
      "x-forwarded-for": `203.0.113.${++ipCounter % 250}`,
      ...(method === "GET" ? {} : { origin: ORIGIN }),
      ...(text === undefined ? {} : { "content-type": "application/json", "content-length": String(Buffer.byteLength(text)) }),
      ...headers,
    },
    body: text,
  };
  if (text !== undefined) init.duplex = "half";
  return new NextRequest(`${ORIGIN}/api/trading/${path}${query}`, init);
}
const call = (mod, req, path) => mod[req.method](req, { params: Promise.resolve({ path: path.split("/") }) });
async function send(mod, method, path, options) {
  const res = await call(mod, request(method, path, options), path);
  const text = await res.text();
  return { res, status: res.status, body: text ? JSON.parse(text) : undefined };
}

const PLACE = "v1/users/order/place-order";
const EXIT = "v1/users/order/exit-order";
const order = { symbol: "EURUSD", orderType: "BUY", executionType: "MARKET", lotSize: 0.1 };

test("denied routes are 404 with request id and no-store, and never reach the backend", async () => {
  const { proxy } = await load();
  for (const path of ["v1/admin/users", "v1/users/../users/order/orders", "v1/users/trading/create-demo-account"]) {
    const { res, status, body } = await send(proxy, "GET", path);
    assert.equal(status, 404, path);
    assert.equal(body.outcome, "not_sent");
    assert.match(res.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
    assert.equal(res.headers.get("cache-control"), "no-store");
  }
  const traversal = await call(proxy, request("GET", "x"), "v1/users/%2E%2E/order/orders".replace("%2E%2E", ".."));
  assert.equal(traversal.status, 404);
  assert.equal(calls.length, 0);
});

test("reads forward only allowlisted query keys and pass the backend response through", async () => {
  const { proxy } = await load();
  upstream = async () => new Response(JSON.stringify({ data: { quotes: [] } }), { status: 200 });
  const { res, status, body } = await send(proxy, "GET", "v1/chart/historical", {
    query: "?symbol=EURUSD&interval=minute&period=15&token=secret",
    headers: { authorization: "Bearer t0k" },
  });
  assert.equal(status, 200);
  assert.deepEqual(body, { data: { quotes: [] } });
  const [{ url, init }] = calls;
  assert.equal(url, "https://api.example.com/v1/chart/historical?symbol=EURUSD&interval=minute&period=15");
  assert.equal(init.headers.get("authorization"), "Bearer t0k");
  assert.equal(init.headers.get("x-request-id"), res.headers.get("x-request-id"));
  assert.equal(init.redirect, "error");
});

test("mutations from another origin are 403", async () => {
  const { proxy } = await load();
  const evil = await send(proxy, "POST", PLACE, { body: order, headers: { origin: "https://evil.example" } });
  assert.equal(evil.status, 403);
  assert.equal(evil.body.outcome, "not_sent");
  const crossSite = await send(proxy, "POST", PLACE, { body: order, headers: { "sec-fetch-site": "cross-site" } });
  assert.equal(crossSite.status, 403);
  const form = await send(proxy, "POST", PLACE, { body: "a=1", headers: { "content-type": "application/x-www-form-urlencoded" } });
  assert.equal(form.status, 403);
  const chunked = await send(proxy, "POST", PLACE, { body: order, headers: { "content-type": "text/plain", "content-length": "" } });
  assert.equal(chunked.status, 403);
  assert.equal(calls.length, 0);
});

test("login is limited to 5 per minute per IP with Retry-After", async () => {
  const { proxy } = await load();
  const login = { tradingUsername: "1001", tradingPassword: "pw", brokerId: 1, serverId: 1 };
  const statuses = [];
  let last;
  for (let i = 0; i < 6; i++) {
    last = await send(proxy, "POST", "v1/users/trading/login", { body: login, headers: { "x-forwarded-for": "198.51.100.7" } });
    statuses.push(last.status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
  assert.equal(last.body.outcome, "not_sent");
  assert.ok(Number(last.res.headers.get("retry-after")) >= 1);
  const other = await send(proxy, "POST", "v1/users/trading/login", { body: login, headers: { "x-forwarded-for": "198.51.100.8" } });
  assert.equal(other.status, 200);
});

test("oversized bodies are 413, invalid JSON is 400 and schema errors are 422", async () => {
  const { proxy } = await load();
  const declared = await send(proxy, "POST", PLACE, { body: order, headers: { "content-length": "20000" } });
  assert.equal(declared.status, 413);
  const big = { ...order, pad: "x".repeat(17000) };
  const undeclared = await send(proxy, "POST", PLACE, { body: big, headers: { "content-length": "" } });
  assert.equal(undeclared.status, 413);
  const invalid = await send(proxy, "POST", PLACE, { body: "{not json" });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.outcome, "not_sent");
  const schema = await send(proxy, "POST", PLACE, { body: { ...order, limitPrice: 1.1 } });
  assert.equal(schema.status, 422);
  assert.equal(schema.body.message, "Market orders cannot include an entry price.");
  assert.equal(schema.body.outcome, "not_sent");
  const key = await send(proxy, "POST", PLACE, { body: order, headers: { "idempotency-key": "bad key!" } });
  assert.equal(key.status, 400);
  assert.equal(calls.length, 0);
});

test("halted mode blocks orders but keeps reads available", async () => {
  const { proxy } = await load();
  setEnv({ TRADING_MODE: "halted" });
  for (const [method, path, body] of [
    ["POST", PLACE, order],
    ["POST", EXIT, { orderId: 1, exitLotSize: 0.1 }],
    ["PUT", "v1/users/order/modify/9", { cancelOrder: true }],
  ]) {
    const r = await send(proxy, method, path, { body });
    assert.equal(r.status, 503);
    assert.deepEqual(r.body, { message: "Trading is temporarily unavailable. Your account remains accessible.", outcome: "not_sent" });
  }
  assert.equal(calls.length, 0);
  assert.equal((await send(proxy, "GET", "v1/users/order/orders")).status, 200);
});

test("the kill switch applies on the next request without reloading", async () => {
  const { proxy, status } = await load();
  assert.equal((await send(proxy, "POST", PLACE, { body: order })).status, 200);
  setEnv({ TRADING_MODE: "close-only", HALTED_SYMBOLS: "btcusd" });
  const blocked = await send(proxy, "POST", PLACE, { body: order });
  assert.equal(blocked.status, 503);
  assert.match(blocked.body.message, /^Close-only mode/);
  assert.equal((await send(proxy, "POST", EXIT, { body: { orderId: "5", exitLotSize: 0.05 } })).status, 200);
  assert.equal((await send(proxy, "PUT", "v1/users/order/modify/5", { body: { cancelOrder: false, sl: 0, tp: 1.2 } })).status, 200);
  const res = await status.GET();
  const json = await res.json();
  assert.equal(json.mode, "close-only");
  assert.deepEqual(json.haltedSymbols, ["BTCUSD"]);
  setEnv({ HALTED_SYMBOLS: "BTCUSD" });
  const symbol = await send(proxy, "POST", PLACE, { body: { ...order, symbol: "BTCUSD" } });
  assert.equal(symbol.status, 503);
  assert.equal(symbol.body.message, "Trading in BTCUSD is paused.");
});

test("orders forward the validated body, auth, request id, client IP and idempotency key", async () => {
  const { proxy } = await load();
  upstream = async () => new Response(JSON.stringify({ orderId: 77 }), { status: 201 });
  const { res, status, body } = await send(proxy, "POST", PLACE, {
    body: order,
    headers: { authorization: "Bearer t0k", "idempotency-key": "k-123", "x-forwarded-for": "192.0.2.1, 10.0.0.2" },
  });
  assert.equal(status, 201);
  assert.deepEqual(body, { orderId: 77 });
  const [{ url, init }] = calls;
  assert.equal(url, "https://api.example.com/v1/users/order/place-order");
  assert.equal(init.method, "POST");
  assert.deepEqual(JSON.parse(init.body), order);
  assert.equal(init.headers.get("authorization"), "Bearer t0k");
  assert.equal(init.headers.get("content-type"), "application/json");
  assert.equal(init.headers.get("idempotency-key"), "k-123");
  assert.equal(init.headers.get("x-forwarded-for"), "192.0.2.1, 10.0.0.2");
  assert.equal(init.headers.get("x-request-id"), res.headers.get("x-request-id"));
});

test("order timeouts and post-send network errors are 504 'unknown'; reads keep 502", async () => {
  const { proxy } = await load();
  upstream = async () => {
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  };
  const timeout = await send(proxy, "POST", PLACE, { body: order });
  assert.equal(timeout.status, 504);
  assert.deepEqual(timeout.body, { message: "We couldn't confirm this request. Check your positions before trying again.", outcome: "unknown" });
  upstream = async () => {
    throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
  };
  assert.equal((await send(proxy, "POST", EXIT, { body: { orderId: 1, exitLotSize: 1 } })).body.outcome, "unknown");
  const read = await send(proxy, "GET", "v1/users/order/orders");
  assert.equal(read.status, 502);
  assert.equal(read.body.message, "The account service is temporarily unavailable. Please try again.");
});

test("an order whose connection was refused is 503 'not_sent'", async () => {
  const { proxy } = await load();
  upstream = async () => {
    throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
  };
  const r = await send(proxy, "POST", PLACE, { body: order });
  assert.equal(r.status, 503);
  assert.equal(r.body.outcome, "not_sent");
});

test("backend order responses: 4xx is 'rejected', 5xx and unreadable success are 'unknown'", async () => {
  const { proxy } = await load();
  upstream = async () => new Response(JSON.stringify({ message: "Insufficient margin" }), { status: 400 });
  const rejected = await send(proxy, "POST", PLACE, { body: order });
  assert.equal(rejected.status, 400);
  assert.deepEqual(rejected.body, { message: "Insufficient margin", outcome: "rejected" });
  upstream = async () => new Response("<html>bad gateway</html>", { status: 500 });
  const failed = await send(proxy, "POST", PLACE, { body: order });
  assert.equal(failed.status, 502);
  assert.equal(failed.body.outcome, "unknown");
  upstream = async () => new Response("OK", { status: 200 });
  const unreadable = await send(proxy, "POST", PLACE, { body: order });
  assert.equal(unreadable.status, 502);
  assert.equal(unreadable.body.outcome, "unknown");
  upstream = async () => new Response(null, { status: 204 });
  const empty = await call(proxy, request("DELETE", "v1/users/watchlist/delete-stock/3"), "v1/users/watchlist/delete-stock/3");
  assert.equal(empty.status, 204);
});

test("a missing BACKEND_URL is 503 'not configured', halts trading and is logged once", async () => {
  setEnv({ BACKEND_URL: undefined });
  const { proxy, status, ready } = await load();
  const first = await send(proxy, "GET", "v1/users/order/orders");
  assert.equal(first.status, 503);
  assert.deepEqual(first.body, { message: "The trading service is not configured.", outcome: "not_sent" });
  await send(proxy, "GET", "v1/users/order/orders");
  const configLines = logs.filter((l) => l.line.includes('"event":"config"'));
  assert.equal(configLines.length, 1);
  assert.equal((await (await status.GET()).json()).mode, "halted");
  const r = await ready.GET();
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { status: "not_ready", reason: "backend_not_configured" });
  assert.equal(calls.length, 0);
});

test("one structured log line per request, without query values, bodies or tokens", async () => {
  const { proxy } = await load();
  // Secrets use letters outside the hex alphabet so they cannot collide with a request id.
  await send(proxy, "GET", "v1/users/auth/servers", { query: "?brokerId=zz-broker", headers: { authorization: "Bearer s3cret-token" } });
  await send(proxy, "POST", "v1/users/trading/login", { body: { tradingUsername: "user-zz", tradingPassword: "hunter2-pw", brokerId: 1, serverId: 1 } });
  const lines = logs.filter((l) => l.line.includes('"reqId"')).map((l) => JSON.parse(l.line));
  assert.equal(lines.length, 2);
  assert.deepEqual(Object.keys(lines[0]).sort(), ["kind", "method", "ms", "outcome", "reqId", "route", "status", "ts"]);
  assert.equal(lines[0].route, "v1/users/auth/servers");
  assert.equal(lines[1].kind, "login");
  const all = logs.map((l) => l.line).join("\n");
  for (const secret of ["zz-broker", "s3cret", "hunter2", "user-zz"]) assert.ok(!all.includes(secret), secret);
});

test("status, health and ready endpoints", async () => {
  const { status, health, ready } = await load();
  const s = await status.GET();
  assert.equal(s.headers.get("cache-control"), "no-store");
  const json = await s.json();
  assert.deepEqual(Object.keys(json).sort(), ["env", "haltedSymbols", "mode", "serverTime", "version"]);
  assert.equal(json.mode, "enabled");
  assert.equal(json.env, "staging");
  assert.equal(json.version, "abc123");
  assert.ok(Math.abs(json.serverTime - Date.now()) < 5000);

  const h = await health.GET();
  const hj = await h.json();
  assert.equal(hj.status, "ok");
  assert.equal(hj.version, "abc123");
  assert.equal(typeof hj.uptimeS, "number");

  const r = await ready.GET();
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { status: "ready" });
  assert.equal(calls[0].url, "https://api.example.com/v1/users/auth/brokers");
  await ready.GET();
  assert.equal(calls.length, 1, "probe result is cached briefly");
});

test("ready reports an unhealthy backend", async () => {
  const { ready } = await load();
  upstream = async () => new Response("down", { status: 502 });
  const r = await ready.GET();
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { status: "not_ready", reason: "backend_status_502" });
});

test("production on the development feed reports halted", async () => {
  setEnv({ DEPLOY_ENV: "production", NEXT_PUBLIC_WS_URL: "https://mock-ws-chart.onrender.com" });
  const { status, proxy } = await load();
  assert.equal((await (await status.GET()).json()).mode, "halted");
  assert.equal((await send(proxy, "POST", PLACE, { body: order })).status, 503);
});
