'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, IPriceLine } from 'lightweight-charts';
import { useUIStore } from '@/store/useUIStore';
import { usePriceStore } from '@/store/usePriceStore';
import { useGetOpenOrdersQuery } from '@/store/api/tradingApi';
import { 
  CandlestickChart, 
  LineChart, 
  Settings, 
  Maximize2, 
  Camera, 
  RotateCcw, 
  SlidersHorizontal,
  Layers
} from 'lucide-react';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D'];

const toNum = (val: any) => {
  const n = typeof val === 'number' ? val : parseFloat(String(val || 0));
  return Number.isFinite(n) ? n : 0;
};

const generateHistoricalCandles = (basePrice: number): CandlestickData[] => {
  const candles: CandlestickData[] = [];
  const now = Math.floor(Date.now() / 1000);
  let currentPrice = basePrice;

  for (let i = 120; i >= 0; i--) {
    const time = (now - i * 60) as Time;
    const volatility = basePrice * 0.0012;
    const open = currentPrice + (Math.random() - 0.48) * volatility;
    const high = open + Math.random() * volatility;
    const low = open - Math.random() * volatility;
    const close = low + Math.random() * (high - low);
    currentPrice = close;

    candles.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
    });
  }
  return candles;
};

export const TradingChart: React.FC = () => {
  const { activeSymbol, activeTimeframe, setActiveTimeframe, chartType, setChartType } = useUIStore();
  const prices = usePriceStore((state) => state.prices);
  const { data: openOrdersData } = useGetOpenOrdersQuery(undefined);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const tick = prices[activeSymbol];
  const currentBid = tick ? tick.bid : 4377.85;

  // Chart Canvas Setup
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: '#161616' },
        textColor: '#b0b0b0',
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#b0f000',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: '#b0f000',
          width: 1,
          style: 3,
        },
      },
      timeScale: {
        borderColor: '#262626',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#262626',
      },
    });

    chartRef.current = chart;

    let series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>;

    if (chartType === 'candles') {
      series = chart.addCandlestickSeries({
        upColor: '#6fe08f',
        downColor: '#ff7b7b',
        borderVisible: false,
        wickUpColor: '#6fe08f',
        wickDownColor: '#ff7b7b',
      });
      const initialData = generateHistoricalCandles(currentBid);
      series.setData(initialData);
    } else {
      series = chart.addLineSeries({
        color: '#b0f000',
        lineWidth: 2,
      });
      const initialData = generateHistoricalCandles(currentBid).map((c) => ({
        time: c.time,
        value: c.close,
      }));
      series.setData(initialData);
    }

    seriesRef.current = series;

    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [activeSymbol, chartType]);

  // Project Price Lines Overlay on Chart whenever open orders change
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Clear old lines
    priceLinesRef.current.forEach((line) => {
      try { series.removePriceLine(line); } catch {}
    });
    priceLinesRef.current = [];

    const activeOrders = (openOrdersData?.openOrders || []).filter(
      (o: any) => (o.symbol || 'XAUUSD').toUpperCase() === activeSymbol.toUpperCase()
    );

    activeOrders.forEach((pos: any) => {
      const isBuy = String(pos.orderType || '').toUpperCase().includes('BUY');
      const entryPx = toNum(pos.orderDetails?.entryPrice || pos.openPrice || currentBid);
      const lotSize = toNum(pos.lotSize || pos.volume || 0.01);
      const tp = toNum(pos.tp);
      const sl = toNum(pos.sl);

      // Entry Price Line
      const entryLine = series.createPriceLine({
        price: entryPx,
        color: isBuy ? '#6fe08f' : '#ff7b7b',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${isBuy ? 'BUY' : 'SELL'} ${lotSize.toFixed(2)} @ ${entryPx.toFixed(2)}`,
      });
      priceLinesRef.current.push(entryLine);

      // TP Line
      if (tp > 0) {
        const tpLine = series.createPriceLine({
          price: tp,
          color: '#10b981',
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `TP ${tp.toFixed(2)}`,
        });
        priceLinesRef.current.push(tpLine);
      }

      // SL Line
      if (sl > 0) {
        const slLine = series.createPriceLine({
          price: sl,
          color: '#f43f5e',
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `SL ${sl.toFixed(2)}`,
        });
        priceLinesRef.current.push(slLine);
      }
    });
  }, [openOrdersData, activeSymbol, currentBid]);

  // Live tick update
  useEffect(() => {
    if (!seriesRef.current || !tick || !tick.bid) return;

    const now = Math.floor(Date.now() / 1000) as Time;
    const livePrice = tick.bid;

    if (chartType === 'candles') {
      const series = seriesRef.current as ISeriesApi<'Candlestick'>;
      series.update({
        time: now,
        open: livePrice,
        high: Number((livePrice * 1.0001).toFixed(2)),
        low: Number((livePrice * 0.9999).toFixed(2)),
        close: livePrice,
      });
    } else {
      const series = seriesRef.current as ISeriesApi<'Line'>;
      series.update({
        time: now,
        value: livePrice,
      });
    }
  }, [tick, chartType]);

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--mm-surface-2)] min-w-0">
      {/* Chart Toolbar */}
      <div className="h-[42px] px-3 border-b border-[var(--mm-hairline)] flex items-center justify-between bg-[var(--mm-surface)] select-none">
        {/* Left: Symbol Info */}
        <div className="flex items-center gap-3">
          <span className="font-bold text-xs text-[var(--mm-ink)] tracking-wider">{activeSymbol}</span>
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono">
            <span className="text-emerald-400">O: {(currentBid * 0.9998).toFixed(2)}</span>
            <span className="text-emerald-400">H: {(currentBid * 1.0005).toFixed(2)}</span>
            <span className="text-rose-400">L: {(currentBid * 0.9995).toFixed(2)}</span>
            <span className="text-emerald-400">C: {currentBid.toFixed(2)}</span>
            <span className="text-emerald-400 font-bold">+0.02 (+0.00%)</span>
          </div>
        </div>

        {/* Center: Timeframe & Chart Style Toggles */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 bg-[var(--mm-surface-2)] p-0.5 rounded-lg border border-[var(--mm-hairline)]">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setActiveTimeframe(tf)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  activeTimeframe === tf
                    ? 'bg-[var(--mm-hairline)] text-[var(--mm-accent)]'
                    : 'text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 bg-[var(--mm-surface-2)] p-0.5 rounded-lg border border-[var(--mm-hairline)]">
            <button
              onClick={() => setChartType('candles')}
              className={`p-1 rounded transition-colors ${
                chartType === 'candles' ? 'bg-[var(--mm-hairline)] text-[var(--mm-accent)]' : 'text-[var(--mm-ink-2)]'
              }`}
            >
              <CandlestickChart className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`p-1 rounded transition-colors ${
                chartType === 'line' ? 'bg-[var(--mm-hairline)] text-[var(--mm-accent)]' : 'text-[var(--mm-ink-2)]'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Tools & Overlay Indicator */}
        <div className="flex items-center gap-1 text-[var(--mm-ink-2)]">
          <span className="text-[10px] font-bold text-[var(--mm-accent)] bg-[var(--mm-surface-2)] px-2 py-0.5 rounded border border-[var(--mm-hairline)] flex items-center gap-1">
            <Layers className="w-3 h-3" /> Live Positions Overlay
          </span>
          <button className="p-1 rounded hover:bg-[var(--mm-surface-2)] hover:text-[var(--mm-ink)] transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 rounded hover:bg-[var(--mm-surface-2)] hover:text-[var(--mm-ink)] transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 rounded hover:bg-[var(--mm-surface-2)] hover:text-[var(--mm-ink)] transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 rounded hover:bg-[var(--mm-surface-2)] hover:text-[var(--mm-ink)] transition-colors">
            <Camera className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 rounded hover:bg-[var(--mm-surface-2)] hover:text-[var(--mm-ink)] transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="flex-1 w-full relative">
        <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
};
