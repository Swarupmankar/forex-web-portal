'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle, type AutoscaleInfo, type IChartApi, type ISeriesApi, type IPriceLine, type UTCTimestamp, type LogicalRange } from 'lightweight-charts';
import { applyTick, reconcileBars, MAX_BARS, type Candle, type LiveCandles } from '@/lib/chart';
import { type StudyKey, type Studies } from '@/lib/indicators';
import { createStudyCache } from '@/lib/streamingStudies';
import { subscribeCandleTicks, type CandleSource } from '@/services/candleFeed';
import type { PriceTick } from '@/types/trading';
export type ChartLevel = {
    id: string;
    price: number;
    title: string;
    color: string;
    selected?: boolean;
    kind?: 'entry' | 'sl' | 'tp';
};
export type ChartEngine = {
    alive: () => boolean;
    chart: IChartApi;
    series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>;
    resize: () => void;
    changed: () => void;
    subscribe: (cb: () => void) => () => void;
    setLevels: (levels: ChartLevel[]) => void;
    freeze: (freeze: boolean) => void;
    fitLevels: (prices: number[]) => void;
    resetScale: () => void;
    latest: () => void;
    zoom: (factor: number) => void;
    snapshot: () => string;
};
// Price-axis font size; overlays aligned to axis labels size themselves from it.
export const CHART_FONT_SIZE = 12;
type StudyLine = 'sma' | 'ema' | 'middle' | 'upper' | 'lower' | 'rsi';
const STUDY_LINES: [StudyKey, StudyLine[]][] = [['sma', ['sma']], ['ema', ['ema']], ['bollinger', ['middle', 'upper', 'lower']], ['rsi', ['rsi']]];
// Index of the first bar opened at or after `time` (changes only ever touch the newest bars).
function firstIndexFrom(bars: Candle[], time: number) {
    let i = bars.length;
    while (i > 0 && bars[i - 1].time >= time)
        i--;
    return i;
}
// Study points per bar; bars without a value (warm-up) get whitespace so both panes keep the same bar indexes.
const studyPoint = (time: number, value: number | undefined) => value === undefined ? { time: time as UTCTimestamp } : { time: time as UTCTimestamp, value };
type Palette = { up: string; down: string; muted: string };
const FALLBACK_PALETTE: Record<'dark' | 'light', Palette> = { dark: { up: '#16a773', down: '#e05260', muted: '#a0a5a1' }, light: { up: '#16a773', down: '#e05260', muted: '#66717e' } };
// Theme colours for the bid/ask lines from the page's CSS tokens, normalised through a canvas
// to hex/rgba because the chart cannot parse every CSS colour syntax.
function readPalette(theme: 'dark' | 'light'): Palette {
    const fallback = FALLBACK_PALETTE[theme];
    const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    if (!ctx)
        return fallback;
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string, color: string) => {
        const raw = styles.getPropertyValue(name).trim();
        if (!raw)
            return color;
        ctx.fillStyle = color;
        ctx.fillStyle = raw; // an invalid value leaves the fallback in place
        return String(ctx.fillStyle);
    };
    return { up: read('--mm-pos', fallback.up), down: read('--mm-neg', fallback.down), muted: read('--mm-ink-2', fallback.muted) };
}
type ChartOps = {
    load: (history: Candle[], identity: string) => void;
    refreshStudies: () => void;
    showQuote: (bid: number | undefined, ask: number | undefined, visible: boolean, stale: boolean) => void;
};
export function useChartEngine({ host, rsiHost, candles, symbol, source, identity, interval, digits, kind, theme, grid, studies, quote, showBidAsk, quoteStale, onHover, onLatest, onPick }: {
    host: RefObject<HTMLDivElement | null>;
    rsiHost: RefObject<HTMLDivElement | null>;
    // Server (or preview) history for `identity`.
    candles: Candle[];
    // Live ticks for this symbol are aggregated from `source` into the last bars.
    symbol: string;
    source: CandleSource;
    identity: string;
    interval: number;
    digits: number;
    kind: 'candles' | 'line';
    theme: 'dark' | 'light';
    grid: boolean;
    studies: Studies;
    // The executable quote, drawn as bid/ask lines when `showBidAsk`.
    quote?: PriceTick;
    showBidAsk: boolean;
    quoteStale: boolean;
    onHover: (c: Candle | undefined) => void;
    onLatest: (c: Candle | undefined) => void;
    onPick: (price: number) => void;
}) {
    const [engine, setEngine] = useState<ChartEngine | null>(null);
    const studyRef = useRef(studies), hoverRef = useRef(onHover), latestRef = useRef(onLatest), pickRef = useRef(onPick);
    studyRef.current = studies;
    hoverRef.current = onHover;
    latestRef.current = onLatest;
    pickRef.current = onPick;
    // Live bars outlive any one chart instance (switching candles/line keeps them). `identity` says
    // which symbol, timeframe and mode they belong to.
    const live = useRef<LiveCandles & { identity: string }>({ bars: [], newest: -Infinity, identity: '' });
    const feed = useRef({ symbol, source, identity, interval });
    feed.current = { symbol, source, identity, interval };
    const redraw = useRef<(since: number) => void>(() => { });
    const ops = useRef<ChartOps | null>(null);
    const palette = useRef<Palette>(FALLBACK_PALETTE[theme]);
    const rsiChart = useRef<IChartApi | null>(null);
    const lastIdentity = useRef('');
    useEffect(() => {
        if (!host.current || !rsiHost.current)
            return;
        // TradingChart supplies the visible TradingView link; the notice is in public/licenses.
        const api = createChart(host.current, {
            layout: { attributionLogo: false, background: { type: ColorType.Solid, color: '#161616' }, textColor: '#a0a5a1', fontFamily: 'Inter, sans-serif', fontSize: CHART_FONT_SIZE },
            crosshair: { mode: CrosshairMode.Normal },
            rightPriceScale: { borderVisible: false, minimumWidth: 76, scaleMargins: { top: 0.15, bottom: 0.15 } },
            timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 14, barSpacing: 8, minBarSpacing: 3, rightBarStaysOnScroll: true, borderVisible: false },
            handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
            kineticScroll: { mouse: true, touch: true },
        });
        const main = kind === 'candles'
            ? api.addCandlestickSeries({ upColor: '#16a77a', downColor: '#ef5350', wickUpColor: '#16a77a', wickDownColor: '#ef5350', borderVisible: false })
            : api.addLineSeries({ color: '#16a773', lineWidth: 2 });
        const oscillator = createChart(rsiHost.current, {
            layout: { attributionLogo: false, background: { type: ColorType.Solid, color: '#161616' }, textColor: '#a0a5a1', fontSize: 10 },
            rightPriceScale: { borderVisible: false, minimumWidth: 76, scaleMargins: { top: 0.12, bottom: 0.12 } },
            timeScale: { visible: false },
            crosshair: { mode: CrosshairMode.Normal },
            handleScroll: false,
            handleScale: false,
        });
        rsiChart.current = oscillator;
        const lines = {} as Record<StudyLine, ISeriesApi<'Line'>>;
        for (const [name, color] of [['sma', '#ddad45'], ['ema', '#58a6e7'], ['middle', '#ad8ade'], ['upper', '#ad8ade'], ['lower', '#ad8ade']] as [StudyLine, string][]) {
            lines[name] = api.addLineSeries({ color, lineWidth: name === 'sma' || name === 'ema' ? 2 : 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, visible: false });
        }
        lines.rsi = oscillator.addLineSeries({ color: '#b28ce8', lineWidth: 2, priceLineVisible: false, lastValueVisible: true, priceFormat: { type: 'price', precision: 1, minMove: 0.1 }, autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
        [30, 70].forEach(price => lines.rsi.createPriceLine({ price, color: '#727b87', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' }));
        const subscribers = new Set<() => void>();
        let frame = 0, hoverFrame = 0, disposed = false, syncing = false, notify = false;
        // Bars changed since the last frame (open time of the oldest), and the first bar the series holds.
        let dirtySince: number | null = null, seriesStart: number | undefined;
        const setBars = (bars: Candle[]) => {
            seriesStart = bars[0]?.time;
            if (kind === 'candles')
                (main as ISeriesApi<'Candlestick'>).setData(bars.map(c => ({ ...c, time: c.time as UTCTimestamp })));
            else
                (main as ISeriesApi<'Line'>).setData(bars.map(c => ({ time: c.time as UTCTimestamp, value: c.close })));
        };
        const updateBar = (c: Candle) => {
            if (kind === 'candles')
                (main as ISeriesApi<'Candlestick'>).update({ ...c, time: c.time as UTCTimestamp });
            else
                (main as ISeriesApi<'Line'>).update({ time: c.time as UTCTimestamp, value: c.close });
        };
        const sync = (from: IChartApi, to: IChartApi, range: LogicalRange | null) => {
            if (syncing || !range)
                return;
            syncing = true;
            to.timeScale().setVisibleLogicalRange(range);
            syncing = false;
            changed();
        };
        const mainRange = (range: LogicalRange | null) => sync(api, oscillator, range);
        const shownStudies = new Set<StudyLine>();
        const studyCache = createStudyCache();
        let studyStart: number | undefined;
        // Recomputes enabled studies only. With `since`, just the points from that bar on are sent to
        // the chart: earlier values cannot change while the first bar (the warm-up seed) is the same.
        const refreshStudies = (since?: number) => {
            const bars = live.current.bars, s = studyRef.current;
            const incremental = since !== undefined && bars[0]?.time === studyStart;
            studyStart = bars[0]?.time;
            let any = false;
            for (const [key, names] of STUDY_LINES) {
                if (!s[key].enabled) {
                    for (const name of names) {
                        if (!shownStudies.delete(name))
                            continue;
                        lines[name].applyOptions({ visible: false });
                        lines[name].setData([]);
                    }
                    continue;
                }
                any = true;
                const values = studyCache.values(key, bars, s[key], incremental ? since : undefined);
                for (const name of names) {
                    const points = values[name] ?? [];
                    if (incremental && shownStudies.has(name)) {
                        const tail = new Map<number, number>();
                        for (let i = points.length - 1; i >= 0 && points[i].time >= since; i--)
                            tail.set(points[i].time, points[i].value);
                        for (let i = firstIndexFrom(bars, since); i < bars.length; i++)
                            lines[name].update(studyPoint(bars[i].time, tail.get(bars[i].time)));
                        continue;
                    }
                    const byTime = new Map(points.map(p => [p.time, p.value]));
                    lines[name].setData(bars.map(c => studyPoint(c.time, byTime.get(c.time))));
                    if (!shownStudies.has(name)) {
                        shownStudies.add(name);
                        lines[name].applyOptions({ visible: true });
                    }
                }
            }
            if (any)
                mainRange(api.timeScale().getVisibleLogicalRange());
        };
        // Sends the bars changed since the last frame to the chart. Ticks only touch the bar array.
        const drawLive = () => {
            if (dirtySince === null)
                return;
            const bars = live.current.bars, since = dirtySince;
            dirtySince = null;
            const first = firstIndexFrom(bars, since);
            if (first === bars.length)
                return;
            // A trimmed oldest bar (the cap) or a long backlog (a hidden tab) redraws everything.
            if (bars[0].time !== seriesStart || bars.length - first > 500)
                setBars(bars);
            else {
                try {
                    for (let i = first; i < bars.length; i++)
                        updateBar(bars[i]);
                }
                catch {
                    setBars(bars);
                }
            }
            refreshStudies(since);
            latestRef.current(bars[bars.length - 1]);
            notify = true;
        };
        // One animation frame draws pending bars, then notifies subscribers once.
        const flush = () => {
            try {
                if (!disposed)
                    drawLive();
            }
            finally {
                frame = 0;
            }
            if (disposed || !notify)
                return;
            notify = false;
            subscribers.forEach(cb => cb());
        };
        const schedule = () => {
            if (!frame && !disposed)
                frame = requestAnimationFrame(flush);
        };
        const changed = () => {
            notify = true;
            schedule();
        };
        redraw.current = since => {
            dirtySince = dirtySince === null ? since : Math.min(dirtySince, since);
            schedule();
        };
        api.timeScale().subscribeVisibleLogicalRangeChange(mainRange);
        api.subscribeCrosshairMove(param => {
            cancelAnimationFrame(hoverFrame);
            const candle = param.time ? live.current.bars.find(c => c.time === param.time) : undefined;
            hoverFrame = requestAnimationFrame(() => {
                if (!disposed)
                    hoverRef.current(candle);
            });
            changed();
        });
        api.subscribeClick(param => {
            if (!param.point)
                return;
            const price = main.coordinateToPrice(param.point.y);
            if (price !== null && price > 0)
                pickRef.current(Number(price));
        });
        const resize = () => {
            if (disposed || !host.current || !rsiHost.current)
                return;
            api.resize(Math.max(1, host.current.clientWidth), Math.max(1, host.current.clientHeight));
            oscillator.resize(Math.max(1, rsiHost.current.clientWidth), Math.max(1, rsiHost.current.clientHeight));
            mainRange(api.timeScale().getVisibleLogicalRange());
            changed();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host.current);
        observer.observe(rsiHost.current);
        const hostNode = host.current;
        hostNode.addEventListener('pointermove', changed);
        hostNode.addEventListener('wheel', changed, { passive: true });
        const priceLines = new Map<string, IPriceLine>();
        let wasAuto = true, frozen = false;
        let fittedPrices: number[] = [];
        main.applyOptions({ autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
            const info = original();
            if (info && fittedPrices.length) {
                info.priceRange.minValue = Math.min(info.priceRange.minValue, ...fittedPrices);
                info.priceRange.maxValue = Math.max(info.priceRange.maxValue, ...fittedPrices);
            }
            return info;
        } });
        // Solid bid and dashed ask from the executable quote, moved in place on every quote. Their axis
        // labels show the bid and ask prices; the series' own last-price line stands in while they are hidden.
        const bidLine = main.createPriceLine({ price: 0, color: FALLBACK_PALETTE.dark.down, lineWidth: 1, lineStyle: LineStyle.Solid, lineVisible: false, axisLabelVisible: false, title: '' });
        const askLine = main.createPriceLine({ price: 0, color: FALLBACK_PALETTE.dark.up, lineWidth: 1, lineStyle: LineStyle.Dashed, lineVisible: false, axisLabelVisible: false, title: '' });
        let quoteShown: boolean | undefined;
        const showQuote = (bid: number | undefined, ask: number | undefined, visible: boolean, stale: boolean) => {
            const on = visible && bid !== undefined && ask !== undefined && bid > 0 && ask >= bid;
            if (on !== quoteShown) {
                quoteShown = on;
                main.applyOptions({ priceLineVisible: !on, lastValueVisible: !on });
            }
            const colors = palette.current;
            bidLine.applyOptions({ color: stale ? colors.muted : colors.down, lineVisible: on, axisLabelVisible: on, ...(on ? { price: bid } : {}) });
            askLine.applyOptions({ color: stale ? colors.muted : colors.up, lineVisible: on, axisLabelVisible: on, ...(on ? { price: ask } : {}) });
        };
        // History arrived or was refetched. For the same symbol, timeframe and mode it is merged with
        // the live bars (which may be newer); anything else starts again from the history alone.
        const load = (history: Candle[], identity: string) => {
            const state = live.current;
            if (state.identity === identity)
                state.bars = reconcileBars(history, state.bars);
            else
                Object.assign(state, { bars: history.slice(-MAX_BARS), newest: -Infinity, identity });
            dirtySince = null;
            setBars(state.bars);
            refreshStudies();
            latestRef.current(state.bars[state.bars.length - 1]);
            changed();
        };
        const result: ChartEngine = {
            alive: () => !disposed,
            chart: api,
            series: main,
            resize,
            changed,
            subscribe: cb => {
                subscribers.add(cb);
                return () => { subscribers.delete(cb); };
            },
            setLevels: levels => {
                if (disposed)
                    return;
                const valid = levels.filter(l => Number.isFinite(l.price) && l.price > 0);
                if (fittedPrices.length)
                    fittedPrices = valid.filter(l => l.selected).map(l => l.price);
                const ids = new Set(valid.map(l => l.id));
                priceLines.forEach((line, id) => {
                    if (!ids.has(id)) {
                        main.removePriceLine(line);
                        priceLines.delete(id);
                    }
                });
                valid.forEach(l => {
                    const nativeLabel = !l.kind && Boolean(l.title);
                    const options = { price: l.price, color: l.color, title: nativeLabel ? l.title : '', lineWidth: 1 as const, lineStyle: l.kind === 'entry' && l.selected ? 0 as const : 2 as const, axisLabelVisible: nativeLabel };
                    const existing = priceLines.get(l.id);
                    if (existing)
                        existing.applyOptions(options);
                    else
                        priceLines.set(l.id, main.createPriceLine(options));
                });
                changed();
            },
            fitLevels: prices => {
                fittedPrices = prices.filter(p => Number.isFinite(p) && p > 0);
                main.priceScale().applyOptions({ autoScale: true });
                changed();
            },
            resetScale: () => {
                fittedPrices = [];
                main.priceScale().applyOptions({ autoScale: true });
                changed();
            },
            freeze: freeze => {
                if (disposed || frozen === freeze)
                    return;
                frozen = freeze;
                if (freeze) {
                    wasAuto = main.priceScale().options().autoScale;
                    main.priceScale().applyOptions({ autoScale: false });
                }
                else
                    main.priceScale().applyOptions({ autoScale: wasAuto });
                api.applyOptions({ handleScroll: { mouseWheel: !freeze, pressedMouseMove: !freeze, horzTouchDrag: !freeze }, handleScale: { mouseWheel: !freeze, pinch: !freeze, axisPressedMouseMove: !freeze } });
                changed();
            },
            latest: () => {
                fittedPrices = [];
                api.timeScale().scrollToRealTime();
                main.priceScale().applyOptions({ autoScale: true });
                changed();
            },
            zoom: factor => {
                const range = api.timeScale().getVisibleLogicalRange();
                if (!range)
                    return;
                const span = Math.max(12, Math.min(500, (range.to - range.from) * factor));
                api.timeScale().setVisibleLogicalRange({ from: range.to - span, to: range.to });
                changed();
            },
            snapshot: () => api.takeScreenshot().toDataURL('image/png'),
        };
        ops.current = { load, refreshStudies: () => refreshStudies(), showQuote };
        lastIdentity.current = '';
        setEngine(result);
        resize();
        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            cancelAnimationFrame(hoverFrame);
            observer.disconnect();
            hostNode.removeEventListener('pointermove', changed);
            hostNode.removeEventListener('wheel', changed);
            subscribers.clear();
            redraw.current = () => { };
            ops.current = null;
            api.remove();
            oscillator.remove();
            rsiChart.current = null;
        };
    }, [host, rsiHost, kind]);
    // Every tick is folded into the live bars as it arrives, even while the tab is hidden and no
    // frames run; only the drawing waits for the next frame.
    useEffect(() => subscribeCandleTicks(symbol, source, (bid, timeMs) => {
        const current = feed.current;
        if (current.symbol !== symbol || current.source !== source)
            return; // this subscription is being replaced
        const state = live.current;
        if (state.identity !== current.identity)
            Object.assign(state, { bars: [], newest: -Infinity, identity: current.identity });
        const since = applyTick(state, bid, timeMs / 1000, current.interval);
        if (since !== undefined)
            redraw.current(since);
    }), [symbol, source]);
    useEffect(() => {
        if (engine?.alive())
            engine.series.applyOptions({ priceFormat: { type: 'price', precision: digits, minMove: 10 ** -digits } });
    }, [engine, digits]);
    useEffect(() => {
        if (!engine?.alive() || !ops.current)
            return;
        ops.current.load(candles, identity);
        if (candles.length && lastIdentity.current !== identity) {
            const count = live.current.bars.length;
            engine.resetScale();
            const width = engine.chart.timeScale().width();
            const slots = Math.max(30, Math.min(110, Math.floor(width / 8)));
            const gutter = Math.max(7, Math.floor(slots * .22));
            engine.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, count - slots + gutter), to: count + gutter });
            lastIdentity.current = identity;
        }
    }, [engine, candles, identity]);
    useEffect(() => {
        if (!engine?.alive())
            return;
        const dark = theme === 'dark', bg = dark ? '#161616' : '#ffffff', text = dark ? '#a0a5a1' : '#66717e', line = dark ? '#262a27' : '#edf0f3';
        for (const c of [engine.chart, rsiChart.current])
            c?.applyOptions({ layout: { background: { type: ColorType.Solid, color: bg }, textColor: text }, grid: { vertLines: { color: line, visible: grid }, horzLines: { color: line, visible: grid } }, crosshair: { vertLine: { width: 1, style: LineStyle.Dashed, color: text, labelBackgroundColor: dark ? '#424742' : '#66717e' }, horzLine: { width: 1, style: LineStyle.Dashed, color: text, labelBackgroundColor: dark ? '#424742' : '#66717e' } } });
        palette.current = readPalette(theme);
    }, [engine, theme, grid]);
    const bid = quote?.bid, ask = quote?.ask;
    useEffect(() => {
        if (engine?.alive())
            ops.current?.showQuote(bid, ask, showBidAsk, quoteStale);
    }, [engine, bid, ask, showBidAsk, quoteStale, theme]);
    useEffect(() => {
        if (engine?.alive()) {
            ops.current?.refreshStudies();
            engine.resize();
        }
    }, [engine, studies]);
    return engine;
}
