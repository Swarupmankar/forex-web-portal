# Movement Markets terminal

## Visual direction
A fixed trading desk: instrument navigation on the left, a dominant chart and activity table in the centre, and a clear order ticket on the right. No draggable panels or tabs. On smaller screens, switch between Markets, Chart, Trade and Activity with a fixed navigation bar. Preserve the portal's gate mark and Montserrat 700/300 wordmark, Inter interface text, Space Grotesk headings and 1.75px outline icons.

Colour: canvas #f3f5f8 / #0c0c0c; panels #ffffff / #1c1c1c; wells #f6f8fa / #161616; primary ink #111418 / #f4f4f4; action lime #b0f000; accessible accent text #527000 in light mode. Red/green indicate market direction, not decorative branding. Flat controls, restrained 12–20px rounding, no glows.

## Reference review
Reviewed Elefin's terminal using the user's authorised login. Its watchlist, chart, activity tabs, pending-order fields, account switcher and settings establish useful trading conventions. Its chart displayed a timeout during this review. No financial actions were performed. Our composition uses a separate instrument ribbon, fixed panels, an explicit order review, meaningful connection states and consistent Movement branding. No Elefin assets or source copied.

## Functionality
Use the React Native Paper Trading application as the source of truth for API contracts. Remove simulated order success and the hardcoded deposit address. Use the client portal for funding. Label preview prices and illustrative history; never use them for execution. Use backend historical data with retry/empty states. Use the verified MARKET/LIMIT/STOP and lotSize/limitPrice/sl/tp payload, guarded by a server-side execution lock until FIX integration acceptance.

Useful additions: fixed responsive workspaces, favourite instruments, symbol/category search, chart/line modes, chart focus, grid and SMA toggle, fit chart, chart snapshot, browser-local alerts, account refresh, order review, clear failures, CSV activity export, and accessible keyboard dialogs. Shortcuts open search, alerts and help; none submits an order.
