# Mobile-to-web integration mapping

Updated 3 November 2026 against the local XpertTrader source (`paper-trading`, commit `0eb8ef2`). Mobile code was not modified. Earlier chart/order integration was based on commit `7e94655`.

| Capability | Web implementation |
| --- | --- |
| Account entry | One-time client-portal Trade handoff; no trading-password login in the terminal |
| Broker routing | Server verifies the account through `GET /v1/users/trading/account`; uses its `serverUrl` and `priceFeedUrl`, with nested `Server`/broker-directory compatibility. Origins must be operator-approved. No global routing fallback. |
| Account switching | Stops both sockets, clears quotes, drafts and settlement state, invalidates pending reads and resets chart identity; a late response cannot update the next account. Engine account ID is preserved across session restore, separately from the trading login. Explicitly foreign order rows are excluded. |
| Account figures | Current `marginInUse` per position, without scaling it again after partial closes. Uses order-list spendable cash plus own margin, then floating USD P&L. Matches the app’s bounded 45-second display adjustment for cash/order settlement lag, with a visible settling indicator. Missing margin/quote data remains unknown. Expired adjustments cannot be revived by a later trade. |
| Watchlist | Local app artwork for currency pairs, crypto, metals, energy and indices; metadata-first aliases/suffixes and text fallback on missing artwork. Shows bid and ask. Browsing uses pages of 50 rows and subscribes the displayed instruments; positions/chart retain their own subscriptions. Catalogue favorites reflect the saved watchlist. |
| Activity | Full-width desktop activity panel with resize/maximize/restore, sticky table headers/totals, details for open/history rows, and mobile cards. Full-page navigation adds search, sort, completion filters and summary figures. Pending SENDING rows cannot be edited as filled positions. |
| History | Selected feed `/history?symbol=…&tf=…&limit=500&to=…`; bid OHLC from ten-value tuples; timestamps in milliseconds |
| Calendar | M1/M5/M10/M15/M30/H1 clock periods; H2/H4/D1/W1/MN1 use the mobile New York 17:00 calendar including DST |
| Older history | 500-bar pages at the left edge or via Load older candles, capped at 20,000; preserve the visible range when prepending |
| Recovery | Latest 100 candles on reconnect/focus; retain earlier loaded pages and live ticks; empty feeds build from live prices |
| Quotes | Binary protobuf `/ws/prices`; prices scaled by 1e8, quote timestamp retained for candles, arrival time used for availability |
| Price precision | Watchlist, chart axis/readout/handles, order tickets and history use catalogue digits/pip size plus the greatest precision observed in the account's feed, up to eight decimals. Reconnects retain precision; account switches clear it. Practice keeps its own fixed instrument precision. |
| Notifications | Account engine `/ws/mobile`; refresh orders, balances and history on notifications and reconnect |
| Create | Decimal-string volume/price fields, lot limits, freshness, bid/ask protection checks, idempotency and accepted-versus-filled handling |
| Chart management | Select positions/pending orders; drag or type protection/entry prices; review before submission. Moving a pending entry shifts attached SL/TP by the same amount, including the chart preview. Chart and Activity open the same persistent right-hand management ticket. |
| Modify | Decimal `limitPrice` for pending repricing; positive SL/TP; existing protections cannot be removed |
| Close/cancel | Reviewed full/partial close or cancellation; account-switch and in-flight guards. Close presets display the exact lot amount and only offer percentages executable in 0.01-lot steps. |
| History rows | One row per exit, including actual exit price, closing timestamp, closed volume, realised P&L, swap and close reason. Completed rows take precedence over duplicate partial rows. Missing per-exit values do not duplicate aggregate profit/volume. History refreshes immediately and at 2.5/6/12 seconds after order lifecycle changes while visible; timers cancel on account/tab changes. Failed refreshes preserve loaded rows with a retry notice. Practice history follows exit time. |

## Current desktop phase

The approved XpertTrader flow uses one page: watchlist left, chart centre, ticket right and a shared positions/history dock below. Movement Markets branding and portal typography are applied. Account figures stay available in the workspace; instrument specifications open from the toolbar. Switching the dock preserves the chart and order draft. See [desktop phase status](desktop-flow-implementation.md) for current changes and verification limits.

## Validation and remaining acceptance

Phase 2 uses the app's explicit Market / Limit / Stop ticket and direct final actions for normal orders. The ticket stays beside the chart and shows execution results in place. The web's 10-lot review guard remains. Chart Buy/Sell prepares a draft unless one-tap trading is explicitly enabled; trade management uses the same right-hand slot for exact SL/TP, pending entry, partial/full close and cancel actions.

Phase 3 adds current-row revalidation and per-order confirmation tracking: closes require matching new exit records plus the remaining volume. Unknown outcomes remain blocked for that order across editor dismissal, and late observations can resolve them.

Regression coverage includes the actual submit and management hooks with deterministic transport fixtures, account switching, duplicate clicks, quote/volume/protection gates, delayed execution, rejection and uncertain outcomes. Isolated React server rendering also checks execution choices, disabled sides and result copy; this is not browser visual acceptance. No connected orders are submitted by these tests.

The preceding 3 November account-data pass passed its 172 automated tests, TypeScript checking, and the production build. Its regressions cover current versus original margin, account isolation/restore, partial closes, cash-first and order-first settlement, expiry, missing quote/margin values, exit deduplication and missing data, bounded history refresh cleanup, symbol artwork mapping and local asset availability. These remain in the current suite.

This pass has **not been browser-verified**. After the user confirmed browser access was restored, the browser tool still rejected observation of `http://localhost:9000` because a saved permission or managed policy denies access. No alternate browser surface was used, and no connected orders were submitted. Layout, artwork loading and connected-account figures/history still need an in-browser acceptance check. A successful build is not production acceptance.

Latest validation on 5 November 2026 passed all 309 tests, TypeScript checking and the production build. Tests include calendar/DST boundaries, tuple decoding, account route isolation, proxy policies, protection rules, exit history, coalesced routing discovery and connected refreshes across delayed persistence/account switches. Earlier browser observations of existing closed trades do not verify this pass. Connected order-to-position timing still needs an observed browser test.

This implementation pass does not submit new connected orders. Backend acceptance for new orders, repricing, partial closes, A-book delayed fills, and a second broker deployment remains necessary before release. Extra brokers on other origins require `TRADING_SERVICE_ALLOWED_ORIGINS`; funding, KYC, IB and admin workflows remain in their respective portals.
