import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { renderEmail, emailTypes } from "../emails/render.mjs";
const root = new URL("../", import.meta.url);
const P = {
  otp: "${otp}",
  email: "${email}",
  name: "${name}",
  tradingAccountId: "${tradingAccountId}",
  tradingUsername: "${tradingUsername}",
  brokerName: "${brokerName}",
  serverName: "${serverName}",
  amount: "${amount}",
  resetPasswordUrl: "${resetPasswordUrl}",
  verificationEmailUrl: "${verificationEmailUrl}",
};
const bodyText =
  "font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#58616b;";
const p = (text) => `<p style="margin:0 0 20px;${bodyText}">${text}</p>`;
const action = (label, url) =>
  `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 8px;"><tr><td bgcolor="#b0f000" style="border-radius:30px;mso-padding-alt:14px 26px;"><a href="${url}" style="display:inline-block;padding:14px 26px;border:1px solid #b0f000;border-radius:30px;font:600 14px Arial,Helvetica,sans-serif;color:#111800;text-decoration:none;">${label} &nbsp; &#8594;</a></td></tr></table>`;
const note = (text) =>
  `<p style="margin:26px 0 0;padding-top:23px;border-top:1px solid #e7e9ec;font:12px/1.7 Arial,Helvetica,sans-serif;color:#69727b;">${text}</p>`;
const code = () =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td bgcolor="#f4f6f8" align="center" style="border:1px solid #e7e9ec;border-radius:12px;padding:24px 14px;"><p style="margin:0 0 10px;font:11px Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:#69727b;">YOUR VERIFICATION CODE</p><p style="margin:0;font:bold 36px/1.3 'Courier New',monospace;letter-spacing:7px;color:#111418;">${P.otp}</p><p style="margin:12px 0 0;font:12px Arial,Helvetica,sans-serif;color:#69727b;">Valid for 30 minutes</p></td></tr></table>`;
const row = (label, value) =>
  `<tr><td style="padding:12px 14px;border-bottom:1px solid #e7e9ec;font:12px/1.5 Arial,Helvetica,sans-serif;color:#69727b;">${label}</td><td align="right" style="padding:12px 14px;border-bottom:1px solid #e7e9ec;font:600 13px/1.5 Arial,Helvetica,sans-serif;color:#111418;word-break:break-word;">${value}</td></tr>`;
const specs = [
  {
    id: "verification-otp",
    kicker: "EMAIL VERIFICATION",
    title: "Verify your email address.",
    pre: "Verify your email using your one-time code.",
    body:
      p(
        "Welcome to Movement Markets. Enter the code below in the client portal to verify your email address.",
      ) +
      code() +
      p("Keep this code private. Our team will never ask you to share it.") +
      note(
        "If you didn’t create an account, you can safely ignore this email.",
      ),
    text: `Welcome to Movement Markets.\n\nEnter this code in the client portal to verify your email:\n${P.otp}\n\nThis code expires in 30 minutes. Never share it.\nIf you didn’t create an account, ignore this email.`,
  },
  {
    id: "withdrawal-otp",
    kicker: "WITHDRAWAL VERIFICATION",
    title: "Confirm it’s you.",
    pre: "Your withdrawal verification code expires in 30 minutes.",
    body:
      p("Enter this code in the withdrawal screen to confirm your request.") +
      code() +
      p(
        "Verifying your request does not mean the withdrawal has been completed. You can follow its status in Transaction history.",
      ) +
      note(
        "Didn’t request a withdrawal? Do not share this code. Sign in to your client portal to review your account security and contact support.",
      ),
    text: `Enter this code in the withdrawal screen:\n${P.otp}\n\nExpires in 30 minutes. Verification does not confirm payment completion. Follow the request in Transaction history.\nIf you didn’t request a withdrawal, do not share the code. Review your security and contact support through your client portal.`,
  },
  {
    id: "account-approved",
    kicker: "ACCOUNT APPROVED",
    title: "Your account is approved.",
    pre: "Your Movement Markets account has been approved.",
    body:
      p(
        "Your Movement Markets account has been approved. Sign in to manage your profile, funding, and trading accounts.",
      ) +
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f4f6f8" style="border-radius:10px;">${row("Your email", P.email)}</table>` +
      action("Open client portal", "https://my.movementmarkets.com/auth") +
      note(
        "Use your existing password to sign in. If you need a new one, select “Forgot password?” on the sign-in page. For your security, we do not include passwords in email.",
      ),
    text: `Your Movement Markets account is approved.\n\nEmail: ${P.email}\nSign in: https://my.movementmarkets.com/auth\n\nUse your existing password. If needed, use Forgot password on the sign-in page. Passwords are never included in this email.`,
  },
  {
    id: "demo-account-created",
    kicker: "DEMO ACCOUNT",
    title: "Your demo account is ready.",
    pre: "Your demo trading account details are ready.",
    body:
      p(`Hi ${P.name},`) +
      p(
        "Your demo trading account is ready. Use the details below to connect to your trading platform.",
      ) +
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f4f6f8" style="border:1px solid #e7e9ec;border-radius:12px;">${row("Trading account ID", P.tradingAccountId)}${row("Trading username", P.tradingUsername)}${row("Broker", P.brokerName)}${row("Server", P.serverName)}${row("Demo balance", P.amount)}</table>` +
      action(
        "View trading platforms",
        "https://my.movementmarkets.com/terminals",
      ) +
      note(
        "This is a demo account using virtual funds. Keep these details for your records. Demo trading results do not guarantee future performance.",
      ),
    text: `Hi ${P.name},\n\nYour demo trading account is ready.\nTrading account ID: ${P.tradingAccountId}\nTrading username: ${P.tradingUsername}\nBroker: ${P.brokerName}\nServer: ${P.serverName}\nDemo balance: ${P.amount}\n\nPlatforms: https://my.movementmarkets.com/terminals\nThis account uses virtual funds. Demo results do not guarantee future performance.`,
  },
  {
    id: "reset-password",
    kicker: "ACCOUNT SECURITY",
    title: "Reset your password.",
    pre: "Use the secure link to reset your Movement Markets password.",
    body:
      p(
        "We received a request to reset your Movement Markets password. Use the button below to choose a new one.",
      ) +
      action("Reset password", P.resetPasswordUrl) +
      note(
        "If you didn’t request a password reset, ignore this email. Your password will stay the same. Never share this link with anyone.",
      ) +
      `<p style="margin:18px 0 0;font:11px/1.7 Arial,Helvetica,sans-serif;color:#69727b;">Button not working? Copy this link into your browser:<br/><a href="${P.resetPasswordUrl}" style="color:#527000;word-break:break-all;">${P.resetPasswordUrl}</a></p>`,
    text: `We received a request to reset your Movement Markets password.\n\nReset your password: ${P.resetPasswordUrl}\n\nIf you didn’t request this, ignore the email. Your password will stay the same. Never share this link.`,
  },
  {
    id: "verify-email-link",
    kicker: "EMAIL VERIFICATION",
    title: "Confirm your email address.",
    pre: "Confirm your email address to continue with Movement Markets.",
    body:
      p(
        "Thanks for joining Movement Markets. Confirm your email address to continue setting up your account.",
      ) +
      action("Verify email address", P.verificationEmailUrl) +
      note("If you didn’t request this email, you can safely ignore it.") +
      `<p style="margin:18px 0 0;font:11px/1.7 Arial,Helvetica,sans-serif;color:#69727b;">Button not working? Copy this link into your browser:<br/><a href="${P.verificationEmailUrl}" style="color:#527000;word-break:break-all;">${P.verificationEmailUrl}</a></p>`,
    text: `Thanks for joining Movement Markets.\n\nVerify your email: ${P.verificationEmailUrl}\n\nIf you didn’t request this, ignore the email.`,
  },
];
function shell(s) {
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="color-scheme" content="light"/><meta name="supported-color-schemes" content="light"/><title>${s.title} · Movement Markets</title><style>@media(max-width:620px){.email-shell{width:100%!important}.outer-pad{padding:20px 12px!important}.email-content{padding:30px 24px!important}.email-header{padding:23px 24px!important}.email-title{font-size:27px!important}}a:focus{outline:2px solid #527000;outline-offset:3px}</style></head>
<body style="margin:0;padding:0;background-color:#f3f5f8;-webkit-text-size-adjust:100%;"><div style="display:none;font-size:1px;color:#f3f5f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${s.pre}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f5f8"><tr><td class="outer-pad" align="center" style="padding:48px 20px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" class="email-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e3e7ed;border-radius:16px;overflow:hidden;"><tr><td class="email-header" bgcolor="#111411" style="padding:28px 36px;border-bottom:3px solid #b0f000;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding-right:12px;"><img src="\${logoUrl}" width="27" height="30" alt="" style="display:block;border:0;"/></td><td style="font:400 19px/1.2 Arial,Helvetica,sans-serif;letter-spacing:-.4px;color:#ffffff;"><strong style="font-weight:700;">Movement</strong> Markets</td></tr></table></td></tr><tr><td class="email-content" style="padding:38px 36px 34px;"><p style="margin:0 0 18px;font:600 10px Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:#527000;">${s.kicker}</p><h1 class="email-title" style="margin:0 0 23px;font:600 32px/1.2 Arial,Helvetica,sans-serif;letter-spacing:-1px;color:#111418;">${s.title}</h1>${s.body}<p style="margin:27px 0 0;font:13px/1.7 Arial,Helvetica,sans-serif;color:#111418;">The Movement Markets team</p></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;"><tr><td align="center" style="padding:22px 20px 0;font:11px/1.8 Arial,Helvetica,sans-serif;color:#707983;"><a href="https://movementmarkets.com" style="color:#58616b;text-decoration:none;">movementmarkets.com</a> &nbsp; &middot; &nbsp; <a href="https://my.movementmarkets.com" style="color:#58616b;text-decoration:none;">Client portal</a><br/>This is an account notification from Movement Markets.</td></tr></table>
</td></tr></table></body></html>`;
}
const sample = {
  otp: "482 916",
  email: "alex@example.com",
  name: "Alex",
  tradingAccountId: "10028451",
  tradingUsername: "10028451",
  brokerName: "Movement Markets",
  serverName: "Movement Markets Demo",
  amount: "10,000.00 USD · virtual funds",
  resetPasswordUrl:
    "https://my.movementmarkets.com/auth?mode=reset&token=EXAMPLE-ONLY",
  verificationEmailUrl:
    "https://my.movementmarkets.com/auth?mode=verify&token=EXAMPLE-ONLY",
};
for (const s of specs) {
  writeFileSync(new URL(`emails/templates/${s.id}.html`, root), shell(s));
  writeFileSync(
    new URL(`emails/templates/${s.id}.txt`, root),
    s.text + "\n\nMovement Markets\nhttps://movementmarkets.com\n",
  );
  const result = renderEmail(s.id, sample, { logoUrl: "cid:movement-gate" });
  writeFileSync(
    new URL(`emails/examples/${s.id}.html`, root),
    result.html.replace(
      "cid:movement-gate",
      "../../public/brand/movement-gate-email.png",
    ),
  );
  writeFileSync(
    new URL(`public/email-preview/${s.id}.html`, root),
    result.html.replace("cid:movement-gate", "/brand/movement-gate-email.png"),
  );
}
writeFileSync(
  new URL("public/email-preview/index.html", root),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Movement Markets · Email collection</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f5f8;font:14px Arial;color:#111418}header{padding:22px 28px;background:#111411;color:white;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #b0f000}header a{color:#b0f000;text-decoration:none}nav{padding:18px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap}button{cursor:pointer;background:white;border:1px solid #dfe4e9;border-radius:30px;padding:10px 15px;color:#58616b;font:12px Arial}button[aria-pressed=true]{color:#111800;background:#b0f000;border-color:#b0f000}iframe{width:100%;height:calc(100dvh - 160px);border:0}h1{font-size:17px;margin:0}small{font-size:11px;color:#adb4ac} @media(max-width:600px){header{padding:20px;gap:20px}iframe{height:calc(100dvh - 225px)}h1{font-size:15px}}</style></head><body><header><div><h1>Movement Markets</h1><small>Transactional email collection · sample content</small></div><a href="/downloads/movement-markets-email-templates.zip" download>Download all templates ↓</a></header><nav aria-label="Email templates">${specs.map((s, i) => `<button data-file="${s.id}.html" aria-pressed="${i === 0}">${s.kicker.toLowerCase().replace(/^./, (x) => x.toUpperCase())}${s.id === "verification-otp" ? " · OTP" : s.id === "verify-email-link" ? " · Link" : ""}</button>`).join("")}</nav><iframe id="preview" title="Email preview" src="verification-otp.html"></iframe><script>document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('nav button').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');document.getElementById('preview').src=b.dataset.file}));</script></body></html>`,
);
console.log("Built 6 branded HTML/text templates and browser previews.");
