import test from "node:test";
import assert from "node:assert/strict";
import { renderEmail, emailTypes } from "../emails/render.mjs";
const values = {
  otp: "482916",
  email: "a@example.com",
  name: "<script>alert(1)</script>",
  tradingAccountId: "1001",
  tradingUsername: "1001",
  brokerName: "Movement Markets",
  serverName: "Demo",
  amount: "10,000 USD",
  resetPasswordUrl: "https://my.movementmarkets.com/reset?token=a&mode=b",
  verificationEmailUrl: "https://my.movementmarkets.com/verify?token=sample",
};
test("all six templates produce complete branded HTML and plain text without missing placeholders", () => {
  for (const type of emailTypes) {
    const r = renderEmail(type, values, { logoUrl: "cid:movement-gate" });
    assert.match(r.html, /<!doctype html>/i);
    assert.match(r.html, /Movement/);
    assert.doesNotMatch(r.html, /\$\{/);
    assert.ok(r.text.length > 60);
    assert.ok(r.subject.length > 10);
  }
});
test("untrusted values are escaped and approval never includes a password", () => {
  assert.match(
    renderEmail("demo-account-created", values).html,
    /&lt;script&gt;/,
  );
  assert.doesNotMatch(
    renderEmail("demo-account-created", values).html,
    /<script>/,
  );
  assert.doesNotMatch(
    renderEmail("account-approved", { ...values, password: "DoNotExpose" })
      .html,
    /DoNotExpose/,
  );
});
test("reject unsafe action URLs and absent required fields", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://user:password@example.com",
  ])
    assert.throws(() =>
      renderEmail("reset-password", { ...values, resetPasswordUrl: url }),
    );
  assert.throws(() => renderEmail("verification-otp", {}));
  assert.throws(() => renderEmail("../render", values));
});
