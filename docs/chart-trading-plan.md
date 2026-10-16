# Interactive terminal implementation

## Direction
Keep Movement Markets' charcoal (#0c0c0c), white (#ffffff), slate (#66717e) and lime (#b0f000) portal system. Green (#16a773) and red (#e05260) communicate price direction and trading actions; lime continues to identify navigation and the primary workflow. Inter remains the control/data face, Space Grotesk the instrument heading and Montserrat the wordmark.

The chart is the working surface. Fixed watchlist, chart and ticket positions remain; controls have clear text/tooltips and open only when needed. Avoid extra dashboard cards or marketing copy. Motion should explain a change: live quote updates, line-drag previews and brief action feedback. Respect reduced motion.

## Delivery
1. Refactor the chart lifecycle so quotes, indicators, theme changes and trade updates preserve zoom and pan rather than rebuilding the chart.
2. Red/green candles, crosshair OHLC readout, zoom controls and return to latest.
3. Configurable SMA, EMA, Bollinger Bands and Wilder RSI. RSI has a synchronized sub-chart. Persist study settings locally; calculate from the displayed candles. Do not invent volume data.
4. On-chart market buy/sell and lot size. Reviewed execution is default. One-click practice trading is opt-in, not persisted, and disabled when switching account mode. It never enables backend execution.
5. Chart price selection creates a reviewed pending order. Selected practice positions expose entry/SL/TP lines. Drag previews the new level; release validates and saves. Numeric edit and keyboard controls remain available.
6. Close a selected practice position from the chart with review. Show selection and current P&L. Keep connected positions visible/read-only while execution is gated.
7. Unit-test indicators, risk updates and pending-order validation; browser-test mouse/keyboard/touch-sized controls, account isolation and mobile layout.

## Release boundary
This is a local, working practice implementation. Broker-side stop management, execution acknowledgement, reconnect reconciliation and real trading acceptance still depend on the FIX/backend rollout. Nothing is pushed or deployed.

## Technical reference
Use the installed Lightweight Charts 4.2 API, including stable series updates and price/coordinate conversion: https://tradingview.github.io/lightweight-charts/docs/4.2/api/interfaces/ISeriesApi .

## Revised trading workflow after visual review

The earlier card layout and detached chart controls were replaced with a chart-led trading desk. The fixed watchlist spans the workspace height, the chart occupies the centre, the order ticket sits on the right, and trade activity sits directly below the chart. The portal brand remains in the header; lime identifies selection and primary actions, while green/red identify trading direction.

```text
Choose instrument → set volume + optional protection
                      ├─ Ticket → review → place
                      ├─ Chart Buy/Sell → review → place
                      ├─ Opt-in 1-click → market fill
                      └─ At price → click chart → choose side → review pending order

Placement → confirmation sound + entry overlay + activity row
Select entry / activity row → drag SL/TP or pending entry / edit exact prices
Close or cancel → review the specific order → account + chart + history update
```

- The chart and ticket share volume and protection drafts. Protection for a new order is distinct from editing an existing position.
- Every active order on the selected instrument gets an entry line. The selected trade has compact direction, size and P&L labels on the right; other entries use a quiet left lane. Nearby background entries can group. Narrow charts prioritize selected entry/SL/TP labels, with every position available in the numbered selector below.
- A new fill becomes the selected chart position. Selected SL/TP lines can be dragged or edited numerically. Pending entries can move; executed entries remain fixed. Levels do not change the candle range automatically. Distant exits show directional markers; Fit trade explicitly includes selected levels, and Latest restores normal scale.
- Currency pairs use paired flag artwork. Bitcoin and Ethereum reuse the client portal's local logo assets; metals use purpose-built bar illustrations.
- Short trade-confirmation sounds can be muted in the header or preferences. Sound failure never blocks execution.
- Practice accounts synchronize across updated tabs and read saved account state before changes, preventing a stale tab from routinely overwriting newer trades. This remains a browser-local simulator, not an atomic broker ledger.

## Validation
- Automated coverage: 28 tests covering chart aggregation, indicator maths, trade validation, pending/exit execution, chart-level edits, account decoding, sound generation, and the existing email contracts.
- Browser checks: side-ticket execution, shared lot size/protection, multiple entry overlays, label selection, dragged SL, keyboard pending-entry adjustment, one-click market execution, reviewed close/cancel, synchronized updated tabs, light/dark UI, and a narrow mobile chart with focus mode.
- Actual acoustic playback, physical touch-device behaviour and broker execution are not release-certified by these checks.

## Trade-overlay refinement

Controls now occupy dedicated rows above/below the plot. Selected entry is a solid blue line; stop loss and take profit use red/green dashed lines and compact price handles. Duplicate native labels are removed for practice overlays. Connected order/draft lines retain native labels.

Label geometry uses the chart’s actual pane dimensions. Selected exits take priority, collision spacing retains exact-price connectors, and unselected entries use a separate lane on wider plots. Price lines update in place during dragging. A drag previews estimated P&L and validation errors, preserves the opposite exit, and never mutates the account before release. Escape, pointer cancellation, lost capture, window blur and keyboard focus loss release the chart. Exact-price entry is available by clicking a handle or SL/TP.

Verified locally: valid drag saved, invalid drag rejected without changing the account, keyboard blur cancelled the draft, distant TP remained off-screen without stretching candles, Fit trade revealed it, and original practice levels were restored after testing. Desktop and narrow mobile layouts were inspected in light and dark themes.
