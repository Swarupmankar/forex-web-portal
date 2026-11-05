# Movement Markets web terminal

Local development: `npm ci` then `npm run dev` → http://127.0.0.1:9000.
Production build: `npm run build`; serve it with `npm start`.
Validation: `npm test` and `npm run typecheck`.
Email preview: http://127.0.0.1:9000/email-preview/.

## Trading workspace

The terminal uses Movement Markets branding and the client portal's Inter / Space Grotesk fonts. Compact controls, restrained colors and small corner radii preserve space for trading. Branding styles are separated from the shared trading workflow.

The approved XpertTrader styling is arranged as one continuous desktop workspace. See [the phased implementation notes](docs/desktop-flow-implementation.md) for completed ticket/management work and remaining acceptance checks.

- **Left — Watchlist:** search, categories, favorites and bid/ask quotes. Selecting an instrument updates the shared chart and ticket. The search picker remains available for adding instruments.
- **Centre — Chart:** a wide chart with instrument tabs, indicators, price levels and Buy/Sell entry points. Pending draft prices remain shared with the ticket.
- **Right — Order ticket:** stays visible beside the chart, including while inspecting history. New order focuses its draft; choosing an instrument never submits a trade.
- **Below — Positions and history:** Positions, Pending, History and Price alerts switch within the same resizable dock. The watchlist, chart and ticket remain on screen. Drag the divider or use its arrow keys to resize; double-click resets it.
- **Account figures:** floating P&L, balance, equity, used margin, free margin and margin level use the existing valuation and settlement logic. Unknown values remain unknown.
- **Instrument details:** the toolbar opens the selected symbol's quotes and broker specifications in a small dialog, keeping them accessible without a separate screen.

The ticket has explicit Market / Limit / Stop choices, app-style final Buy / Sell actions and execution feedback. Orders of 10 lots or more retain a volume review. Chart Buy/Sell prepares the ticket unless one-tap trading is explicitly enabled. Account changes clear order drafts, receipts and one-tap consent. Responsive panel sizing preserves the single-page workspace.

Keyboard shortcuts: `/` instrument picker; `A` price alert; `?` help. Chart focus temporarily expands the chart; Escape restores the workspace. The dock divider supports Up/Down, Home/End and double-click reset. Shortcuts never execute orders.

## Practice account

Practice uses $10,000 of virtual USD and eight instruments, with a separate simulated quote stream and browser-local account store (`mm-terminal-practice-v1`). A development-only practice entry is available on the welcome screen. Connected accounts enter through the client portal. No order, edit, close, cancel, or reset in practice mode calls the backend.

Market buys fill at ask and sells at bid. Practice quotes use a single price (ask equals bid). Closing uses the opposite quote and USDJPY results convert to USD. Market, limit and stop orders, stop loss/take profit, edit exits, close, cancel, history/CSV and a reset control are available. Practice uses 1:100 leverage, zero commission/swap and a 50% margin stop-out. It is a UI simulator, not a representation of actual execution or costs. Pending and exit orders run only while practice mode is open; no overnight execution is implied. Orders persist in this browser, with no cross-device or multi-tab synchronization guarantee. Practice and connected price alerts are separated.

The terminal has no login or sign-up of its own. Users sign in to the client portal and press **Trade** on a trading account; the portal asks the backend (`POST /v1/users/trading/web-session`) for a single-use code valid for 60 seconds and opens the terminal at `/#handoff=<code>`. The terminal strips the code from the URL and redeems it (`POST /v1/users/trading/web-session/redeem`) for a session on every active account of that user, with the chosen one open. Opening the terminal without a code or a session shows a welcome screen with the client-portal entry link and account-selection steps. A reload resumes the account the tab had open.

The top-right account selector lists Practice and the user's Real and Demo accounts with their balances, and switches directly. The account type is backend-reported and never guessed. Tokens are scoped to the terminal tab in session storage.

Switching aborts reads and resets account caches, quotes, order drafts, order receipts and one-click consent. Responses from the previous session cannot populate the next account. Practice positions stay in their separate local store. Backend execution is controlled independently of the practice engine. The portal session itself never reaches the terminal; only the single-use code does.

Download all six email templates: `/downloads/movement-markets-email-templates.zip`; the preview header also includes a download link.

## Connection and execution status

The integration is aligned with the XpertTrader React Native source (`paper-trading`). See [integration notes](docs/mobile-integration.md).

- REST requests pass through the allowlisted same-origin Next route `/api/trading/*`. Account, watchlist and order reads use server-only `BACKEND_URL`; order writes and chart history use verified account-specific services. Routing is cached for 60 seconds per hashed session and server configuration. Authenticated account reads warm this cache, concurrent discoveries share one request, and browser-supplied service URLs cannot select a destination.
- Connected executions refresh orders and account figures directly after the response, with follow-ups at 600 and 1,200 ms for asynchronous persistence. Socket events share the same reader. Refreshes wait past older in-flight snapshots and stop on account changes. Only reads repeat; HTTP 202 remains acceptance, not a confirmed fill.
- The market-data URL is public by necessity; browsers must connect to it. The app's current `mock-ws-chart.onrender.com` feed is labelled **Development feed**, never silently promoted to production.
- In Connected mode, chart history comes from the authenticated account’s price-feed `/history` endpoint. Bid/ask tuples use the same 11 periods and New York 17:00 trading-day calendar as the mobile app. Older candles load in 500-bar pages up to 20,000 bars; reconnects recover the newest 100. Empty history can build from live ticks; failures remain visible.
- No financial transactions were performed. Sign-in happens only in the client portal; the terminal's proxy does not forward the trading-password login route.
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
| NEXT_PUBLIC_ENGINE_URL | public | Default approved engine origin. The active account’s authenticated `serverUrl` (or server directory) selects its full routing path for order calls and `/ws/mobile`. |
| NEXT_PUBLIC_PRICEFEED_URL | public | Default approved feed origin. The active account’s authenticated `priceFeedUrl` selects its history and `/ws/prices` connections. A `mock-ws` URL never allows connected execution. |
| TRADING_SERVICE_ALLOWED_ORIGINS | server only | Additional exact HTTPS origins approved for other brokers’ engines and feeds, comma-separated. Both services must be supplied by the authenticated backend; browser URLs and global route fallbacks are rejected. |
| NEXT_PUBLIC_CLIENT_PORTAL_URL | public | Funding, profile and portal destination. |
| NEXT_PUBLIC_TRADING_ENABLED | public, legacy | No longer gates orders; the UI reads `GET /api/trading/status` at runtime. |

Never put credentials or API secrets in NEXT_PUBLIC variables. The terminal polls `/api/trading/status` every 30 s and on focus; connected execution fails closed if it can't be read. Changing `TRADING_MODE` or `HALTED_SYMBOLS` takes effect without a rebuild once the server process picks up the new environment.

### Order safety (connected accounts)

- Every order, close and modify carries an `Idempotency-Key`. If the proxy can't confirm the outcome (timeout, lost response), the ticket shows "Confirming…", blocks new orders and polls open orders for up to 30 s, then reports a matching order or that the result remains uncertain and requires checking Positions and History. It never invites a blind retry.
- The ticket, chart and submit path share one executable quote (the live feed bid and ask as received), one volume rule (instrument limits, capped at the proxy's 100 lots / 0.01 steps) and one duplicate/in-flight guard. Orders of 10 lots or more always open a review.
- Quotes older than 5 s, or arriving more than 2 s late, can't be traded on.
- A 401 on a background read is confirmed once before the session is treated as expired; the account stays listed as ended and the terminal shows a session-ended screen linking back to the client portal (other accounts still signed in can be continued from there). Real accounts lock after 15 minutes without input.

## Before production release

Complete authenticated browser acceptance for account figures, positions, history, watchlists, charts and order/close/edit/cancel behavior, including delayed fills and a second broker deployment. Confirm currency, precision, supported intervals and volume limits against the backend. Automated tests and a successful production build do not replace this acceptance; connected order-to-position timing still needs an observed browser test.

The original hardcoded deposit address, fabricated history in connected mode, fake order-success fallbacks, invented brokers/servers and fake latency indicators have been removed. Funding is handled by the existing client portal.

Next.js was upgraded from 15.1.7 to 15.5.26 following the [official security release guidance](https://nextjs.org/blog). A compatible PostCSS override addresses the transitive advisory reported by npm. Re-check dependencies before deployment; a successful build is not a substitute for integration acceptance.

Latest automated validation (5 November 2026): 309 tests, TypeScript checking and the production build passed. Browser acceptance remains incomplete because the saved browser permission still denied access during the latest attempt.

### Chart trading and position management

The chart has a compact Buy / Sell console with a shared lot size and optional SL/TP protection. **At price** lets you pick an entry from the chart for a limit/stop order.

The management ticket shows original/proposed SL/TP, shared chart previews and exact partial-close lots. Closing is confirmed only after the remaining position and new exit history agree; an accepted request is not shown as a completed close. Uncertain results survive leaving the editor and block duplicate actions on that trade.

### Order placement

The order ticket and the chart console share one submission path (`src/components/OrderEntry/useOrderSubmit.ts`), so both follow the same rules:

- The configured ticket's **Buy / Sell** actions send a normal market order directly, as in XpertTrader. A pending ticket has a **Place buy/sell limit/stop** action. Orders of 10 lots or more retain an explicit volume review.
- Chart and trade-row **Edit / Close / Cancel** actions open a shared management ticket in the right column. Full/partial close and protection changes have explicit final actions there; the old quick Practice close preference is no longer exposed.
- An identical order repeated within 500 ms (a double-click) is ignored; a different order is never delayed.
- Pending **Limit / Stop** is an explicit choice shared by the chart and ticket. Moving the entry or live quote does not change that choice; an invalid price blocks placement.
- The ticket displays sending, submitted, confirmed position/pending order, rejection and uncertain outcome separately. An accepted response is never presented as a fill. Matching opening notifications are scoped to the account and order ID, including notifications that arrive before the HTTP reply.
- With risk controls on, the ticket shows the USD result at the stop and target, reward:risk and estimated margin, and **Size by risk** sets the lots for a USD amount at the stop. Amounts appear only for USD-quoted and USD-based symbols; other crosses show "—" rather than a guess.

Activity shows current price and open time, floating/realized P&L totals, partial close (25% / 50% / All or any volume), bulk close (all / profitable / losing / cancel pending), a current-instrument filter and history periods. Bulk actions always confirm. For connected accounts each order is sent separately and failures are counted in the result message.

Placed practice trades appear as entry lines, selectable P&L labels and activity rows. Select a trade to manage its protection; drag SL/TP handles or click them for exact prices. Pending entries are movable, executed entries are fixed. Arrow keys adjust a selected movable handle (Shift = ten increments), Enter opens the proposed change in the management ticket, and Escape cancels the preview. Saving from the ticket is required. Chart focus provides more room on smaller screens.

Use **Indicators** for SMA, EMA, Bollinger Bands and RSI. Periods and band deviation are configurable and saved locally. The speaker control mutes/unmutes trade sounds. Updated terminal tabs synchronize practice account state. Practice orders are still local simulations; connected order execution remains gated until the backend/FIX rollout is validated.

Design and verification notes: `docs/chart-trading-plan.md`.
