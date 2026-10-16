# Chart execution refinement

This change keeps Lightweight Charts and the existing order validation, account policy and backend contract. It is a local implementation, not a deployment or a certification of live execution readiness.

## Controls

- **Market**: Buy/Sell uses the current executable quote. One-click Off opens a review; On sends a market order subject to the existing volume and execution restrictions.
- **Pending order**: choose a price on the chart, type it, or drag the draft handle. Buy/Sell displays the resulting limit/stop type and chosen price. Every pending order requires review, including when one-click is On. Moving a draft never submits it. Escape or Cancel removes the draft.
- **New-order SL/TP**: choose direction and optional exit prices. Validate direction against entry before saving; revalidate against the executable quote at submission. Existing trades have a separate Edit SL/TP action.

## Trade overlays

Selected entry, stop and target labels share one aligned lane. Labels show exact prices, lots and current or projected P&L; leader lines preserve the price anchor when labels need separation. Off-screen levels remain identifiable and Fit trade brings them into range. Additional dense levels are grouped or accessible through View trades.

Practice SL/TP and pending-entry drags show a preview with Apply/Cancel. Arrow keys fine-tune by a tick, Shift by ten ticks, Enter applies and Escape cancels. Drag geometry compensates for rendered scaling. Chart navigation cannot intercept the preview actions.

The new editable overlays manage practice orders. Connected account lines and the existing backend execution policy are retained; connected modification acknowledgements and real execution have not been tested in this pass.

## Rendering and layout

Native canvas sizing remains under Lightweight Charts control. Red/green candles, readable initial bar spacing, a right-side chart gutter, wider price scale, integer-positioned HTML labels and responsive control rows improve clarity. TradingView attribution remains visible.

## Verification

- 122 automated tests pass, including drag scaling, invalid draft prices, overlapping/off-screen labels, trade validation, account isolation and existing server execution guards.
- Browser practice checks: chart price picking, numeric and keyboard entry, pending review with one-click enabled, market review, single-click market execution, invalid SL rejection, valid protection, SL preview/apply/cancel and symbol reset.
- Responsive checks at 390 × 844, 1280 × 720 and 1440 × 900 in light and dark themes. All transaction tests used a separate localhost practice account with virtual funds.
- No live financial transactions, push or deployment performed.
