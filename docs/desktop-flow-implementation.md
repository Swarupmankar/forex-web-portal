# XpertTrader desktop flow — implementation

Approved reference: the interactive desktop proposal from 3 November 2026, based on the XpertTrader source (`paper-trading`).

## Current snapshot — 5 November 2026

- Movement Markets branding is applied on `codex/movement-markets-branding`, with client-portal typography, neutral controls, compact spacing and reduced corner radii. The earlier phase notes below record the unbranded implementation stages.
- The one-page workspace includes chart order/protection interactions, partial/full close management, trade-detail dialogs, a separate activity view, instrument filters/artwork, price alerts, trade sounds and consolidated execution notifications.
- Connected-order refreshes bypass unrelated pending chart requests and retry reads at 600 and 1,200 ms. Concurrent socket/mutation refreshes coalesce, old-account results are discarded, and accepted orders remain unconfirmed until authoritative data arrives. Validated account reads also warm the routing cache to avoid redundant discovery before an order.
- Latest validation: all 309 automated tests, TypeScript checking and the production build passed. Connected browser timing and final visual acceptance remain incomplete; the browser still denied access at the latest attempt. No production deployment is implied by publishing this branch.

## Phase 1 — single-page desktop workspace

The user approved the styling and asked to rearrange the sections into one page. Implemented in the web terminal only; Movement Markets branding remains deferred.

- Persistent account selection and the same account figures above the workspace.
- Watchlist on the left, chart in the centre, and a persistent order ticket on the right.
- Positions, Pending, History and Price alerts share a resizable dock below the watchlist/chart. Switching its view preserves the chart, ticket, volume and draft protections.
- Instrument specifications remain accessible from the toolbar in a dialog. Missing broker metadata stays unknown; practice uses the practice engine's limits.
- Chart focus remains optional. On smaller windows all panels stack in one scrolling workspace, and actions reveal their destination without replacing other panels.
- The divider reserves chart space, handles stored heights from larger monitors, supports keyboard resizing and resets on double-click.
- Existing Manrope typography, local artwork, light/dark colors, account data and execution behavior are preserved. No extra order, chart or feed instance is created.

## Phase 2 — order ticket and execution

Implemented in the web terminal, keeping all four workspace panels mounted and broker branding deferred.

- Explicit Market / Limit / Stop selection. Pending type, direction, price and protection are shared with the chart; entry edits never silently turn a Limit into a Stop.
- Market tickets expose final Sell and Buy actions, like the app. Each side checks its own bid/ask protection rules; incompatible actions show the reason. Pending tickets use a single direction-specific Place action. Orders at or above 10 lots retain the web terminal's large-volume review.
- The configured ticket is the final action for normal orders. The Practice quick-close preference no longer claims to control new-order submission.
- The right panel changes to Sending, Submitted, Position opened, Pending order placed, Rejected, Checking or Unconfirmed. It shows the submitted fields, order ID and actual fill price when available. Chart, Positions/Pending and History destinations stay within the same page.
- Existing decimal-string payloads, broker lot limits, quote freshness, halted/close-only controls, account service binding, idempotency and duplicate guards remain authoritative.
- A matching account row or opening execution notification confirms a fill. Notifications require the same account and order ID; close events and another device's unmatched orders cannot claim the result. Fast events are buffered for correlation after the HTTP reply, and a late acceptance cannot downgrade a fill/rejection. If no reliable identity is available, the result stays unconfirmed.
- Lost responses trigger the existing bounded account reconciliation and block another submission while it runs. SENDING rows can identify an order but do not confirm execution. Account changes clear draft/results/events and reject stale asynchronous results.

Reference rechecked: mobile `TradeScreen.tsx` pending validation (lines 278–313), create handler (353–398) and final actions (858–877); `OrderConfirmationScreen.tsx` opening/closing execution distinction (128–170). No mobile or backend source changed. The separate management dialogs from Phase 2 are replaced by the shared ticket in Phase 3 below.


## Phase 3 — chart and management interactions

Implemented in the existing one-page layout, using XpertTrader `TradeScreen.tsx` exit/modify/cancel handlers and `ChartScreen.tsx` placed-order editing as the reference.

- Chart handles, Add/Edit SL and TP chips, pending-entry editing and position-row actions open the same right-hand management ticket. The watchlist, chart and positions/history dock remain mounted.
- Dragging or using arrow keys previews a change; Enter or **Edit in ticket** transfers it to the editor. Saving is a separate explicit action. Exact-price inputs offer a non-drag alternative. Escape cancels the chart preview without clearing an input field's unrelated new-order draft.
- The ticket displays original → proposed levels and previews valid changes on the chart. Fit trade includes these preview prices. Moving a pending entry preserves SL/TP distances and the selected Limit/Stop type. An executed entry cannot move. Existing protection cannot be removed, matching the backend contract.
- Full and Partial close controls show exact lots, executable percentage presets, remaining volume, the appropriate bid/ask and indicative P&L. The 0.01-lot minimum/step and live open volume are rechecked at submission. A partial close retains the remainder's SL/TP.
- Selected trades are compared with the current account row before any request. Changed volume, protection, entry, identity or status requires reloading the latest details. Close-only accounts can manage trades; halted accounts cannot. Existing request locks, account-generation guards and decimal-string mutation payloads remain active.
- Accepted changes stay **requested** until account state confirms them. A partial/full close needs both the new remaining position and a new exit record; missing rows alone never prove success. Confirmed results show remaining lots and actual exit price/P&L when available. Pending cancellations that race with a fill lead back to the filled position.
- Lost responses retain a per-order unresolved result across editor dismissal. Account/history polling runs for up to 30 seconds after submission, then becomes explicitly unconfirmed with a manual refresh action. Late observations can still confirm it. Retrying the same trade, including through bulk actions, is blocked while unresolved. Account switching clears this state and ignores old responses.
- Bulk close/cancel keeps its existing confirmation but now joins the same per-order tracking. Practice uses the same editor and atomic local updates; no connected trade was submitted during implementation.

Browser checks of actual drag geometry, keyboard focus, responsive layouts and connected execution remain part of Phase 4 acceptance. Local fixture and server-render checks do not replace them.

## Phase 4 — integration acceptance

Compare account figures, order records, exits and margin against the mobile app on the same account, then verify another broker's service binding. Distinguish local fixture tests from connected acceptance. No claim of production readiness until these checks are complete.

## Backend reference checked for Phase 1

`src/services/appServicesEndPoints.ts` in the mobile app and `src/store/api/tradingApi.ts` in the web terminal use matching watchlist/account/order routes. The mobile `MarketWatchScreen.tsx` symbol sheet provides quotes, Trade, Chart and details; it becomes the desktop detail panel. `TradeScreen.tsx` sends decimal strings and separates submission from execution, which remains preserved by the terminal's existing submit and receipt services.

No backend, engine, app, user portal, IB portal or admin source changed in Phase 1. No connected orders were placed in this phase.

## Verification

- 245 automated tests passed. The 26 Phase 3 checks add close-volume/remainder validation, all pending reprice variants, stale-trade guards, account/history reconciliation, 30-second expiry, actual management-submit tests with fake transport, atomic Practice updates and isolated React management/result rendering.
- TypeScript checking passed.
- Production build passed (Next.js 15.5.26), including the final Phase 3 management ticket and recovery actions.
- Browser visual and connected-account acceptance: not completed. Earlier browser access to the terminal was denied by a saved permission or managed policy; no alternative browser route was used to bypass it. Static checks do not replace that acceptance.
