import { readFileSync } from "node:fs";
const definitions = {
  "verification-otp": {
    subject: "Verify your email · Movement Markets",
    required: ["otp"],
  },
  "withdrawal-otp": {
    subject: "Confirm your withdrawal · Movement Markets",
    required: ["otp"],
  },
  "account-approved": {
    subject: "Your account is approved · Movement Markets",
    required: ["email"],
  },
  "demo-account-created": {
    subject: "Your demo trading account is ready · Movement Markets",
    required: [
      "name",
      "tradingAccountId",
      "tradingUsername",
      "brokerName",
      "serverName",
      "amount",
    ],
  },
  "reset-password": {
    subject: "Reset your password · Movement Markets",
    required: ["resetPasswordUrl"],
  },
  "verify-email-link": {
    subject: "Verify your email · Movement Markets",
    required: ["verificationEmailUrl"],
  },
};
export const emailTypes = Object.keys(definitions);
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function safeUrl(value, allowCid = false) {
  if (allowCid && /^cid:[a-zA-Z0-9_.@-]+$/.test(value)) return value;
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password)
    throw new Error(
      "Email links must be absolute HTTPS URLs without embedded credentials.",
    );
  return u.href;
}
// Pass raw values; this renderer performs HTML escaping exactly once.
export function renderEmail(type, values, options = {}) {
  const def = definitions[type];
  if (!def) throw new Error("Unknown email template");
  for (const key of def.required)
    if (
      values[key] === undefined ||
      values[key] === null ||
      String(values[key]).trim() === ""
    )
      throw new Error(`Missing email field: ${key}`);
  const data = {
    ...values,
    logoUrl:
      options.logoUrl ||
      "https://my.movementmarkets.com/brand/movement-gate-email.png",
  };
  for (const key of ["resetPasswordUrl", "verificationEmailUrl"])
    if (data[key] !== undefined) data[key] = safeUrl(String(data[key]));
  data.logoUrl = safeUrl(data.logoUrl, true);
  const replace = (source, html) =>
    source.replace(/\$\{([a-zA-Z]+)\}/g, (_, key) => {
      if (data[key] === undefined)
        throw new Error(`Missing email field: ${key}`);
      return html ? escapeHtml(data[key]) : String(data[key]);
    });
  return {
    subject: def.subject,
    html: replace(
      readFileSync(
        new URL(`./templates/${type}.html`, import.meta.url),
        "utf8",
      ),
      true,
    ),
    text: replace(
      readFileSync(new URL(`./templates/${type}.txt`, import.meta.url), "utf8"),
      false,
    ),
  };
}
