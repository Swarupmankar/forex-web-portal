# Mobile-to-web integration mapping

Source reviewed: `/Users/komalprf/Downloads/paper-trading` on 26 September 2026. Mobile source was read only, not modified.

| Capability | Mobile source | Web behavior |
| --- | --- | --- |
| Broker discovery | services/appServicesEndPoints.ts | GET /v1/users/auth/brokers; no invented fallback IDs |
| Server discovery | screens/Login/useLogin.ts; services/appServices.ts | GET /v1/users/auth/servers?brokerId=…; clears server when broker changes |
| Trading login | services/models/login.ts | POST tradingUsername, tradingPassword, brokerId, serverId; requires a returned token |
| Chart | screens/Chart/useChart.ts; hooks/queries/useChartDataQuery.ts | GET /v1/chart/historical with interval minute/hourly/daily and numeric period; reads data.quotes |
| Timestamp | Observed historical response | Handles YYYY-MM-DD-HH:mm, ISO, seconds and milliseconds; all chart timestamps use UTC |
| Streaming | hooks/useStockPrices.ts | Socket.IO price event `SYMBOL BID ASK MID TIMESTAMP`, subscribeSymbol/unsubscribeSymbol; reference-counted subscriptions |
| Orders | services/models/login.ts | symbol, orderType, executionType, lotSize, limitPrice, sl, tp |
| Modify/cancel | services/appServices.ts | PUT /v1/users/order/modify/:id; cancelOrder, sl, tp |
| Close | services/models/login.ts | POST /v1/users/order/exit-order; orderId and exitLotSize |
| Balances/history | services/appServicesEndPoints.ts | Existing account/orders/history endpoints, account numbers only from backend |

Live read-only checks: backend broker list and XAUUSD chart history returned HTTP 200; browser chart and Socket.IO quotes render. Broker-specific server list returned HTTP 200. No login to a trading account and no financial mutations were performed.

The existing mobile app uses `https://mock-ws-chart.onrender.com` as WS_URL. That service is labelled development in the web app. Execution cannot be enabled while this development feed remains configured. It is not sufficient to set only a public flag: the server route separately rejects every order mutation unless TRADING_ENABLED is explicitly true.

REST refresh is authoritative for account/order state. Mobile notification websocket events are not yet ported; account state refreshes on focus/reconnection plus polling. Authenticated session-expiry, account switching, order metadata, server notifications and FIX execution should receive end-to-end acceptance with the backend team before release.
