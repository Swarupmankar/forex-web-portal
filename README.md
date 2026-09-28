# Movement Markets web terminal

Local development: `npm ci` then `npm run dev` → http://127.0.0.1:9000.
Production build: `npm run build`; serve it with `npm start`.
Validation: `npm test` and `npm run typecheck`.
Email preview: http://127.0.0.1:9000/email-preview/.

## Fixed workspace

Movement Markets portal branding, light/dark themes, fixed watchlist/chart/order panels, mobile Markets/Chart/Trade/Activity navigation, searchable instruments, favorites, chart intervals, candles/line view, SMA20, grid preferences, chart focus and snapshots, local price alerts, positions/pending/history, CSV export and one-click or reviewed order placement. No draggable tabs or panels.

Keyboard shortcuts: `/` instrument search; `A` price alert; `?` help; Escape closes dialogs or chart focus. Shortcuts never execute orders.

## Practice account

Practice is the default mode, with $10,000 of virtual USD and eight instruments. It uses a separate simulated quote stream and browser-local account store (`mm-terminal-practice-v1`). No order, edit, close, cancel, or reset in this mode calls the backend.

Market buys fill at ask and sells at bid. Closing uses the opposite quote; P&L includes the spread and USDJPY results convert to USD. Market, limit and stop orders, stop loss/take profit, edit exits, close, cancel, history/CSV and a reset control are available. Practice uses 1:100 leverage, zero commission/swap and a 50% margin stop-out. It is a UI simulator, not a representation of actual execution or costs. Pending and exit orders run only while practice mode is open; no overnight execution is implied. Orders persist in this browser, with no cross-device or multi-tab synchronization guarantee. Practice and connected price alerts are separated.

The top-right account selector opens Practice and connected Real/Demo trading sessions. Connect each broker account once with its trading username/password, broker and server; then switch directly in the menu. The account type is backend-reported and never guessed. Passwords are not saved; tokens are scoped to the terminal tab in session storage. The terminal defaults to Practice on reload, with connected sessions still available in the menu while valid.

Switching aborts reads and resets account caches, quotes, order drafts and one-click consent. Responses from the previous session cannot populate the next account. Practice positions stay in their separate local store. Backend execution stays disabled independently of the practice engine. Automatic account discovery from the client portal needs a backend session-handoff contract; no portal token is assumed to be a trading token.

Download all six email templates: `/downloads/movement-markets-email-templates.zip`; the preview header also includes a download link.

## Connection and execution status

The integration is aligned with the local React Native source at `/Users/komalprf/Downloads/paper-trading`. See [integration notes](docs/mobile-integration.md).

- REST requests pass through the allowlisted same-origin Next route `/api/trading/*` to server-only `BACKEND_URL`.
- The market-data URL is public by necessity; browsers must connect to it. The app's current `mock-ws-chart.onrender.com` feed is labelled **Development feed**, never silently promoted to production.
- In Connected mode, chart history comes from the backend `data.quotes` response. Unavailable symbols display a retry/error state, never fabricated history.
- No financial transactions were performed. Login to the web terminal requires a **trading** account ID/password and its broker/server; the client-portal or Elefin password is not assumed to be the same.
- Connected-account execution is controlled at runtime by `TRADING_MODE` (or the legacy `TRADING_ENABLED`) and enforced by the server proxy before forwarding; `close-only` still allows closing and cancelling. Keep it `halted` until the FIX deployment and staging acceptance are complete.
- When no streaming URL is configured, clearly labelled illustrative preview data is used, without execution.
- Browser-local alerts are stored on this device and work only while the terminal is open and quotes arrive. They are not server notifications.

## Environment

Copy `.env.example` to `.env.local` and configure. Operational detail (kill switch, health checks, logs, rate limits, SLOs) is in [docs/operations.md](docs/operations.md).

| Variable | Visibility | Purpose |
| --- | --- | --- |
| BACKEND_URL | server only | Backend origin (required; no built-in fallback). Must be https outside development. |
| BACKEND_ALLOWED_HOSTS | server only | Optional allowlist of backend hosts. |
| DEPLOY_ENV | server only | `production`, `staging` or `development` (default). Non-production shows an environment badge. |
| TRADING_MODE | server only | Runtime kill switch: `enabled`, `close-only` or `halted`. Falls back to `TRADING_ENABLED`. |
| HALTED_SYMBOLS | server only | Comma list of symbols that cannot receive new orders. |
| TRADING_ENABLED | server only | Legacy gate used when `TRADING_MODE` is unset. |
| NEXT_PUBLIC_WS_URL | public | Streaming service URL. The `mock-ws` development feed never allows connected execution. |
| NEXT_PUBLIC_CLIENT_PORTAL_URL | public | Funding, profile and portal destination. |
| NEXT_PUBLIC_TRADING_ENABLED | public, legacy | No longer gates orders; the UI reads `GET /api/trading/status` at runtime. |

Never put credentials or API secrets in NEXT_PUBLIC variables. The terminal polls `/api/trading/status` every 30 s and on focus; connected execution fails closed if it can't be read. Changing `TRADING_MODE` or `HALTED_SYMBOLS` takes effect without a rebuild once the server process picks up the new environment.

### Order safety (connected accounts)

- Every order, close and modify carries an `Idempotency-Key`. If the proxy can't confirm the outcome (timeout, lost response), the ticket shows "Confirming…", blocks new orders and polls open orders for up to 30 s, then reports "confirmed #id" or "not found — safe to try again". It never invites a blind retry.
- The ticket, chart and submit path share one executable quote (account spread markup applied), one volume rule (instrument limits, capped at the proxy's 100 lots / 0.01 steps) and one duplicate/in-flight guard. Orders of 10 lots or more always open a review.
- Quotes older than 5 s, or arriving more than 2 s late, can't be traded on.
- A 401 on a background read is confirmed once before the session is treated as expired; the account stays listed as "Session expired · Reconnect" and the order draft is kept. Real accounts lock after 15 minutes without input.

## Before production release

Verify authenticated account/position/history/watchlist behavior with a test trading account; the source contracts are mapped but no trading-account credentials were supplied for this new terminal. Confirm currency, instrument precision, available intervals, volume limits and spread metadata with the backend. BTC/ETH historical requests currently return a backend error in the local integration; the terminal surfaces this cleanly. Supply a production price feed and complete order/close/edit/cancel staging acceptance after the FIX engine is available. Keep both execution gates off until then.

The original hardcoded deposit address, fabricated history in connected mode, fake order-success fallbacks, invented brokers/servers and fake latency indicators have been removed. Funding is handled by the existing client portal.

Next.js was upgraded from 15.1.7 to 15.5.26 following the [official security release guidance](https://nextjs.org/blog). A compatible PostCSS override addresses the transitive advisory reported by npm. Re-check dependencies before deployment; a successful build is not a substitute for integration acceptance.

No deployment, Git push or email delivery has been performed.

### Chart trading and position management

The chart has a compact Buy / Sell console with a shared lot size and optional SL/TP protection. **At price** lets you pick an entry from the chart for a limit/stop order.

### Order placement

The order ticket and the chart console share one submission path (`src/components/OrderEntry/useOrderSubmit.ts`), so both follow the same rules:

- **One-click trading** is on by default in Practice: Buy, Sell and Close act immediately. Turn it off from the ticket (**Review first**), the chart's **1-click** button or Terminal preferences to review every order in a dialog. The Practice setting is saved in this browser.
- Connected accounts always start with reviews. Enabling one-click there needs an explicit acknowledgement and turns off again on any account switch or reconnect.
- An identical order repeated within 500 ms (a double-click) is ignored; a different order is never delayed.
- Pending orders pick **limit** or **stop** from where the entry sits relative to the market, so they cannot be placed on the wrong side.
- With risk controls on, the ticket shows the USD result at the stop and target, reward:risk and estimated margin, and **Size by risk** sets the lots for a USD amount at the stop. Amounts appear only for USD-quoted and USD-based symbols; other crosses show "—" rather than a guess.

Activity shows current price and open time, floating/realized P&L totals, partial close (25% / 50% / All or any volume), bulk close (all / profitable / losing / cancel pending), a current-instrument filter and history periods. Bulk actions always confirm. For connected accounts each order is sent separately and failures are counted in the result message.

Placed practice trades appear as entry lines, selectable P&L labels and activity rows. Select a trade to manage its protection; drag SL/TP handles or click them for exact prices. Pending entries are movable, executed entries are fixed. Arrow keys adjust a selected movable handle (Shift = ten increments), Enter saves, and Escape cancels the preview. Chart focus provides more room on smaller screens.

Use **Indicators** for SMA, EMA, Bollinger Bands and RSI. Periods and band deviation are configurable and saved locally. The speaker control mutes/unmutes trade sounds. Updated terminal tabs synchronize practice account state. Practice orders are still local simulations; connected order execution remains gated until the backend/FIX rollout is validated.

Design and verification notes: `docs/chart-trading-plan.md`.
