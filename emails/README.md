# Movement Markets transactional emails

Six complete HTML emails, matching plain-text versions, sample renders, and a dependency-free Node renderer. Files in `templates/` preserve the original `${variable}` syntax. Never interpolate unescaped user input manually.

Preview: http://127.0.0.1:9000/email-preview/
Rebuild samples: `npm run emails:build`
Test: `npm test`

## Backend handoff

```js
import { renderEmail } from './emails/render.mjs';
const {subject, html, text} = renderEmail('verification-otp', {otp}, {
  logoUrl: 'cid:movement-gate'
});
// Pass subject, html and text to your existing mail provider.
// Attach public/brand/movement-gate-email.png with CID movement-gate.
```

CID attachment is recommended for the gate mark. Alternatively pass the HTTPS URL of an uploaded copy of `public/brand/movement-gate-email.png`. The default URL is a deployment target, not an already published asset. If images are blocked, the text wordmark still shows.

| Template | Required values |
| --- | --- |
| verification-otp | otp |
| withdrawal-otp | otp |
| account-approved | email |
| demo-account-created | name, tradingAccountId, tradingUsername, brokerName, serverName, amount |
| reset-password | resetPasswordUrl |
| verify-email-link | verificationEmailUrl |

Pass `amount` with its currency, e.g. `10,000.00 USD`. Pass the OTP as a string to preserve leading zeroes. Link values must be valid absolute HTTPS URLs from your trusted application; the renderer rejects unsafe protocols and embedded credentials. Do not accept an arbitrary customer-provided reset/verification URL.

## Intentional copy changes

- Branding is Movement Markets rather than Xnoma. No marketing images or invented security/legal claims.
- OTP expiry remains 30 minutes. The backend must enforce this; HTML cannot enforce expiration.
- Approval email intentionally does **not** send `${password}`. It directs the user to sign in or use the existing password-reset process. If your backend creates a new account without a user-selected password, arrange a one-time password-setting link before enabling this template.
- Withdrawal verification is not described as successful payment completion.
- Reset and verification links have no invented expiry duration.
- Demo funds are identified as virtual funds.

Table layout, inline styles, mobile overrides, preheader, explicit colors, raster mark, and plain-text alternatives are supplied. Browser previews and renderer checks have been completed; Gmail, Outlook, Apple Mail and automatic dark-mode inbox tests still need a delivery test through your mail service. No emails were sent and no backend mail implementation was changed.
