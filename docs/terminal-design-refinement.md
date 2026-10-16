# Movement Markets terminal refinement

Match the client and partner portals, while keeping the chart the largest working surface.

- Palette: canvas #f3f5f8, paper #ffffff, ink #111418, secondary #59636f, signature lime #b0f000. Dark: #0c0c0c canvas, #1c1c1c panels, #161616 plot, #f4f4f4 ink. Buy/sell colours remain semantic red and green.
- Type: the existing Montserrat 700/300 wordmark; Space Grotesk for instrument, quote and panel headings; Inter for forms and tabular data. Self-host fonts. No new visual identity.
- Layout: 72px portal header; fixed watchlist / chart / ticket columns; activity below the chart; readable account figures in the footer. A single pane at tablet/mobile widths, with the existing four-tab navigation. Full chart focus remains available.
- Rhythm: 20px panels, 12px form corners, flat pill actions, 12–20px internal spacing. Icons use the existing vector set. Reserve lime for selection and brand actions; keep trade direction red/green.
- Performance: isolate the crosshair readout from the chart shell, narrow UI subscriptions, move the clock into its own footer component, incrementally calculate enabled indicators, remove external font stylesheet dependence.

```
Brand & search                                   Tools / account
┌─────────────┐ ┌──────────────────────────────┐ ┌─────────────────┐
│ Watchlist   │ │ Instrument / chart controls │ │ Order ticket    │
│             │ │                            │ │                 │
│             │ │ Price chart                │ │ Price / volume  │
│             │ │                            │ │ Risk controls   │
│             │ ├────────────────────────────┤ │                 │
│             │ │ Positions / activity       │ │ Review / submit │
└─────────────┘ └──────────────────────────────┘ └─────────────────┘
Account figures                                           Feed
```

Review against the brief: avoid a new dashboard theme, decorative status cards, gradients, oversized empty headings and moving buttons. Existing market data, trading policy, order review, practice account, SL/TP editing, account switching and attribution stay intact. The responsive layout rules have one owner instead of accumulating further overrides.


## Verification — 26 September 2026

- `npm test`: 119 tests passed, including nine indicator-cache parity and bounded-work tests.
- `npm run typecheck`: passed.
- `npm run build`: passed; terminal route 112 kB, first-load JavaScript 246 kB. These are build sizes, not an end-user speed benchmark.
- `git diff --check`: passed.
- Browser review at desktop, short laptop and mobile sizes, in light and dark themes. Checked chart sizing, timeframe changes, chart focus, indicator dialog, existing position overlays, account chooser, mobile activity, and the order review dialog. Expanded pending-order/risk fields scroll inside the ticket while the submit area remains visible.
- Restored test-only draft fields, timeframe, chart focus and theme after review. No orders were submitted and no existing positions were modified during this refinement.
- The optimized build is served locally on port 9000. No commit, push or deployment was performed. Real execution and backend contracts were not changed.
