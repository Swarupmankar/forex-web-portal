'use client';
import { useShallow } from 'zustand/react/shallow';
import { ChartReadout, type ChartReadoutHandle } from './ChartReadout';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, LocateFixed, Camera, Bell, ChartCandlestick, ChartLine, RefreshCw, SlidersHorizontal, Plus, Minus, ArrowRight, X } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useGetHistoricalChartQuery, useGetOpenOrdersQuery } from '@/store/api/tradingApi';
import { subscribeSymbol, unsubscribeSymbol } from '@/services/priceSocket';
import { onFeedConnected, type CandleSource } from '@/services/candleFeed';
import { useTheme } from '@/theme/theme';
import { normalizeCandles, bucketCandles, previewCandles, barTimeLeft, formatCountdown, isChartQuoteStale, staleLabel, axisLabelHeight, clockChipTop, type Candle } from '@/lib/chart';
import { serverNow } from '@/lib/serverClock';
import { quoteAge } from '@/lib/freshness';
import { useExecutableQuote } from '@/hooks/useExecutableQuote';
import { formatPrice, instrument, SAMPLE_QUOTES, PREVIEW_FEED, DEVELOPMENT_FEED, TIMEFRAMES } from '@/lib/market';
import { CHART_INTERVALS } from '@/lib/contracts';
import { connectedChartLevels } from '@/lib/connectedChartLevels';
import { InstrumentIcon } from '@/components/terminal/InstrumentIcon';
import { usePracticeStore } from '@/store/usePracticeStore';
import { useChartSettings } from '@/store/useChartSettings';
import { STUDY_INFO, type StudyKey } from '@/lib/indicators';
import type { PracticeLevel } from '@/lib/practice';
import type { PriceTick } from '@/types/trading';
import { useChartEngine, CHART_FONT_SIZE, type ChartEngine } from './useChartEngine';
import { IndicatorPanel } from './IndicatorPanel';
import { ChartTradeControls } from './ChartTradeControls';
import { ChartPendingEntry } from './ChartPendingEntry';
import { ChartPositionDock } from './ChartPositionDock';
import { ChartPositionOverlay, ChartRiskEditor } from './ChartPositionOverlay';
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
// Live bars cover everything the socket delivers, so history is refetched only for gaps it could
// not see: the socket reconnecting, or the tab returning after at least one bar spent hidden.
function useHistoryRecovery(refetch: () => unknown, enabled: boolean, seconds: number) {
    const latest = useRef(refetch);
    latest.current = refetch;
    useEffect(() => {
        if (!enabled)
            return;
        const recover = () => {
            try {
                latest.current();
            }
            catch {
                // The query has not started yet; its first fetch is still to come.
            }
        };
        let hiddenAt = document.hidden ? Date.now() : 0;
        const onVisibility = () => {
            if (document.hidden) {
                hiddenAt = Date.now();
                return;
            }
            if (hiddenAt && Date.now() - hiddenAt >= seconds * 1000)
                recover();
            hiddenAt = 0;
        };
        document.addEventListener('visibilitychange', onVisibility);
        const offConnected = onFeedConnected(recover);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            offConnected();
        };
    }, [enabled, seconds]);
}
const LABEL_HEIGHT = axisLabelHeight(CHART_FONT_SIZE), CLOCK_HEIGHT = 16;
// Bar-close countdown (feed time) in a chip on the price axis, just under the last price's label.
// While the quote is stale it shows how long instead, in neutral grey.
function ChartBarClock({ engine, seconds, anchor, ask, tone, stale, quote }: {
    engine: ChartEngine | null;
    seconds: number;
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
    {stale ? staleLabel(quoteAge(quote)) : formatCountdown(barTimeLeft(now, seconds), seconds)}
  </div>;
}
export function TradingChart() {
    const u = useUIStore(useShallow(s => ({activeSymbol:s.activeSymbol, activeTimeframe:s.activeTimeframe, chartType:s.chartType, isAuthenticated:s.isAuthenticated, setActiveTimeframe:s.setActiveTimeframe, setChartType:s.setChartType})));
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
    const [latestCandle, setLatestCandle] = useState<Candle | undefined>(), [indicatorOpen, setIndicatorOpen] = useState(false), [picking, setPicking] = useState(false), [pickedPrice, setPickedPrice] = useState<number | null>(null), [editing, setEditing] = useState<{
        id: string;
        level?: PracticeLevel;
    } | null>(null);
    // Picking is only reachable from the chart console, which renders only when the account can trade.
    const pick = useCallback((p: number) => { if (!picking)
        return; setPickedPrice(Number(p.toFixed(meta.digits ?? 5))); setPicking(false); }, [picking, meta.digits]);
    const clearPick = useCallback(() => { setPicking(false); setPickedPrice(null); }, []);
    const changeDraftPrice = useCallback((p: number | null) => { setPickedPrice(p); setPicking(p === null); }, []);
    useEffect(() => { const esc = (e: KeyboardEvent) => { if(e.key === 'Escape' && !e.defaultPrevented && !(e.target as HTMLElement)?.closest('[role=dialog]')) clearPick(); }; document.addEventListener('keydown',esc); return () => document.removeEventListener('keydown',esc); }, [clearPick]);
    const historical = useGetHistoricalChartQuery({ symbol, ...CHART_INTERVALS[tf] }, { skip: preview, refetchOnFocus: true, refetchOnReconnect: true });
    useHistoryRecovery(historical.refetch, !preview, TIMEFRAMES[tf]);
    const serverOrders = useGetOpenOrdersQuery(undefined, { skip: practice || !u.isAuthenticated });
    const candles = useMemo(() => preview ? previewCandles(SAMPLE_QUOTES[symbol]?.bid || 1, TIMEFRAMES[tf], serverNow()) : bucketCandles(normalizeCandles(historical.currentData), TIMEFRAMES[tf]), [preview, symbol, tf, historical.currentData]);
    const engine = useChartEngine({
        host, rsiHost, candles, symbol, source,
        identity: `${practice ? 'practice' : 'connected'}:${symbol}:${tf}`,
        interval: TIMEFRAMES[tf], digits: meta.digits ?? 5, kind: u.chartType, theme, grid: w.showGrid, studies,
        quote, showBidAsk, quoteStale,
        onHover: setHover, onLatest: setLatestCandle, onPick: pick,
    });
    const quoteLines = showBidAsk && !!quote && quote.bid > 0 && quote.ask >= quote.bid;
    const positions = useMemo(() => practice ? paper.filter(o => o.symbol === symbol && (o.status === 'OPEN' || o.status === 'PENDING')) : [], [paper, practice, symbol]);
    const selected = positions.find(o => o.id === w.selectedTradeId) || positions[0];
    const extraLines = useMemo(() => [
        ...(!practice && w.showTrades ? connectedChartLevels(serverOrders.currentData?.openOrders || [], serverOrders.currentData?.pendingOrders || [], symbol) : []),
        ...(pickedPrice !== null ? [{ id: 'pending-draft', price: pickedPrice, title: 'Draft', color: '#b79238' }] : [])
    ], [practice, w.showTrades, serverOrders.currentData, symbol, pickedPrice]);
    useEffect(() => {
        if (!engine?.alive())
            return;
        const first = candles[0]?.time, last = candles.at(-1)?.time;
        engine.series.setMarkers(w.showTrades ? positions.filter(o => o.status === 'OPEN').map(o => ({ id: o.id, time: (Math.floor(Date.parse(o.filledAt || o.createdAt) / 1000 / TIMEFRAMES[tf]) * TIMEFRAMES[tf]) as import('lightweight-charts').UTCTimestamp, position: o.orderType === 'BUY' ? 'belowBar' as const : 'aboveBar' as const, color: o.orderType === 'BUY' ? '#16a773' : '#e05260', shape: o.orderType === 'BUY' ? 'arrowUp' as const : 'arrowDown' as const, text: o.id, size: 1 })).filter(m => first !== undefined && m.time >= first && m.time <= Math.max(last || 0, Math.floor(Date.now() / 1000))).sort((a, b) => a.time - b.time) : []);
    }, [engine, positions, w.showTrades, tf, candles]);
    const missing = !preview && !historical.isFetching && !candles.length;
    // Background refetches (focus, reconnect) keep the chart on screen; only a first load or a failure with nothing to show covers it.
    const loadingHistory = !preview && historical.isFetching && !historical.currentData, historyFailed = !preview && historical.isError && !candles.length;
    const active = (Object.keys(studies) as StudyKey[]).filter(k => studies[k].enabled);
    function snapshot() { if (!engine)
        return; const a = document.createElement('a'); a.download = `Movement-Markets-${symbol}-${tf}${practice ? '-practice' : ''}.png`; a.href = engine.snapshot(); a.click(); w.notify('Price chart snapshot downloaded.'); }
    return <section className="chart-panel panel interactive-chart">
  <div className="chart-overview">
  <div className="instrument-heading"><div className="instrument-title"><InstrumentIcon symbol={symbol}/><div><h1>{symbol}<span className="instrument-class">{meta.category}</span></h1><p>{meta.name}</p></div></div><div className="instrument-quote"><strong>{formatPrice(quote?.bid, symbol)}</strong><span className="muted">{practice ? 'Practice bid' : 'Bid price'}</span></div><button className="icon-button alert-shortcut" aria-label={`Create ${symbol} price alert`} onClick={() => w.setAlertOpen(true)}><Bell /></button></div>
  <ChartTradeControls symbol={symbol} pickedPrice={pickedPrice} picking={picking} onPickToggle={() => { setPicking(true); }} onClearPick={clearPick} onPriceChange={changeDraftPrice} onSelect={w.selectTrade}/>
  </div>
  <div className="chart-toolbar"><div className="timeframes" aria-label="Chart timeframe">{Object.keys(TIMEFRAMES).map(t => <button key={t} aria-pressed={tf === t} onClick={() => { setHover(undefined); u.setActiveTimeframe(t); }}>{t}</button>)}</div><div className="chart-controls"><button className="icon-button" aria-label={`Switch to ${u.chartType === 'candles' ? 'line' : 'candlestick'} chart`} title="Chart style" onClick={() => u.setChartType(u.chartType === 'candles' ? 'line' : 'candles')}>{u.chartType === 'candles' ? <ChartCandlestick /> : <ChartLine />}</button><button className="chart-indicators-button" onClick={() => setIndicatorOpen(true)}><SlidersHorizontal />Indicators{active.length > 0 && <span>{active.length}</span>}</button><button className="icon-button chart-capture" aria-label="Download chart snapshot" onClick={snapshot}><Camera /></button><button className="icon-button" aria-label={w.focusChart ? 'Exit chart focus' : 'Focus chart'} onClick={() => w.setFocus(!w.focusChart)}>{w.focusChart ? <Minimize2 /> : <Maximize2 />}</button></div></div>



  <div className={`interactive-chart-plot ${picking ? 'is-picking' : ''}`}>
  <ChartReadout ref={readout} symbol={symbol} timeframe={tf} latest={latestCandle || candles.at(-1)} studies={studies} onRemove={k => update(k, { enabled: false })}/>
   <div ref={host} className="chart-canvas" aria-label={`${symbol} ${tf} chart${practice ? ' — simulated practice prices' : ''}`} role="img"/>
   <ChartPositionOverlay engine={engine} order={selected} orders={positions} onSelect={w.selectTrade} visible={w.showTrades} extraLines={extraLines} onEdit={level => selected && setEditing({ id: selected.id, level })}/>
   {pickedPrice !== null && <ChartPendingEntry engine={engine} price={pickedPrice} symbol={symbol} onChange={changeDraftPrice} onCancel={clearPick}/>}
   {showCountdown && <ChartBarClock engine={engine} seconds={TIMEFRAMES[tf]} anchor={quoteLines ? quote.bid : latestCandle?.close} ask={quoteLines ? quote.ask : undefined} tone={quoteLines ? 'bid' : u.chartType === 'candles' && latestCandle && latestCandle.close < latestCandle.open ? 'down' : 'up'} stale={quoteStale} quote={quote}/>}
   <div className="chart-navigation"><button aria-label="Zoom in chart" title="Zoom in" onClick={() => engine?.zoom(0.8)}><Plus /></button><button aria-label="Zoom out chart" title="Zoom out" onClick={() => engine?.zoom(1.25)}><Minus /></button><button aria-label="Fit chart" title="Fit history" onClick={() => { engine?.chart.timeScale().fitContent(); engine?.resetScale(); }}><LocateFixed /></button><button aria-label="Return to latest price" title="Return to latest price" onClick={() => engine?.latest()}><ArrowRight /></button></div>
   {loadingHistory && <div className="chart-message"><RefreshCw className="spin"/><p>Loading price history…</p></div>}
   {(historyFailed || missing) && <div className="chart-message"><strong>{historyFailed ? 'Price history unavailable' : 'No history for this instrument'}</strong><button className="button button-outline" onClick={() => historical.refetch()}>Retry chart</button></div>}
  </div>
  <div className={`rsi-pane ${studies.rsi.enabled ? 'is-visible' : ''}`}><span className="rsi-pane-label">RSI {studies.rsi.period}</span><div ref={rsiHost} className="rsi-canvas" role="img" aria-label="Relative strength index chart"/></div>
  {selected && w.showTrades && <ChartPositionDock order={selected} orders={positions} onSelect={w.selectTrade} onEdit={level => setEditing({ id: selected.id, level })} onFit={() => engine?.fitLevels([selected.openPrice, selected.sl, selected.tp].filter((p): p is number => p !== undefined))}/>}
  <div className="interactive-chart-caption"><span>{practice ? 'Practice · simulated prices' : preview ? 'Illustrative preview' : DEVELOPMENT_FEED ? 'Development feed' : 'Connected prices'}</span><div className="chart-attribution"><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">Charts by TradingView</a><a href="/licenses/lightweight-charts.txt" target="_blank" rel="noopener noreferrer" aria-label="Lightweight Charts licence and attribution notice">Licence</a></div><span>{selected && w.showTrades ? 'Drag SL / TP handles to adjust · ' : ''}UTC</span></div>
  {indicatorOpen && <IndicatorPanel onClose={() => setIndicatorOpen(false)}/>}
  {editing && positions.find(o => o.id === editing.id) && <ChartRiskEditor key={`${editing.id}:${editing.level}`} order={positions.find(o => o.id === editing.id)!} initialLevel={editing.level} onClose={() => setEditing(null)}/>}
 </section>;
}
