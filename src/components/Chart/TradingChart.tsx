'use client';
import { useMarketDisplay } from '@/hooks/useMarketDisplay';
import { shiftPendingEntry } from '@/lib/contracts';
import { useShallow } from 'zustand/react/shallow';
import { ChartReadout, type ChartReadoutHandle } from './ChartReadout';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, LocateFixed, Camera, Bell, ChartCandlestick, ChartLine, RefreshCw, SlidersHorizontal, Plus, Minus, ArrowRight, X } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useGetOpenOrdersQuery } from '@/store/api/tradingApi';
import { subscribeSymbol, unsubscribeSymbol } from '@/services/priceSocket';
import { type CandleSource } from '@/services/candleFeed';
import { useTheme } from '@/theme/theme';
import { previewCandles, formatCountdown, isChartQuoteStale, staleLabel, axisLabelHeight, clockChipTop, type Candle } from '@/lib/chart';
import { serverNow } from '@/lib/serverClock';
import { quoteAge } from '@/lib/freshness';
import { useExecutableQuote } from '@/hooks/useExecutableQuote';
import { SAMPLE_QUOTES, PREVIEW_FEED, DEVELOPMENT_FEED, TIMEFRAMES } from '@/lib/market';
import { candleStart, candleEnd, FEED_TIMEFRAMES } from '@/lib/chartTime';
import { useChartHistory } from './useChartHistory';
import { useAccountStore } from '@/store/useAccountStore';
import { useSessionServices } from '@/store/useSessionServices';
import { chartOrders, validateOrderChanges } from '@/lib/connectedOrders';
import { useTradingAccountId } from '@/hooks/useTradingAccountId';
import { runningPnl, ownOrders, withInstrument, conversionSymbols } from '@/lib/positionPnl';
import {openTradeManagement} from '@/lib/openTradeManagement';
import {useQuickTradeActions} from '@/hooks/useQuickTradeActions';
import {managementProgressLabel} from '@/lib/tradeExperience';
import {useOrderFlow} from '@/store/useOrderFlow';
import {useTradeManagement} from '@/store/useTradeManagement';
import { useExecutionPolicy } from '@/hooks/useExecutionPolicy';
import { usePriceStore } from '@/store/usePriceStore';
import { executableQuote } from '@/hooks/useExecutableQuote';
import { isQuoteExecutable } from '@/lib/freshness';
import type { Order } from '@/types/trading';
import type { OrderChanges } from '@/lib/connectedOrders';
import { InstrumentIcon } from '@/components/terminal/InstrumentIcon';
import { usePracticeStore } from '@/store/usePracticeStore';
import { useChartSettings } from '@/store/useChartSettings';
import { STUDY_INFO, type StudyKey } from '@/lib/indicators';
import type { PracticeLevel } from '@/lib/practice';
import type { PriceTick } from '@/types/trading';
import { useChartEngine, CHART_FONT_SIZE, type ChartEngine } from './useChartEngine';
import { IndicatorPanel } from './IndicatorPanel';
import { InstrumentTabs } from '@/components/terminal/InstrumentTabs';
import { ChartTradeControls } from './ChartTradeControls';
import {ChartLoading} from './ChartLoading';
import { ChartAttribution } from './ChartAttribution';
import { managementPreviewLevels } from '@/lib/chartOverlayLayout';
import { ChartPendingEntry } from './ChartPendingEntry';
import { ChartPositionDock } from './ChartPositionDock';
import { ChartPositionOverlay } from './ChartPositionOverlay';
import '@/styles/chart-live.css';
// Whether the quote is older than CHART_STALE_MS, checked every second; re-renders only when it flips.
function useQuoteStale(quote: PriceTick | undefined, enabled: boolean) {
    const [stale, setStale] = useState(false);
    const latest = useRef(quote);
    latest.current = quote;
    useEffect(() => {
        if (!enabled)
            return;
        const check = () => setStale(isChartQuoteStale(quoteAge(latest.current)));
        check();
        const timer = window.setInterval(check, 1000);
        return () => window.clearInterval(timer);
    }, [enabled]);
    return enabled && stale;
}
const LABEL_HEIGHT = axisLabelHeight(CHART_FONT_SIZE), CLOCK_HEIGHT = 16;
// Bar-close countdown (feed time) in a chip on the price axis, just under the last price's label.
// While the quote is stale it shows how long instead, in neutral grey.
function ChartBarClock({ engine, seconds, timeframe, anchor, ask, tone, stale, quote }: {
    engine: ChartEngine | null;
    seconds: number;
    timeframe: string;
    // Price whose axis label the chip sits under (the bid, or the last close), and the ask when shown.
    anchor?: number;
    ask?: number;
    tone: 'bid' | 'up' | 'down';
    stale: boolean;
    quote?: PriceTick;
}) {
    const [now, setNow] = useState<number | null>(null);
    const [box, setBox] = useState<{ top: number; width: number } | null>(null);
    const place = useRef(() => { });
    place.current = () => {
        const y = engine?.alive() && anchor !== undefined ? engine.series.priceToCoordinate(anchor) : null;
        const height = engine?.alive() ? engine.chart.paneSize().height : 0;
        if (!engine || y === null || !height) {
            setBox(null);
            return;
        }
        const askY = ask === undefined ? null : engine.series.priceToCoordinate(ask);
        const next = { top: Math.round(clockChipTop(y, askY, height, LABEL_HEIGHT, CLOCK_HEIGHT)), width: engine.chart.priceScale('right').width() || 68 };
        setBox(old => old && old.top === next.top && old.width === next.width ? old : next);
    };
    useEffect(() => {
        let timer = 0;
        const tick = () => {
            const t = serverNow();
            setNow(t);
            place.current();
            timer = window.setTimeout(tick, 1020 - (t % 1000));
        };
        tick();
        return () => window.clearTimeout(timer);
    }, []);
    useEffect(() => place.current(), [engine, anchor, ask]);
    useEffect(() => engine?.subscribe(() => place.current()), [engine]);
    if (now === null || !box)
        return null;
    return <div className={`chart-bar-clock is-${stale ? 'stale' : tone}`} role="timer" style={{ top: box.top, width: box.width, height: CLOCK_HEIGHT }} title={stale ? 'No price update for this instrument' : 'Time until this bar closes'}>
    {stale ? staleLabel(quoteAge(quote)) : formatCountdown(candleEnd(FEED_TIMEFRAMES[timeframe], now) - now, seconds)}
  </div>;
}
export function TradingChart() {
  const { formatPrice, instrument } = useMarketDisplay();
    const u = useUIStore(useShallow(s => ({activeSymbol:s.activeSymbol, pendingEntry:s.pendingEntry, orderMode:s.orderMode, pickingEntry:s.pickingEntry, setPickingEntry:s.setPickingEntry, activeTimeframe:s.activeTimeframe, chartType:s.chartType, isAuthenticated:s.isAuthenticated, setActiveTimeframe:s.setActiveTimeframe, setChartType:s.setChartType})));
    const w = useWorkspaceStore(useShallow(s => ({showGrid:s.showGrid, selectedTradeId:s.selectedTradeId, showTrades:s.showTrades, selectTrade:s.selectTrade, notify:s.notify, setAlertOpen:s.setAlertOpen, focusChart:s.focusChart, setFocus:s.setFocus})));
    const readout = useRef<ChartReadoutHandle>(null);
    const setHover = useCallback((c: Candle | undefined) => readout.current?.hover(c), []);
    const practice = usePracticeStore(s => s.mode === 'practice'), paper = usePracticeStore(s => s.account.orders);
    const { studies, update, showBidAsk, showCountdown } = useChartSettings();
    const [theme] = useTheme();
    const symbol = u.activeSymbol, tf = u.activeTimeframe, meta = instrument(symbol), preview = practice || PREVIEW_FEED;
    useEffect(() => { if (preview)
        return; subscribeSymbol(symbol); return () => unsubscribeSymbol(symbol); }, [preview, symbol]);
    // The price this account trades at, as on the order ticket: the heading, bid/ask lines and countdown follow it.
    const quote = useExecutableQuote(symbol);
    const source: CandleSource = practice ? 'practice' : preview ? 'preview' : 'connected';
    const quoteStale = useQuoteStale(quote, source !== 'preview');
    const host = useRef<HTMLDivElement>(null), rsiHost = useRef<HTMLDivElement>(null);
    const [latestCandle, setLatestCandle] = useState<Candle | undefined>(), [indicatorOpen, setIndicatorOpen] = useState(false);
    useEffect(() => { setLatestCandle(undefined); setHover(undefined); }, [symbol,tf,practice,setHover]);
    const picking=u.pickingEntry, setPicking=u.setPickingEntry;
    const pickedPrice=u.orderMode==='PENDING' && Number(u.pendingEntry)>0 ? Number(u.pendingEntry) : null;
    // Picking is only reachable from the chart console, which renders only when the account can trade.
    const clearPick = useCallback(() => { setPicking(false); useUIStore.getState().setPendingEntry(''); }, [setPicking]);
    const changeDraftPrice = useCallback((p: number | null) => {
        if (p !== null && pickedPrice !== null) {
            const draft = useUIStore.getState();
            if (draft.enableTPSL) {
                const moved = shiftPendingEntry(pickedPrice, p, {
                    ...(draft.stopLoss && { sl: Number(draft.stopLoss) }),
                    ...(draft.takeProfit && { tp: Number(draft.takeProfit) }),
                }, meta.digits);
                if (moved.sl !== undefined) draft.setStopLoss(String(moved.sl));
                if (moved.tp !== undefined) draft.setTakeProfit(String(moved.tp));
            }
        }
        useUIStore.getState().setPendingEntry(p===null?'':String(p)); setPicking(p === null);
    }, [pickedPrice, meta.digits, setPicking]);
    const pick = useCallback((p: number) => { if (picking) { changeDraftPrice(Number(p.toFixed(meta.digits))); useWorkspaceStore.getState().openOrderTicket(); } }, [picking, meta.digits, changeDraftPrice]);
    useEffect(() => { const esc = (e: KeyboardEvent) => { if(e.key === 'Escape' && !e.defaultPrevented && !(e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"],[role=dialog]')) clearPick(); }; document.addEventListener('keydown',esc); return () => document.removeEventListener('keydown',esc); }, [clearPick]);
    const generation = useAccountStore(s => s.generation);
    const routingError = useSessionServices(s => s.error);
    const historical = useChartHistory(symbol, tf, !preview && u.isAuthenticated);
    const serverOrders = useGetOpenOrdersQuery(undefined, { skip: practice || !u.isAuthenticated });
    const candles = useMemo(() => {
        if (!preview) return historical.candles;
        const rows = previewCandles(SAMPLE_QUOTES[symbol]?.bid || 1, TIMEFRAMES[tf], serverNow());
        let cursor = serverNow();
        for (let i = rows.length - 1; i >= 0; i--) {
            rows[i].time = candleStart(FEED_TIMEFRAMES[tf], cursor) / 1000;
            cursor = rows[i].time * 1000 - 1;
        }
        return rows;
    }, [preview, symbol, tf, historical.candles]);
    const engine = useChartEngine({
        host, rsiHost, candles, symbol, source,
        identity: `${generation}:${practice ? 'practice' : 'connected'}:${symbol}:${tf}`,
        interval: TIMEFRAMES[tf], timeframe: tf, digits: meta.digits ?? 5, kind: u.chartType, theme, grid: w.showGrid, studies,
        quote, showBidAsk, quoteStale,
        onHover: setHover, onLatest: setLatestCandle, onPick: pick,
    });
    useEffect(() => {
        if (preview || !engine?.alive()) return;
        const loadOlder = (range: import('lightweight-charts').LogicalRange | null) => {
            if (range && range.from < 15) historical.older();
        };
        engine.chart.timeScale().subscribeVisibleLogicalRangeChange(loadOlder);
        return () => { if (engine.alive()) engine.chart.timeScale().unsubscribeVisibleLogicalRangeChange(loadOlder); };
    }, [engine, preview, historical.older]);
    const quoteLines = showBidAsk && !!quote && quote.bid > 0 && quote.ask >= quote.bid;
    const managementPreview=useTradeManagement(s=>s.preview);
    const policy = useExecutionPolicy();
    const accountId = useTradingAccountId();
    const connectedOrders = useMemo(() => ownOrders([...(serverOrders.currentData?.openOrders ?? []), ...(serverOrders.currentData?.pendingOrders ?? [])], accountId).filter(o => o.symbol === symbol).map(o => withInstrument(o, instrument(o.symbol))), [serverOrders.currentData, symbol, accountId, instrument]);
    // Other watchlist ticks must not redraw this chart. Keep USD conversion legs
    // subscribed too, so cross-currency positions still update their P&L correctly.
    const valuationSymbols = useMemo(() => [symbol, ...conversionSymbols(connectedOrders)], [symbol, connectedOrders]);
    const livePrices = usePriceStore(useShallow(s => Object.fromEntries(valuationSymbols.map(key => [key, s.prices[key]]))));
    const positions = useMemo(() => practice ? paper.filter(o => o.symbol === symbol && (o.status === 'OPEN' || o.status === 'PENDING')) : chartOrders(connectedOrders), [paper, practice, symbol, connectedOrders]);
    const selected = positions.find(o => o.id === w.selectedTradeId) || positions[0];
    const quick=useQuickTradeActions();
    const tradeProgress=useTradeManagement(s=>managementProgressLabel(s.results[selected?.id??'']));
    const tradeBusy=useOrderFlow(s=>s.inFlight||!!s.verifying)||!!tradeProgress;
    const historyReady = candles.length > 0;
    useEffect(() => {
      // History initialization resets the scale; fit the selected entry after that reset.
      if (historyReady && engine?.alive() && selected) engine.fitLevels([selected.openPrice]);
    }, [engine,selected?.id,historyReady,symbol,tf]);
    function editSelected(level?: PracticeLevel) {
        if (!selected) return;
        if (practice) { openTradeManagement(selected,'edit',true,undefined,level); return; }
        const raw = connectedOrders.find(o => String(o.id) === selected.id);
        if (raw) openTradeManagement(raw,'edit',false,undefined,level);
    }
    const connected = practice ? undefined : {
        canManage: policy.canManage && !tradeBusy,
        pnl: (view: import('@/lib/practice').PracticeOrder, price?: number) => {
            const raw = connectedOrders.find(o => String(o.id) === view.id);
            if (!raw) return NaN;
            const projection = view.status === 'PENDING' ? { ...raw, orderDetails: { ...raw.orderDetails, entryPrice: view.openPrice } } : raw;
            return runningPnl(projection, price === undefined ? livePrices : { ...livePrices, [raw.symbol]: { bid: price, ask: price } });
        },
        validate: (view: import('@/lib/practice').PracticeOrder, level: PracticeLevel, price: number) => {
            if (!policy.canManage) return policy.reason || 'Trading is unavailable.';
            const raw = connectedOrders.find(o => String(o.id) === view.id), q = executableQuote(view.symbol);
            if (!raw || !isQuoteExecutable(q)) return 'Waiting for the order and a fresh quote.';
            const changes = level === 'entry' ? shiftPendingEntry(view.openPrice, price, view, meta.digits) : { [level]: price };
            return validateOrderChanges(raw, changes, q);
        },
        review: (view: import('@/lib/practice').PracticeOrder, level: PracticeLevel, price: number) => {
            const raw = connectedOrders.find(o => String(o.id) === view.id);
            if (raw) openTradeManagement(raw,'edit',false,level === 'entry' ? shiftPendingEntry(view.openPrice, price, view, meta.digits) : { [level]: price },level);
        },
    };
    const extraLines = useMemo(() => [
        ...(pickedPrice !== null ? [{ id: 'pending-draft', price: pickedPrice, title: 'Draft', color: '#b79238' }] : []),
        ...managementPreviewLevels(managementPreview, selected?.id)
    ], [pickedPrice, managementPreview, selected?.id]);
    useEffect(() => {
        if (!engine?.alive())
            return;
        const first = candles[0]?.time, last = candles.at(-1)?.time;
        engine.series.setMarkers(w.showTrades ? positions.filter(o => o.status === 'OPEN').map(o => ({ id: o.id, time: (candleStart(FEED_TIMEFRAMES[tf], Date.parse(o.filledAt || o.createdAt)) / 1000) as import('lightweight-charts').UTCTimestamp, position: o.orderType === 'BUY' ? 'belowBar' as const : 'aboveBar' as const, color: o.orderType === 'BUY' ? '#16a773' : '#e05260', shape: o.orderType === 'BUY' ? 'arrowUp' as const : 'arrowDown' as const, text: o.id === selected?.id ? `${o.orderType} ${o.lotSize}` : '', size: 1 })).filter(m => first !== undefined && m.time >= first && m.time <= Math.max(last || 0, Math.floor(Date.now() / 1000))).sort((a, b) => a.time - b.time) : []);
    }, [engine, positions, selected?.id, w.showTrades, tf, candles]);
    const missing = !preview && !historical.loading && !candles.length;
    // Background refetches (focus, reconnect) keep the chart on screen; only a first load or a failure with nothing to show covers it.
    const loadingHistory = !preview && historical.loading && !candles.length, historyFailed = !preview && !!historical.error && !candles.length;
    const active = (Object.keys(studies) as StudyKey[]).filter(k => studies[k].enabled);
    function snapshot() { if (!engine)
        return; const a = document.createElement('a'); a.download = `Movement-Markets-${symbol}-${tf}${practice ? '-practice' : ''}.png`; a.href = engine.snapshot(); a.click(); w.notify('Price chart snapshot downloaded.'); }
    return <section className="chart-panel panel interactive-chart">
  <InstrumentTabs/>
  <div className="chart-overview">
  <div className="instrument-heading"><div className="instrument-title"><InstrumentIcon symbol={symbol}/><div><h1>{symbol}<span className="instrument-class">{meta.category}</span></h1><p>{meta.name}</p></div></div><div className="instrument-quote"><strong>{formatPrice(quote?.bid, symbol)}</strong><span className="muted">{practice ? 'Practice bid' : 'Bid price'}</span></div><button className="icon-button alert-shortcut" aria-label={`Create ${symbol} price alert`} onClick={() => w.setAlertOpen(true)}><Bell /></button></div>
  <ChartTradeControls symbol={symbol} picking={picking} onPickToggle={() => { setPicking(true); }} onClearPick={clearPick}/>
  </div>
  <div className="chart-toolbar"><label className="compact-timeframe"><span>Timeframe</span><select aria-label="Chart timeframe" value={tf} onChange={e => { setHover(undefined); u.setActiveTimeframe(e.target.value); }}>{Object.keys(TIMEFRAMES).map(t => <option key={t} value={t}>{t}</option>)}</select></label><div className="timeframes" aria-label="Chart timeframe">{Object.keys(TIMEFRAMES).map(t => <button key={t} aria-pressed={tf === t} onClick={() => { setHover(undefined); u.setActiveTimeframe(t); }}>{t}</button>)}</div><div className="chart-controls"><button className="icon-button" aria-label={`Switch to ${u.chartType === 'candles' ? 'line' : 'candlestick'} chart`} title="Chart style" onClick={() => u.setChartType(u.chartType === 'candles' ? 'line' : 'candles')}>{u.chartType === 'candles' ? <ChartCandlestick /> : <ChartLine />}</button><button className="chart-indicators-button" aria-label={`Chart indicators${active.length ? ` · ${active.length} active` : ''}`} title="Chart indicators" onClick={() => setIndicatorOpen(true)}><SlidersHorizontal />Indicators{active.length > 0 && <span>{active.length}</span>}</button><button className="icon-button" aria-label="Fit all trades on chart" title="Fit all positions and pending entries" disabled={!positions.length} onClick={()=>engine?.fitLevels(positions.map(order=>order.openPrice))}><LocateFixed /></button><button className="icon-button chart-capture" aria-label="Download chart snapshot" onClick={snapshot}><Camera /></button><button className="icon-button" aria-label={w.focusChart ? 'Exit chart focus' : 'Focus chart'} onClick={() => w.setFocus(!w.focusChart)}>{w.focusChart ? <Minimize2 /> : <Maximize2 />}</button></div></div>



  <div className={`interactive-chart-plot ${picking ? 'is-picking' : ''}`}>
  <ChartReadout ref={readout} symbol={symbol} timeframe={tf} latest={latestCandle || candles.at(-1)} studies={studies} onRemove={k => update(k, { enabled: false })}/>
   <div ref={host} className="chart-canvas" aria-label={`${symbol} ${tf} chart${practice ? ' — simulated practice prices' : ''}`} role="img"/>
   <ChartPositionOverlay engine={engine} order={selected} orders={positions} onSelect={w.selectTrade} visible={w.showTrades} extraLines={extraLines} onEdit={editSelected} onReview={(view,level,price)=>openTradeManagement(view,'edit',true,level==='entry'?shiftPendingEntry(view.openPrice,price,view,meta.digits):{[level]:price},level)} connected={connected}/>
   {pickedPrice !== null && <ChartPendingEntry engine={engine} price={pickedPrice} symbol={symbol} onChange={changeDraftPrice} onCancel={clearPick}/>}
   {showCountdown && <ChartBarClock engine={engine} seconds={TIMEFRAMES[tf]} timeframe={tf} anchor={quoteLines ? quote.bid : latestCandle?.close} ask={quoteLines ? quote.ask : undefined} tone={quoteLines ? 'bid' : u.chartType === 'candles' && latestCandle && latestCandle.close < latestCandle.open ? 'down' : 'up'} stale={quoteStale} quote={quote}/>}
   <div className="chart-navigation"><button aria-label="Zoom in chart" title="Zoom in" onClick={() => engine?.zoom(0.8)}><Plus /></button><button aria-label="Zoom out chart" title="Zoom out" onClick={() => engine?.zoom(1.25)}><Minus /></button><button aria-label="Fit chart" title="Fit history" onClick={() => { engine?.chart.timeScale().fitContent(); engine?.resetScale(); }}><LocateFixed /></button><button aria-label="Return to latest price" title="Return to latest price" onClick={() => engine?.latest()}><ArrowRight /></button></div>
   {loadingHistory && <ChartLoading symbol={symbol} timeframe={tf}/>}
   {!loadingHistory && (historyFailed || missing) && !latestCandle && <div className="chart-message"><strong>{historyFailed ? 'Price history unavailable' : 'No history for this instrument'}</strong><button className="button button-outline" onClick={historical.refresh}>Retry chart</button></div>}
  </div>
  <div className={`rsi-pane ${studies.rsi.enabled ? 'is-visible' : ''}`}><span className="rsi-pane-label">RSI {studies.rsi.period}</span><div ref={rsiHost} className="rsi-canvas" role="img" aria-label="Relative strength index chart"/></div>
  {selected && w.showTrades && <ChartPositionDock order={selected} orders={positions} onSelect={w.selectTrade} onEdit={editSelected} busy={tradeBusy} progress={tradeProgress} quickClose={quick.enabled} connected={connected && {pnl:connected.pnl(selected),canManage:connected.canManage}} onReduce={()=>{
    const raw=practice?selected:connectedOrders.find(o=>String(o.id)===selected.id);
    if(raw)openTradeManagement(raw,'close',practice);
  }} onClose={()=>{
    const raw=practice?selected:connectedOrders.find(o=>String(o.id)===selected.id);
    if(raw)void quick.exit(raw,selected.status==='PENDING'?'cancel':'close');
  }} onFit={()=>engine?.fitLevels([selected.openPrice,selected.sl,selected.tp,...(managementPreview?.id===selected.id?Object.values(managementPreview.changes):[])].filter((p):p is number=>p!==undefined))}/>}
  <div className="interactive-chart-caption">{!preview && <button className="text-button" title={`${historical.candles.length} candles loaded`} disabled={historical.loading || !historical.more} onClick={historical.older}>{historical.loading ? "Loading history…" : historical.more ? "Load older candles" : "No more history"}</button>}<span title={routingError || historical.error}>{routingError || historical.error || ""}</span><span>{practice ? 'Practice · simulated prices' : preview ? 'Illustrative preview' : DEVELOPMENT_FEED ? 'Development feed' : 'Connected prices'}</span><ChartAttribution/><span>{selected && w.showTrades ? 'Drag SL / TP handles to adjust · ' : ''}UTC · FX day: 17:00 New York</span></div>
  {indicatorOpen && <IndicatorPanel onClose={() => setIndicatorOpen(false)}/>}
 </section>;
}
