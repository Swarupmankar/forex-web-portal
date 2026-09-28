<!-- Generated from a 7-area code audit (94 verified findings) on 2026-09-26. Status is updated as items ship. -->

# Movement Markets Web Terminal: Roadmap

This roadmap merges the findings from 7 audits. Where several audits reported the same problem, it appears once here: notifications (4 findings), render storm (3), error boundaries (3), server clock and freshness (3), pips (3), margin states (3), and one pair each for idempotency, the account-events socket, candle integrity, contrast, practice feed, practice persistence and incremental chart ticks.

Effort is S/M/L as the audits rated it. Score = impact ÷ effort, with S=1, M=2 and L=4. Nothing listed here repeats a feature already built on this branch.

## Status on `feature/web-trader-order-flow` (2026-09-26)

**Phase 1 (Harden): shipped and browser-verified**, except where noted:

- ✅ #1 laptop chart height · #2 panel error boundaries + `app/error.tsx` / `global-error.tsx` · #3 Bid/Ask lines, bar countdown, stale chip · #4 Buy/Sell contrast (≥5.2:1) and a visible one-click armed state
- ✅ #5 feed timestamps, server clock offset, 5 s executable / 15 s stale rules, 2 s lag guard · #6 fail-safe env (no backend fallback, dev feed never trades in production, environment badge)
- ✅ #7 idempotency keys on place/close/modify, "unknown outcome" reconciliation (proxy returns 504 `outcome:'unknown'`; backend still needs to honour the key) · #8 live candles (every tick aggregated, late-tick merge, history refetch on focus/reconnect) · #11 stacked, typed toasts with screen-reader regions and a hidden-tab title count
- ✅ Single volume rule + server-side order validation · runtime kill switch (`TRADING_MODE`, `HALTED_SYMBOLS`, close-only) · gentler 401 (confirm once, keep account, one-step reconnect) · 15-minute inactivity lock for real accounts · security headers (CSP report-only) · proxy origin checks, rate limits, client IP, request ids, structured logs · `/api/health`, `/api/ready`, `/api/trading/status` · CI workflow · per-frame tick batching, page no longer re-renders per tick · practice leader tab, change-only storage writes, history cap · stop-out closes the largest loser first, balance floored at 0 · quote parity (one executable quote) · Deposit button wired · unused packages removed
- ⏳ Not yet: #9 tick-by-tick connected P&L, #10 pips/$/% SL-TP, #12 margin tiers and risk strip, HttpOnly token storage, parallel-safe practice replay after sleep, Phase 2 and 3 items.

---

## Top 12 highest-leverage moves

Some small fixes also score 3 but affect less of the product: iOS zoom, focus return and the 10px text minimum. They are listed under Quick wins instead.

**1. Stop the chart shrinking on 1366×768 laptops**: impact 5 · **S** · no backend · score 5.0
- **What:** Replace the six conflicting `grid-template-rows` rules with one `clamp(128px,22vh,220px)` activity row. Add one `@media (min-width:1181px) and (max-height:850px)` block after all base rules that merges the heading and toolbar into a 44px row and overlays the caption. Start with Activity collapsed when `innerHeight < 800`.
- **Why:** On the most common trading-laptop screen the chart is about 130–150px tall, smaller than the activity table.
- **Where:** `globals.css:2983` (an unconditional 196px, last in the file, overrides 2513/2731), `globals.css:2503-2546`, `TradingChart.tsx:64-65,79`, `useWorkspaceStore.ts:55`.

**2. Error boundaries per panel, plus `app/error.tsx` and `global-error.tsx`**: impact 4 · **S** · no backend · score 4.0
- **What:** Add a `PanelBoundary` that resets when the active symbol or account changes. Wrap MarketWatch, TradingChart, OrderEntry and PositionsTable separately and leave Header and Footer outside. The fallback says "Chart couldn't render · Reload panel · Your positions are unaffected" and logs the panel name.
- **Why:** Today one render exception in the chart blanks the whole screen, including the Positions table and its Close buttons.
- **Where:** `page.tsx:98-103`, `layout.tsx:37`. `src/app` has no `error.tsx`, `src` has no ErrorBoundary, and `route.ts:109` catches errors without logging them.

**3. Bid and Ask lines, a bar-close countdown, and a stale/closed chip for each symbol on the price axis**: impact 4 · **S** · no backend · score 4.0
- **What:** Add two persistent IPriceLines, a solid Bid and a dashed Ask, updated with `applyOptions`. An axis chip counts down to the bar close (mm:ss). It switches to "Stale 42s" after 10s with no tick, and to "Market closed" using the 17:00 New York roll, which moves with daylight saving. Add on/off toggles to chart settings.
- **Why:** Buy limit and stop orders trigger on the ask. A chart that shows only the bid makes a buy limit look filled when it isn't.
- **Where:** The ask appears only on the Buy button (`ChartTradeControls.tsx:78`). Staleness is only tracked globally (`FooterBar.tsx:22-30`). The lines go in `useChartEngine.ts`, and the countdown uses the server clock from #5.

**4. Buy/Sell button safety: readable contrast and a clear one-click state**: impact 3–4 · **S** · no backend · score 3.5
- **What:**
  - Use dark-theme Buy/Sell colours with at least 4.5:1 contrast against white, e.g. `#218048` / `#c23b48`. On hover, darken with `color-mix(… 88%, #000)` instead of `brightness(1.08)`.
  - Add the missing `.one-click-active` rule, a lime ring and a "1-CLICK" chip that never collapses. Label the buttons "Buy now" / "Buy…".
  - Add `tests/contrast.test.mjs`, which reads the colour tokens and checks contrast.
- **Why:** In the default dark theme, white text on the Buy button (#2f9a5e) is 3.56:1, and 3.09:1 on hover. Between 1181 and 1500px wide, one-click being on is shown only by an icon tint.
- **Where:** `globals.css:51-52, 2848-2859, 2644, 2687`, `ChartTradeControls.tsx:75-79` (the class is set at :79 but no CSS rule exists).

**5. Use the feed's server timestamp, one clock offset, and a stricter rule for sending orders on a quote**: impact 3 · **S** · no backend · score 3.0
- **What:**
  - Parse the fifth feed field and store `sourceTs`, `receivedAt` and `lagMs`.
  - Add `lib/serverClock.ts` (a rolling median offset, falling back to the HTTP `Date` header) and a `serverNow()` used for candle bucketing, the footer "UTC" clock and the "Today" filter.
  - Add `QUOTE_EXECUTABLE_MS=5000` for sending orders and `QUOTE_STALE_MS=15000` for display.
  - Block orders when feed lag is over 2s, and show a one-time "your clock is 42s off" notice.
- **Why:** `mergeTick` silently drops every tick while the computer's clock is behind the last server bar. A 14-second-old quote currently counts as good enough to trade on.
- **Where:** `priceSocket.ts:28`, `usePriceStore.ts:13,22,35`, `chart.ts:101`, `FooterBar.tsx:72`. The 15s rule is copied at `FooterBar.tsx:30`, `useOrderSubmit.ts:50`, `OrderEntry.tsx:70,72`, `WorkspaceTools.tsx:43` and `practice.ts:27`.

**6. Environment separation that fails safe**: impact 3 · **S** · no backend · score 3.0
- **What:**
  - Add `lib/env.ts`, checked at startup in `instrumentation.ts`. Require `DEPLOY_ENV` and `FEED_ENV`, and in production an https `BACKEND_URL` on an allowlisted host. Fail at boot if anything is missing.
  - Trading is allowed only when both are `production`; this replaces the `mock-ws` substring test.
  - Show an amber STAGING ribbon and title prefix outside production.
  - Remove the hard-coded onrender fallback, serve email previews only outside production, and remove the zip from `public/`.
- **Why:** The server trading gate skips the development-feed guard the browser applies. A misconfigured deploy would send real traders to the development backend.
- **Where:** `route.ts:34-45`, `market.ts:120-123`, `mobileSocket.ts:39`, `FooterBar.tsx:65`.

**7. Orders that can't be sent twice, and a clear answer when the outcome is unknown**: impact 5 · **M** · **backend: dedupe on the key and echo `clientOrderId`** (the client side works without it) · score 2.5
- **What:**
  - Create one `crypto.randomUUID()` per confirmed action and send it as an `Idempotency-Key` header and as `clientOrderId` on place, exit, modify and partial close.
  - In `route.ts`, a timeout returns 504 `{outcome:'unknown'}` and a failure before sending returns 502 `{outcome:'not_sent'}`.
  - The ticket shows "Verifying order…" and checks open orders and history for up to about 30s, matching on `clientOrderId` (or on symbol, side, lots and time until the backend echoes it). It ends with "Order found #123" or "Order not found. Safe to retry." The same order can't be resent meanwhile.
  - Move the in-flight guard to module level so the ticket and chart share it.
- **Why:** After the 25s proxy timeout, the trader sees "temporarily unavailable. Please try again." for an order that may have filled. Clicking again doubles the position.
- **Where:** `useOrderSubmit.ts:26-27,59`, `market.ts:115-118`, `route.ts:85,110-115`, and the generation discard in `tradingApi.ts`'s baseQuery.

**8. Live candles that stay correct**: impact 5 · **M** · no backend · score 2.5
- **What:**
  - Move tick aggregation into `services/candleFeed.ts`, fed directly from the socket and the practice tick. Every tick updates high, low and close, including while the tab is hidden; the animation frame only draws.
  - Merge a tick that arrives less than one bar late into the last bar instead of dropping it.
  - After a reconnect, or when the tab has been hidden for at least one bar, refetch history and splice it in. Add `refetchOnReconnect` and `refetchOnFocus`.
  - Add tests for bursts, gaps and clock skew.
- **Why:** Browsers pause animation frames in hidden tabs, so bars and wicks from that time are lost. In the foreground, several ticks in one frame collapse to the last one. The chart then looks different after a reload, and practice fills can happen at prices the chart never showed.
- **Where:** `useChartEngine.ts:182-200` (the frame is cancelled at :199), `chart.ts:101`, `TradingChart.tsx:42`.

**9. Tick-by-tick P&L, equity and margin level for connected accounts**: impact 5 · **M** · no backend · score 2.5
- **What:**
  - Add `lib/livePnl.ts` with `livePositionPnl()`, which uses `moneyAt` with the closing-side quote. It returns undefined for pairs it can't convert to USD and for non-USD accounts.
  - Compute live equity as server balance + the sum of live P&L, then recompute free margin and margin level.
  - Show a "live" dot. Hovering shows the last server value, and each poll reconciles.
  - "Close profitable" and "Close losing" use live P&L at confirmation and list the exact tickets.
- **Why:** P&L trails price by 5s and equity by 15s. It is the most visible sign of a non-professional terminal, and it can put the wrong positions into a "close profitable" run.
- **Where:** `page.tsx:74-80` (equity comes only from the 15s query at :78), `risk.ts:8`, the USD check at `FooterBar.tsx:21`.

**10. Set SL/TP in pips, $ or % of equity, and show pip value and spread in pips**: impact 5 · **M** · no backend · score 2.5
- **What:**
  - Add `pipSize` to INSTRUMENTS (majors 0.0001, JPY 0.01, XAU 0.1, XAG 0.01, crypto 1), preferring backend metadata when it exists.
  - Add `pipValue`, `levelFromOffset` and `offsetFromLevel` to `risk.ts`.
  - Store SL/TP drafts as `{mode, value}` and recompute the price from the live quote every render.
  - Add a Price · Pips · $ · % switch, with a hint under each field such as "1.11420 · −22.0 pips · −$22.00 · 0.22%".
  - Show "Spread 1.2 pips" and "Pip value $10/lot", add a $/% toggle to size-by-risk, and show the pip distance in the Positions SL/TP cells.
- **Why:** MT5 and cTrader traders set stops as "20 pips" or "0.5% risk". Today, switching Buy to Sell keeps a stop that validation then rejects.
- **Where:** `OrderEntry.tsx:79-85,203-209,297-326`, `market.ts:2-67` (no pipSize, although `types/trading.ts:12` and `contracts.ts:53` have it), `risk.ts:4-10`, `ChartDraftProtection.tsx:17`, `PositionsTable.tsx:462-473`.

**11. One notification system: stacked toasts with the right type, every stop-out reported, alerts in background tabs**: impact 4 · **M** · no backend · score 2.0
- **What:**
  - Replace the single `notice` with a queue of events, each with an id, kind (fill, SL, TP, stop-out, reject, alert, feed, session), severity, symbol and order id.
  - Show at most 3 stacked toasts. Errors and stop-outs stay until dismissed, hovering pauses the timer, and a repeated message shows a "×3" counter.
  - The practice tick reports every changed order and groups stop-outs, e.g. "Stop-out: 5 positions closed · −$842.10".
  - Keep two screen-reader regions always mounted (polite, and alert).
  - Optionally send a browser Notification and add a "(2)" title badge while the tab is hidden.
  - Correct the toast types that are wrong today.
- **Why:** A stop-out that closes N positions shows one toast. A second fill overwrites the first. SL hits and errors show a green success check, and nothing reaches a background tab.
- **Where:** `useWorkspaceStore.ts:31-32,76`, `WorkspaceTools.tsx:32-36,46-48,101-113`, `usePracticeStore.ts:52-56` (uses `find`), `MarketWatch.tsx:201,312-314,333`, `tradingApi.ts:47-49`, `globals.css:2534`.

**12. Margin-level warning tiers and an account risk strip**: impact 4 · **M** · no backend (connected accounts use backend thresholds when the backend provides them) · score 2.0
- **What:**
  - Add `lib/accountRisk.ts` with `marginTier` (200% or more ok, under 200% warn, under 100% margin call, 50% stop-out) and `projectMarginLevel`.
  - The footer leads with Equity, then signed floating P&L. Margin level becomes a coloured chip using the existing `--mm-warn` tokens, with a bar showing distance to stop-out.
  - At margin call, a sticky banner reads "Margin call · 92% · stop-out at 50%" with Close losing and Close all, reusing the bulk-close confirmation.
  - The ticket shows "Margin level after trade 340% · Risk 1.2% of equity", and connected accounts use `AccountDetails.leverage` for the margin estimate.
  - Terms get short definitions on tap, and phones keep Equity, P&L and Margin level.
- **Why:** A practice account goes from no warning to fully closed out. Margin level is a plain number today and is hidden on phones.
- **Where:** `practice.ts:176-184`, `FooterBar.tsx:34-52`, `globals.css:22,25,47,50,2984-2987`, `OrderEntry.tsx:103,333-346`, `types/trading.ts:118`.

---

## Elite trader experience

- **Risk limits (prop-firm style):** daily loss ($/%), maximum risk per trade and maximum open lots. When a limit is hit, Buy/Sell lock with "Daily loss limit reached · resets 00:00 UTC" and closing stays available. Enforced in practice, advisory for connected accounts. `practice.ts:61-66` checks only free margin, and nothing in src tracks daily loss or drawdown. **M**
- **Position action menu:** Move SL to break-even (entry ± spread buffer), Reverse (a single-step `reversePractice`; connected accounts get a review dialog that explains a partial failure), and Add (fills the ticket). Also change the validation text to "current price". `PositionsTable.tsx:483-513`, `ChartPositionDock.tsx:42-44`, `practice.ts:69`, `contracts.ts:79-82`. **M**
- **Connected account events socket:** replace the unused `mobileSocket.ts` with `accountEvents.ts`. It reconnects with backoff and jitter, has a heartbeat, filters to the active account, removes duplicates, refreshes Orders/Account/History, shows a sticky banner for MARGIN_CALL and STOP_OUT, and lets polling slow to 15–30s. `mobileSocket.ts:1-19,37,42`. **M** · **backend** (token outside the URL, via a first-message auth or a stream ticket)
- **Realistic practice prices on one price path:** a seeded `practiceFeed.ts` with per-asset volatility (EURUSD about 7% … BTC about 55%), mean reversion, jumps and a wider spread at rollover. History comes from the same generator, so chart, ticks and fills agree across timeframes and reloads. `usePracticeStore.ts:44-47` (a ±0.021% sine wave), `chart.ts:55-76`, `TradingChart.tsx:44`. **M**
- **Market hours and sessions:** a `sessions.ts` with New York schedules that follow daylight saving. Closed markets get a watchlist pill and "Market closed · opens Sun 22:00 UTC (in 14h)" on the chart. Market orders are disabled while pending orders are still allowed. The footer tells "Markets closed" apart from "Feed stale" and shows a Sydney/Tokyo/London/NY strip. Practice holds prices for closed markets and applies the weekend gap on reopen. `usePracticeStore.ts:41-48`, `OrderEntry.tsx:155-157`, `FooterBar.tsx:62-63,71-73`. **M**
- **Performance tab:** win rate, profit factor, expectancy (in $ and R), maximum drawdown, streaks and holding time, broken down by symbol, side and hour, with an equity curve. Adds a "Today +$123.40" chip to the account selector. The only total today is `PositionsTable.tsx:520-527`. **M**
- **Trade detail dialog:** timeline, first and final SL/TP, R multiple, slippage, worst and best price during the trade (MAE/MFE), and swap/commission. The CSV gains SL, TP, Reason, Pips, Duration and R. Today an edit overwrites SL/TP at `practice.ts:89`. **M** · **backend** (closedAt, exitPrice and closeReason)
- **Instrument spec sheet and a fuller watchlist:** an (i) button shows contract size, pip value, min/max/step lots, spread, leverage, margin per lot, swaps and trading hours. An optional wider watchlist adds Ask, Spread and Day high/low. `types/trading.ts:3-22` (the fields exist but nothing shows them), `MarketWatch.tsx:75-90,86-88`. **M**
- **Drawing tools and alerts on the chart:** horizontal line, ray, trendline, rectangle, fib, measure (in pips) and text, each built as a chart primitive anchored to {time, price} and saved per symbol. Alerts appear as draggable bell lines, with "Add alert at…" on the price axis. `TradingChart.tsx:64`, `WorkspaceTools.tsx:55-58` (the altKey guard needs relaxing for the new hotkeys). **L**
- **Indicator engine:** multiple instances (e.g. EMA 20/50/200), MACD, ATR in pips, Stochastic, Donchian and daily pivots, extra oscillator panes that stay in sync, and presets. `indicators.ts:2,8-9`, `useChartEngine.ts:65-69,75-78`. **L**
- **Intervals and time zones:** 30m, 1W and 1M. Daily bars roll at 17:00 New York (following daylight saving, so no Sunday stub bar) and weeks start at the Sunday open. Add a time-zone picker and session-break lines. `market.ts:103-110`, `chart.ts:99,122`, `useChartEngine.ts:60`. **M**
- **More chart types without losing the view:** Candles, Hollow, Bars, Heikin Ashi, Line, Area and Baseline. Switching swaps only the main series, so zoom and pan are kept. `useUIStore.ts:12,71`, `useChartEngine.ts:147-151,164-166`. **M**
- **Saved chart layout per symbol:** timeframe, chart type, zoom, Log/% scale and studies, plus templates. `useUIStore.ts` isn't persisted, and see `useChartSettings.ts:9-15` and `useChartEngine.ts:164-166`. **M**
- **Load older bars when scrolling left:** detect the left edge, request with `end_date` and add the bars without the view jumping. `tradingApi.ts:191-201`, `route.ts:58`, `chart.ts:115`. **M** · **backend** (confirm what `end_date` does and how many bars a page returns)
- **Exit plans (practice only):** trailing stop, automatic break-even at +R, and "take 50% at TP1". Hidden for connected accounts until the server supports them. `practice.ts:6-17,146-186`. **M**
- **Pending order lifecycle:** expiry (GTC, Today or a date), stop-limit and OCO pairs. `PositionsTable.tsx:439`. **L** · **backend** for connected accounts
- **Trade journal:** a note, tags and a rating per trade, a tag filter, stats by tag in Performance, and CSV columns. There are no such fields at `practice.ts:6-17` or `contracts.ts:14-22`. **M**
- **Multiple charts and symbol compare:** 1, 2 or 4 panes with linked symbol and crosshair, and a % compare overlay. `page.tsx:100`, `TradingChart.tsx:25,30`. **L**
- **First-run practice guide:** the trader explicitly chooses one-click or review first, then 4 guided steps and a sample 0.01 EURUSD trade with SL and TP placed through the real order path. One-click is on by default today (`useWorkspaceStore.ts:53`, `ChartTradeControls.tsx:68-69`). **M**
- **Open from the client portal, with 2FA for risky actions:** a PKCE code handoff behind "Open in Web Terminal", and a fresh portal OTP for connected one-click and the first real-account order in each 12 hours. `LoginModal.tsx:154-182`. **L** · **backend**

## UI that looks and feels premium

- **Prices with enlarged pip digits:** `splitPrice()` renders head, large pip digits and a raised tail in the ticket, chart dealing bar and chart heading, with a spread pill between Sell and Buy. `OrderEntry.tsx:198`, `ChartTradeControls.tsx:76,78`. **M** (needs pipSize from #10)
- **`LivePrice` component:** a 450ms flash on each tick (at most every 250ms), a direction arrow, and grey text with a tooltip when stale. Price direction is computed at `usePriceStore.ts:36-41` but nothing displays it, and the watchlist status dot never gets its "connected" colour (`MarketWatch.tsx:359`). **M**
- **One number and time formatter:** `lib/format.ts` shows money with a true minus sign, thousands separators and "—" for missing values, and a UTC / Local / Server time setting. All numeric columns get right alignment. It replaces 6 formatters: `OrderEntry.tsx:37-38`, `PositionsTable.tsx:33-44`, `ChartPositionOverlay.tsx:14`, `ChartPositionDock.tsx:41`, `AccountSwitcher.tsx:18-22`, `FooterBar.tsx:44-49`. **M**
- **Type scale and density modes:** size tokens, a 10px minimum enforced by a test, and compact/comfortable density. 51 declarations are 7–9px, the minimum-size rule covers only 6 selectors (`globals.css:2976-2982`), and table text gets smaller on larger screens (2583 vs 2627). **M**
- **Chart legend and crosshair:** two rows (OHLC, change, range in pips, time) plus value chips per indicator, and a crosshair synced both ways with the RSI pane. `TradingChart.tsx:70`, `globals.css:2478,2551`, `useChartEngine.ts:62`. **S**
- **Chart colours from theme tokens, and a colour-vision mode:** `--chart-*` tokens, Standard / Blue–orange / Monochrome, and hollow up-candles. Colours are hard-coded at `useChartEngine.ts:61,65,68-69,174-176`, and in light mode the indicator lines are only about 2.1–2.8:1. **M**
- **Skeleton placeholders:** skeleton rows in the watchlist and Activity, the previous chart kept dimmed with a lime progress bar while a timeframe loads, and pill placeholders for balances. `MarketWatch.tsx:277-281`, `TradingChart.tsx:44,74`, `AccountSwitcher.tsx:19,41`. **M**
- **One token file, re-synced with the portal:** also adds radius, shadow and motion scales and removes the duplicate `:root` blocks. `docs/terminal-design.md:6`. **M**
- **Field focus rings and consistent icons:** a `:focus-within` ring on compound fields, and one meaning per icon. SlidersHorizontal is used for 4 different things, and RefreshCw is both a spinner and a refresh action. `globals.css:106-112,1115,1127-1135`, `Header.tsx:22`, `MarketWatch.tsx:221`, `PositionsTable.tsx:496`. **S**
- **No dark flash on load:** a small inline `<head>` script that respects `prefers-color-scheme`, plus a `color-scheme` rule and `viewport.themeColor`. `layout.tsx:18-23`, `theme.ts:14,33-37`. **S**
- **Better chart snapshots:** a branded header, the RSI pane, trade labels and the legend, with Download, Copy and Share. `useChartEngine.ts:129`, `TradingChart.tsx:62`. **S**
- **Phone Activity parity:** a "Floating +$23.10 · 3 positions" bar, a ⋯ sheet with the bulk actions, a compact footer with margin level and a feed dot, and an amber "Prices paused" strip. `globals.css:2106-2123,2984-2987` (`.activity-actions` hidden). **M**
- **Swipe to close, and 44px touch targets on phones.** `PositionsTable.tsx:423-517`, `ChartPositionDock.tsx:42-44`, `globals.css:2355-2368,2706-2723`. **M**
- **Order ticket as a bottom sheet on phones:** the chart review would show USD risk, reward:risk and margin like the ticket does. `globals.css:1369-1379`, `ChartTradeControls.tsx:85`, `OrderEntry.tsx:424-433`. **L**
- **Landscape layout and installable app:** `viewportFit: cover`, a left-side nav in landscape, a manifest with icons, and an offline state. `globals.css:296` (`min-height:400px` pushes the nav off-screen in landscape). **M**
- **Keyboard and screen-reader flow:** return focus to the next Close button after a close, stable row keys, arrow-key tabs, and watchlist labels that include the bid. `Dialog.tsx:22,30,49`, `PositionsTable.tsx:230-240,427`, `MarketWatch.tsx:64-69`. **S**

## Robust system

- **One volume check for every order path, plus server-side order validation:** `lib/volume.ts` is shared by the ticket, chart, submit path and partial close. `orderSchema.ts` rejects bad payloads in `route.ts` with a 422. Map `min_lot`, `max_lot` and `lot_step`, and force the review dialog for oversized orders (a "fat-finger" check). `ChartTradeControls.tsx:62-65` hard-codes 0.01–100 lots, `useOrderSubmit.ts:47-54` never checks volume, and `route.ts:75-77` only parses the JSON. **M**
- **Kill switch that works without a rebuild:** `GET /api/trading/status` reports enabled, close-only or halted, plus a list of halted symbols. `route.ts` enforces it and still allows closes in close-only mode, and the terminal shows an amber banner. Today the flag is baked into the bundle at build time (`market.ts:122-123`), and the single switch at `route.ts:34-45` also blocks closes. **M**
- **Stop whole-screen re-renders on every tick:**
  - Batch price ticks once per animation frame.
  - Subscribe to the fields each component needs instead of whole stores, and move the ticket draft into a `useTicketDraft` store.
  - Memoise the four panels, and replace the separate 1s timers with one shared clock.
  - Evidence: `usePriceStore.ts:25-44`, `page.tsx:37-40`, `PositionsTable.tsx:63`, 10 whole-store `useUIStore()` calls, and timers at `OrderEntry.tsx:74-78` and `FooterBar.tsx:25-29`.
  - **M**
- **Update the chart per tick instead of recomputing everything:** update the last bar in place and update indicators incrementally, and skip disabled indicators. Add tests proving the result matches a full recompute. `useChartEngine.ts:81,130-147,182-199`, `chart.ts:103-104`. **M**
- **Feed health:** clear connection states (live, reconnecting with the attempt number, offline, stalled), quote age per symbol, and a watchdog that re-subscribes or reconnects when a symbol goes quiet. Shows "Reconnecting (3) · Retry now". `FooterBar.tsx:23,30`, `MarketWatch.tsx:58-61`, `priceSocket.ts`. **M**
- **Safer practice data:** keep the account in memory instead of re-reading storage every second, validate each order separately and back up the raw data before any reset, add version migrations, and cap closed history at 1,000 records. `usePracticeStore.ts:9-18,49,74`, `practicePersistence.ts:6-7`, `practice.ts:58-59`. **M**
- **Practice across several tabs:** only one tab runs the simulator, writes are locked, events are shared between tabs, and missed stops are replayed after the tab was throttled or the computer slept. `PracticeSession.tsx:9-19`, `usePracticeStore.ts:58-72`, `useWorkspaceStore.ts:90-100`. **M**
- **Gentler session expiry:** keep the account details and mark it "Session expired · Reconnect", keep the order draft, and re-check once before treating a 401 on a background poll as expiry. `tradingApi.ts:35-51`, `accountSessions.ts:74-77`, `useUIStore.ts:66`. **M**
- **Lock real accounts after inactivity:** after 15 minutes idle, blur balances and positions, turn one-click off and pause polling; unlocking needs the trading password. `useOneClick.tsx:8-9`, `accountSessions.ts:46`, `PositionsTable.tsx:72`. **M**
- **Smarter polling:** one owner for polling, pause in hidden tabs (`skipPollingIfUnfocused`), back off after errors (5s up to 60s), and show "Updated 3s ago". Two separate 5s pollers today: `page.tsx:69-72` and `PositionsTable.tsx:70-75`. **S**
- **Parallel bulk close:** run up to 4 closes at once, show "Closing 3 of 10…", then list each failure with its reason and a Retry failed button. The loop at `PositionsTable.tsx:183-190` runs one at a time. **M**
- **Stop "Add symbols" subscribing to the whole catalogue:** subscribe only to rows on screen, render only visible rows, and debounce the search by 150ms. `MarketWatch.tsx:289-290`. **S**
- **Security headers:** a Content Security Policy (report-only first), `frame-ancestors 'none'` and HSTS. If the terminal is loaded inside a frame, turn one-click off. `next.config.mjs:1-14`, and there is no middleware. **M**
- **Proxy abuse controls:** accept only same-origin JSON requests, check the size before reading the body, forward the client IP, and add rate limits (login: 5 per minute per IP). The login dialog shows how long to wait. `route.ts:14,64-78`, `LoginModal.tsx:48-77`. **M**
- **Keep account tokens out of JavaScript (HttpOnly cookies via the proxy).** Must ship together with the proxy origin checks. `accountSessions.ts`, `route.ts`. **L**
- **Observability:** a request id on every proxy call, one JSON log line per request, `/api/health` and `/api/ready`, server error reporting in `instrumentation.ts`, and an order round-trip time metric. `route.ts:109` currently catches errors silently. **M**
- **Typed backend responses:** normalise orders as they arrive (`normalizeOrder`), type the account data, and turn on `noUncheckedIndexedAccess`. **M**
- **CI and proxy tests:** move the proxy rules into `proxyPolicy.ts` and test path traversal, wrong methods, the trading gate and the 16KB limit. Add `.github/workflows/ci.yml` with `npm audit` and a header check. There is no `.github` folder, and `package.json:9` only type-checks. **S**
- **Better test setup:** Vitest with React Testing Library and MSW for `useOrderSubmit` and `route.ts`, plus Playwright end-to-end tests in practice mode with a fixed clock. Today's tests hand-transpile TypeScript (`practice.test.mjs:5-8`). **L**
- **ESLint with React hooks rules, and Prettier:** fix the favourites effect race and split lines of JSX over 1,000 characters. `MarketWatch.tsx:135-151,168`, `ChartTradeControls.tsx:85`, `TradingChart.tsx:65`. **M**
- **Split globals.css:** into ordered layers with one set of breakpoints and a CSS check test, taking reference screenshots at 5 screen sizes before and after. The `.terminal-workspace` grid alone is declared 10 times. **L**
- **Remove dead code:** unused `axios`, `clsx`, `tailwind-merge`, `DepositModal` and `ProfileModal`, and the `createDemoAccount` endpoint the proxy never allows. Add knip to catch more. `tradingApi.ts:77-91`, `route.ts:13-18`. **S**
- **Faster first load:** import socket.io only when needed, load the chart with `next/dynamic`, use `next/font`, and set a bundle size budget. `layout.tsx:25-34`. **S**

---

## Quick wins (under a day each)

- **Laptop chart height:** one grid-row rule and the short-screen block (`globals.css:2983`). *(#1)*
- **Buy/Sell colours:** dark tokens plus a hover that darkens instead of lightening (`globals.css:51-52,2855,2859`), and a `.one-click-active` style (`ChartTradeControls.tsx:79`). *(#4)*
- **Buy/Sell arrow icons are swapped** (Sell uses ↗, Buy uses ↙). They're hidden by CSS today but wrong (`ChartTradeControls.tsx:76,78`).
- **Clear SL/TP when the trader switches between Buy and Sell** (`OrderEntry.tsx:79-85`).
- **Report every closed position in the practice tick,** looping instead of `find`, and group the stop-out message (`usePracticeStore.ts:52-56`).
- **Correct the wrong toast types:** errors and alerts currently show as success (`MarketWatch.tsx:201,312-314,333`, `tradingApi.ts:47-49`, `WorkspaceTools.tsx:46-48`).
- **Toast covers the footer at 1180px and below:** fix the more specific rule that wins (`globals.css:2534`).
- **Keep the feed timestamp** instead of discarding it (`priceSocket.ts:28`, `usePriceStore.ts:22,35`). *(first step of #5)*
- **Reload chart history on reconnect and focus** (`TradingChart.tsx:42`).
- **Watchlist status dot:** drive it from the connection and staleness (`MarketWatch.tsx:359`).
- **Pip size and spread in pips:** add `pipSize` and a `pips()` helper, then show "Spread 1.2 pips" instead of "price units" (`market.ts:2-67`, `OrderEntry.tsx:203-209`).
- **Error boundaries for the four panels** (`page.tsx:98-103`). *(#2)*
- **Theme set before first paint,** plus `color-scheme` and `themeColor` (`layout.tsx:18-23`).
- **iOS zoom:** 16px text in inputs on touch screens, and a "done" enter key on lots, entry, SL and TP (`OrderEntry.tsx:227-236,263-270,299-318`).
- **Focus return after a close,** and open the alert dialog with the price field focused (`Dialog.tsx:30,49`).
- **Screen-reader fixes:** stable row keys (`PositionsTable.tsx:427`), a `describedby` target that always exists (`OrderEntry.tsx:367,372`), and watchlist labels that include the bid (`MarketWatch.tsx:64-69`).
- **Validation wording:** say "current price" when the check is against the market (`contracts.ts:79-82`).
- **Chart lot limits:** use the instrument's limits instead of the fixed 0.01–100 (`ChartTradeControls.tsx:62`), and read `min_lot`, `max_lot` and `lot_step` (`contracts.ts:46-57`).
- **Pause polling in hidden tabs** and remove the duplicate 5s poller (`page.tsx:69-72`, `PositionsTable.tsx:70-75`).
- **Skip the practice account update** when nothing changed that second (`usePracticeStore.ts:49-51`).
- **Remove unused packages** (`axios`, `clsx`, `tailwind-merge`) and the endpoint the proxy never allows (`tradingApi.ts:77-91`).
- **Remove the hard-coded onrender fallback** and require the API URL setting (`mobileSocket.ts:39`).
- **Anti-framing headers:** `X-Frame-Options: DENY`, `frame-ancestors 'none'` and `poweredByHeader:false`, and turn one-click off when framed (`next.config.mjs`).
- **Raise text below 10px to 10–11px** (`globals.css:2096,2478,2551,2644,2702,2717`).
- **Invalid JSON sent to the proxy** returns 502; it should return 400 (`route.ts:75-77`).

---

## Suggested order of work

### Phase 1: Harden (make today's terminal trustworthy before real trading is switched on)
- **Items:**
  - Top 12: #1, #2, #4, #5, #6, #7, #8, #11.
  - From the themed lists: single volume check and server-side validation, kill switch, gentler session expiry, inactivity lock, security headers (report-only), proxy abuse controls, CI and proxy tests, whole-screen re-renders, safer practice data, smarter polling, observability.
  - Most quick wins.
- **Why first:**
  - Real trading is off today behind `TRADING_ENABLED`. Each item here prevents a doubled, oversized or wrongly routed order, or lost user data.
  - These items also build shared pieces the later phases use: `serverClock`, `candleFeed`, the notification system, `useTicketDraft` and `volume.ts`.

### Phase 2: Differentiate (the features traders compare against MT5 and cTrader)
- **Items, in this order:**
  - **#10 pips/$/% first.** Its `pipSize` is needed for enlarged pip digits, the spec sheet, ATR in pips, the measure tool and trailing distances.
  - **Realistic practice prices, market hours and multi-tab practice.** One price path is needed before break-even, trailing and stop-out mean anything, and before missed stops can be replayed.
  - **Account and risk:** #9, #12 with risk limits, #3, position action menu, and the account events socket (which feeds the notification system from Phase 1).
  - **Supporting items:** feed health, the unified formatter and time-zone setting, and phone Activity parity.
  - **Chart and history:** intervals with New York-close daily bars, chart types without losing the view, saved layouts per symbol, the Performance tab and the trade detail view. Drawing tools come last in this phase because they use the pips and saved-layout work.
  - **Token security:** HttpOnly token storage, shipped together with the proxy origin checks from Phase 1.
- **Why this order:** Every item builds on Phase 1 pieces. The ones that other features depend on (pipSize, the practice price generator, sessions) come first.

### Phase 3: Delight (premium look and the larger features)
- **Items:**
  - **Start with the globals.css split and the single token file,** using reference screenshots at 5 screen sizes.
  - **Look and feel:** type scale and density, enlarged pip digits, LivePrice, chart colours and colour-vision mode, legend, skeletons, snapshots, focus rings and icons.
  - **Phone:** swipe to close, the bottom-sheet ticket, landscape layout and installable app.
  - **Larger features:** first-run guide, journal, exit plans, pending order lifecycle, indicator engine, multiple charts, loading older bars (after the backend confirms `end_date`), and opening from the portal with 2FA.
- **Why last:**
  - Visual fixes are cheap and safe only once the CSS is de-duplicated. Today later rules silently override fixes, as `globals.css:2983` shows.
  - The large chart features rely on the per-tick chart updates and saved layouts from Phases 1–2.
  - Opening from the portal needs the HttpOnly token storage from Phase 2.
---

## Gaps found by the completeness review

- **Chart, Activity and ticket show different prices for connected accounts (quote parity)** · **S** · no backend
  - **Evidence:**
    - `accountQuote()` (`contracts.ts:104-120`) rebuilds the account ask as bid + `spreadPips × pipSize`. Only `OrderEntry.tsx:64` and `useOrderSubmit.ts:49` call it.
    - The chart dealing bar uses the raw feed quote (`ChartTradeControls.tsx:26,29`). That raw ask is the Buy price it shows (:78), the price it validates against (:50,57) and the price `pendingAtPrice` classifies against (:56).
    - `PositionsTable.tsx:120-123` values SELL positions at the raw ask, and `TradingChart.tsx:27` also uses the raw tick.
    - **Result:** on an account with a spread markup, the chart shows one Buy price and the ticket another. A chart-picked entry between the two is called LIMIT by the chart, then submit rejects it as "wrong side of the market". Floating P&L on SELL positions looks better than it is.
    - The roadmap's Bid/Ask lines (#3) and live P&L (#9) would be built on the same raw quote.
  - **Proposal:**
    - Add `lib/quotes.ts` with `useExecutableQuote(symbol)`, one selector for practice, preview and connected.
    - Use it everywhere a price is shown or checked: ticket, chart dealing bar, `pendingAtPrice`, Positions current price, alerts, #3 and #9.
    - Add a test that the chart and the ticket get the same `{bid, ask}` from the same inputs.

- **Account currency and cross-pair conversion are left out; the roadmap accepts "—"** · **M** · no backend
  - **Evidence:**
    - `moneyAt` (`risk.ts:8`) returns undefined for every cross (EURGBP, EURJPY, GBPJPY and so on). It also always assumes a USD account.
    - The ticket labels amounts with `$` through `usd()` (`OrderEntry.tsx:37-38`). The review dialog shows these at :424, :428 and :432 even when `AccountDetails.currency` (`types/trading.ts:119`) is EUR.
    - `PositionsTable.tsx:118` blanks the P&L currency for connected accounts, although `FooterBar.tsx:21` already reads it.
    - Roadmap #9 and #10 both accept "undefined for crosses and non-USD accounts". A trader on crosses or a EUR account would get "—" for risk, pip value, live P&L and size-by-risk.
  - **Proposal:**
    - Add `lib/fx.ts` with `convert(amount, from, to, quotes)`. It uses the direct or inverse leg, or goes through USD when neither exists.
    - Add `conversionSymbols()`, which subscribes to the hidden legs it needs through the ref-counted `subscribeSymbol` (`priceSocket.ts:42`).
    - `moneyAt` returns the quote currency, then converts to the account currency. One `money(n, ccy)` formatter labels amounts.
    - Add an Activity "Exposure" tab: net lots, average price and P&L per symbol, and net notional per currency (e.g. "USD −212k · EUR +100k").
    - Tests: EURGBP on a EUR account, and USDJPY on a GBP account.

- **Execution quality: no slippage tolerance and no fill receipt** · **M** · **backend**
  - **Evidence:**
    - `TradeRequest` (`contracts.ts:14-22`) has no deviation or tolerance field.
    - A connected order ends with "submitted. Check Activity for its execution status" (`useOrderSubmit.ts:56`). The trader never sees the fill price next to the price they clicked.
    - Practice always fills exactly at the tick (`practice.ts:60`).
    - The roadmap covers unknown outcomes (#7) and mentions slippage only after the fact, in the trade detail dialog.
  - **Proposal:**
    - Record `requestedPrice` and `clickedAt` at the click.
    - Add a per-symbol "Max slippage (pips)" field to the ticket, sent as `maxDeviation`. If the price moves further, the backend rejects: "Requote: price moved 2.3 pips". Review mode then offers "Accept 1.11671".
    - After the fill, toast "Bought 1.00 EURUSD @ 1.11658 · requested 1.11654 · −0.4 pips · 182 ms".
    - Store requested price, fill price and latency on the order for the CSV and for "average slippage (positive vs negative)" in Performance. This also serves as a best-execution record.
    - Practice: optional 100–300ms latency, filling at the quote at that later moment.

- **Trading costs are invisible: spread, commission and swap** · **M** · **backend** (swap and commission rates)
  - **Evidence:**
    - `Order` has `swap` and `commission` (`types/trading.ts:67-68`), but PositionsTable never shows them (columns :418-474; CSV header :128).
    - The ticket summary (`OrderEntry.tsx:333-346`) shows margin and reward:risk but no cost.
    - Practice says "no commission or swap" (`OrderEntry.tsx:441`, `AccountSwitcher.tsx:72`), so holding a trade for a week costs nothing.
    - The roadmap mentions swap and commission only inside the trade detail dialog.
  - **Proposal:**
    - Add a ticket "Cost" row: "Spread $12.00 · Commission $7.00 · Swap −$3.20/night (×3 Wed)".
    - Add Swap, Commission and Net P&L columns to Positions. The totals row and the CSV use net P&L.
    - Practice: an optional swap charged at the 17:00 New York roll, tripled on Wednesday, from a static rates table.

- **No regulatory or client-protection layer** · **M** · **backend + compliance**
  - **Evidence:**
    - Searching src, README and docs for a risk warning, regulator, licence or "lose money" finds nothing.
    - The only disclaimer is "Prices can change…" (`OrderEntry.tsx:388-389`).
    - In practice, closing a trade adds its P&L to the balance with no floor (`practice.ts:94`), so the balance can go below zero.
    - The practice stop-out closes every position at once (`practice.ts:176-184`) instead of the largest loser first.
    - The roadmap's price jumps and weekend gaps would make a negative balance reachable.
  - **Proposal:**
    - The backend serves a `compliance` config for each account: entity, risk-warning text with its percentage, leverage caps by asset class and client category, restricted symbols, and whether negative-balance protection applies.
    - Show the risk warning permanently in the footer and in the review dialog.
    - Apply the leverage caps to margin estimates.
    - Restricted symbols show "Not available for your account" in the watchlist.
    - Practice: stop-out closes the largest loser first and re-checks after each close. The balance stops at 0, with an "NBP adjustment" row in history.

- **No way to deposit from the terminal, and the roadmap deletes the one that exists** · **S** · no backend
  - **Evidence:**
    - `DepositModal.tsx:5-16` (which opens `${CLIENT_PORTAL}/deposit`) is never rendered, and `depositModalOpen` (`useUIStore.ts:48-49,102-103`) is never set.
    - `Header.tsx:13-24` has no Deposit action, and the account switcher (`AccountSwitcher.tsx:67`) offers only "Manage accounts".
    - The roadmap's "Remove dead code" item lists DepositModal, and the #12 margin-call banner offers only Close losing and Close all.
  - **Proposal:**
    - Keep DepositModal and wire it up.
    - Add a lime "Deposit" pill in the header for live accounts, and a Deposit action in the account switcher.
    - Make Deposit the first action in the margin-call banner.
    - On an insufficient-margin rejection, show "Needs $412 more margin · Deposit or reduce to 0.62 lots".
    - Open the portal with `?account=&amount=<shortfall>`, and refetch the account when the terminal tab regains focus.
    - Practice: add "Open a live account" as a conversion prompt.

- **No economic calendar or warning before high-impact events** · **M** · **backend / data vendor**
  - **Evidence:** searching src for calendar, economic or news finds nothing relevant. The roadmap's sessions item covers market hours but not scheduled releases like NFP, which widen spreads and stop traders out.
  - **Proposal:**
    - Add `/api/calendar`, proxying a vendor with a 5-minute cache.
    - Add an Activity "Calendar" tab filtered to the currencies in the watchlist and open positions.
    - Add impact-coloured flags on the chart time axis showing actual, forecast and previous.
    - Show a ticket and one-click chip such as "USD NFP in 4 min · high impact", plus a badge on positions that are exposed.
    - Offer a "notify 15 min before" option. Practice widens its spread around events.

- **Release safety and client-side signals for a terminal left open for days** · **M** · no backend
  - **Evidence:**
    - `next.config.mjs:1-14` has no `deploymentId`.
    - `src/app/api` contains only the trading proxy, with no version endpoint.
    - src has no `onerror`, `unhandledrejection`, `sendBeacon` or web-vitals reporting; the only `console.error` is `mobileSocket.ts:71`.
    - docs/ has no runbook or SLO document.
    - The roadmap's `next/dynamic` chart and lazy socket.io add code chunks that will fail to load after a redeploy in a tab opened earlier. Its observability item is server-side only.
  - **Proposal:**
    - **(a) Deploy mismatch:**
      - Set `deploymentId` to the commit SHA and add `/api/version`.
      - Show "Update available · Reload", but never reload automatically while a review dialog or order draft is open.
      - When a panel fails to load its code, the panel boundary reloads that panel once.
    - **(b) Browser telemetry:** a sampled `/api/telemetry` beacon with no tokens or personal data. It reports JS errors (with panel and build), reconnects, quote age p95, click-to-acknowledgement latency, long tasks and web vitals.
    - **(c) Operations doc:** `docs/operations.md` sets SLOs: order acknowledgement p99 under 1s, quote age p95 under 2s, proxy 5xx under 0.5%.
      - A synthetic probe checks feed freshness and the proxy's read endpoints every minute.
      - Runbooks cover the kill switch, a feed outage and a backend rollback.
    - **(d) Journal tab:** a user-visible, MT5-style log of each request with time, clientOrderId, latency and result, plus "Copy diagnostics" for support tickets.