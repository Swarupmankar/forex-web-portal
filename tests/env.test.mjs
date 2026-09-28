import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";

const transpile = (path) =>
  ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const dataUrl = (code) => "data:text/javascript;base64," + Buffer.from(code).toString("base64");
// env.ts imports ./proxyPolicy; point that import at the transpiled module.
const policyUrl = dataUrl(transpile("../src/lib/server/proxyPolicy.ts"));
const envSource = transpile("../src/lib/server/env.ts").replace(/(["'])\.\/proxyPolicy\1/, JSON.stringify(policyUrl));
const { parseServerEnv } = await import(dataUrl(envSource));

test("BACKEND_URL is required and reduced to its origin", () => {
  const missing = parseServerEnv({});
  assert.equal(missing.backend, null);
  assert.match(missing.problem, /not set/);
  const ok = parseServerEnv({ BACKEND_URL: "https://api.example.com/some/path?x=1" });
  assert.equal(ok.backend.href, "https://api.example.com/");
  assert.equal(ok.problem, null);
  assert.match(parseServerEnv({ BACKEND_URL: "::nope" }).problem, /valid URL/);
  assert.match(parseServerEnv({ BACKEND_URL: "https://user:pw@api.example.com" }).problem, /credentials/);
});

test("https is required outside development", () => {
  assert.equal(parseServerEnv({ BACKEND_URL: "http://localhost:4000" }).backend.origin, "http://localhost:4000");
  for (const DEPLOY_ENV of ["production", "staging", "prod"])
    assert.match(parseServerEnv({ DEPLOY_ENV, BACKEND_URL: "http://api.example.com" }).problem, /https/);
  assert.equal(parseServerEnv({ BACKEND_URL: "ftp://api.example.com" }).backend, null);
  assert.equal(parseServerEnv({ DEPLOY_ENV: "production", BACKEND_URL: "https://api.example.com" }).problem, null);
});

test("BACKEND_ALLOWED_HOSTS restricts the backend host", () => {
  const env = { BACKEND_URL: "https://api.example.com", BACKEND_ALLOWED_HOSTS: "other.example.com, API.example.com" };
  assert.equal(parseServerEnv(env).problem, null);
  assert.match(parseServerEnv({ ...env, BACKEND_ALLOWED_HOSTS: "other.example.com" }).problem, /BACKEND_ALLOWED_HOSTS/);
  assert.equal(parseServerEnv({ ...env, BACKEND_ALLOWED_HOSTS: " , " }).problem, null);
});

test("deploy env, version and configuration warnings", () => {
  assert.equal(parseServerEnv({}).deployEnv, "development");
  assert.equal(parseServerEnv({}).version, "dev");
  assert.equal(parseServerEnv({ VERCEL_GIT_COMMIT_SHA: "abc123" }).version, "abc123");
  assert.equal(parseServerEnv({ GIT_COMMIT_SHA: "def456", VERCEL_GIT_COMMIT_SHA: "abc123" }).version, "def456");
  const typo = parseServerEnv({ DEPLOY_ENV: "prod" });
  assert.equal(typo.deployEnv, "production");
  assert.match(typo.warnings[0], /Unknown DEPLOY_ENV/);
  assert.match(parseServerEnv({ NODE_ENV: "production" }).warnings[0], /DEPLOY_ENV is not set/);
  assert.deepEqual(parseServerEnv({ DEPLOY_ENV: "staging", NODE_ENV: "production" }).warnings, []);
});
