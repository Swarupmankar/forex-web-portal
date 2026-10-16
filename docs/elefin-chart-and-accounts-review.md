# Chart and account integration review

Reviewed 26 September 2026. Local work only; nothing pushed or deployed.

## Observed on Elefin

- The account menu lists separate Real and Demo accounts with balances and equity. Switching to the existing Demo account updates the trading workspace and its existing positions.
- Order entry offers Market/Pending, Buy/Sell, lot presets, a maximum-size estimate, and optional TP/SL. Pending orders expose type and trigger price.
- Positions group by instrument. Settings expose chart trade visibility, one-click/reviewed execution and trading sounds.
- The page loads `/charting_library/charting_library.standalone.js`, indicating TradingView's full Charting Library integration. Its chart timed out repeatedly in this browser, including after Retry, so the rendered toolbar, drawing tools and chart trading implementation were not verified. Its precise SDK edition and licence were not established.
- No orders were submitted, closed or modified during inspection. No account was created.

## Current Movement Markets implementation

Our installed library is Lightweight Charts 4.2.3. Candles, indicators, position labels and risk dragging are implemented by our frontend. This package does not supply the full TradingView drawing/indicator toolbar.

The corner logo is disabled through the supported `layout.attributionLogo` option on the price and RSI charts. A visible TradingView link remains below the chart at every screen size, with the attribution notice and Apache licence at `/licenses/lightweight-charts.txt`. This relocation follows the version 4.2 documentation; it does not remove TradingView attribution altogether.

Practice is browser-local simulated trading. Connected accounts use the verified trading-account login and account-detail endpoints. The top-right account menu now switches between Practice and authenticated trading sessions, with the Real/Demo label taken from the backend. Unknown types remain labelled Trading.

## Confirmed direction and implementation

The user chose **Lightweight Charts**. Keep it and build Movement Markets controls around it; no paid SDK migration or SDK application is required for this implementation.

- One account menu replaces the separate mode buttons. It includes current balance, equity, free margin, Practice, connected accounts, account connection and per-account disconnect.
- Each account is keyed by broker, server and trading username. Tokens live in tab-scoped session storage, outside menu state; passwords are never persisted. The old single-account trading session is migrated once. The terminal opens in Practice on reload; connected sessions remain selectable in that tab while valid.
- Switching aborts pending reads, resets the API cache, restarts the price connection, clears old quotes, selected positions, unfinished orders and one-click consent. Workspace components remount for the selected session. Late account-scoped responses are discarded using a session generation, including expired-session responses from the previous account.
- Login failures do not expire the current account. Session expiry removes only the affected active account and requests reconnection. Disconnect never silently selects another real account.
- Connected chart overlays include backend-reported entry, pending, SL and TP levels. The connected chart shows a view-only account context while execution is unavailable. Practice retains editable chart protection, reviewed market/pending trades, one-click opt-in, sounds, indicators and persistent simulated positions.
- Use the existing Movement Markets gate mark, Inter/Space Grotesk/wordmark fonts, charcoal and white surfaces, lime selection, flat controls and fixed workspace. Red and green stay reserved for prices and direction. Mobile has one compact account control and Markets/Chart/Trade/Activity navigation.

## Remaining integration work

The client portal exposes `/users/trading/my-accounts` with a **portal** login. The terminal authenticates using `/v1/users/trading/login` with trading username/password, broker ID and server ID. No automatic portal-session handoff or account-token exchange contract was established, so the terminal does not reuse portal credentials or fabricate an account list. Users connect each Real/Demo trading account once in their terminal tab and then select it from the menu. The backend team can later supply a short-lived authenticated handoff to load portal accounts without a separate trading login.

Real execution remains disabled in both frontend and proxy until backend/FIX acceptance. Read-only broker/server discovery was verified; the backend returned MovementMarkets with REAL MM and DEMO MM servers. An authenticated multi-account end-to-end check still needs **trading** account credentials, not the portal email/password.

## Validation

Production build, TypeScript and 35 automated tests passed. New coverage includes Real/Demo identity and token separation, session restore, invalid-storage handling, disconnect, generation invalidation and connected chart level mapping. Browser checks covered the account dialog and trading-login discovery at desktop and 320px mobile widths, light/dark presentation, keyboard dismissal, and draft/one-click reset with existing practice trades retained. No financial transaction, push or deployment was performed.

## Official references

- [Lightweight Charts 4.2 attribution option](https://tradingview.github.io/lightweight-charts/docs/4.2/api/interfaces/LayoutOptions#attributionlogo)
- [Lightweight Charts 4.2.3 notice](https://raw.githubusercontent.com/tradingview/lightweight-charts/v4.2.3/NOTICE)
