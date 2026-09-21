'use client';

import React from 'react';
import { useUIStore } from '@/store/useUIStore';
import { usePriceStore } from '@/store/usePriceStore';
import { usePlaceOrderMutation } from '@/store/api/tradingApi';
import { Minus, Plus, AlertCircle, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';

const LOT_PRESETS = [0.01, 0.10, 0.50, 1.00];

export const OrderEntry: React.FC = () => {
  const {
    activeSymbol,
    orderMode,
    setOrderMode,
    selectedOrderSide,
    setSelectedOrderSide,
    volumeLots,
    setVolumeLots,
    enableTPSL,
    setEnableTPSL,
    takeProfit,
    setTakeProfit,
    stopLoss,
    setStopLoss,
  } = useUIStore();

  const prices = usePriceStore((state) => state.prices);
  const [placeOrder, { isLoading }] = usePlaceOrderMutation();

  const tick = prices[activeSymbol];
  const bidPrice = tick ? tick.bid : 4377.85;
  const askPrice = tick ? tick.ask : 4378.11;

  const handleExecuteOrder = async () => {
    try {
      await placeOrder({
        symbol: activeSymbol,
        orderType: selectedOrderSide,
        volume: volumeLots,
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        executionMode: orderMode,
      }).unwrap();
      alert(`Order placed successfully! ${selectedOrderSide} ${volumeLots} lots of ${activeSymbol}`);
    } catch (e) {
      // simulate client side order execution for demo
      alert(`Demo Order Executed! ${selectedOrderSide} ${volumeLots} lots of ${activeSymbol} at ${selectedOrderSide === 'BUY' ? askPrice : bidPrice}`);
    }
  };

  return (
    <aside className="w-[300px] h-full bg-[var(--mm-surface)] border-l border-[var(--mm-hairline)] flex flex-col p-3.5 select-none overflow-y-auto no-scrollbar">
      {/* Title & Category Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--mm-hairline)]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[var(--mm-accent)] text-black font-extrabold flex items-center justify-center text-xs">
            {activeSymbol.substring(0, 1)}
          </div>
          <span className="font-bold text-sm text-[var(--mm-ink)]">{activeSymbol}</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--mm-surface-2)] text-[var(--mm-ink-2)] border border-[var(--mm-hairline)]">
          METALS
        </span>
      </div>

      {/* Order Execution Mode Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--mm-surface-2)] rounded-lg border border-[var(--mm-hairline)] my-3">
        <button
          onClick={() => setOrderMode('MARKET')}
          className={`py-1.5 text-xs font-bold rounded-md transition-all ${
            orderMode === 'MARKET'
              ? 'bg-[var(--mm-surface)] text-[var(--mm-ink)] shadow-sm'
              : 'text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]'
          }`}
        >
          Market
        </button>
        <button
          onClick={() => setOrderMode('PENDING')}
          className={`py-1.5 text-xs font-bold rounded-md transition-all ${
            orderMode === 'PENDING'
              ? 'bg-[var(--mm-surface)] text-[var(--mm-ink)] shadow-sm'
              : 'text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]'
          }`}
        >
          Pending
        </button>
      </div>

      {/* Buy / Sell Buttons */}
      <div className="grid grid-cols-2 gap-2 my-2">
        {/* Sell Button */}
        <button
          onClick={() => setSelectedOrderSide('SELL')}
          className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
            selectedOrderSide === 'SELL'
              ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-[0_0_12px_rgba(255,123,123,0.3)]'
              : 'bg-[var(--mm-surface-2)] border-[var(--mm-hairline)] text-[var(--mm-ink-2)] hover:border-rose-500/50'
          }`}
        >
          <span className="text-[10px] font-bold tracking-wider uppercase text-rose-400 flex items-center gap-0.5">
            SELL <ArrowDownRight className="w-3 h-3" />
          </span>
          <span className="text-sm font-mono font-extrabold text-rose-400 mt-0.5">{bidPrice.toFixed(2)}</span>
        </button>

        {/* Buy Button */}
        <button
          onClick={() => setSelectedOrderSide('BUY')}
          className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
            selectedOrderSide === 'BUY'
              ? 'bg-sky-500/20 border-sky-500 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
              : 'bg-[var(--mm-surface-2)] border-[var(--mm-hairline)] text-[var(--mm-ink-2)] hover:border-sky-500/50'
          }`}
        >
          <span className="text-[10px] font-bold tracking-wider uppercase text-sky-400 flex items-center gap-0.5">
            BUY <ArrowUpRight className="w-3 h-3" />
          </span>
          <span className="text-sm font-mono font-extrabold text-sky-400 mt-0.5">{askPrice.toFixed(2)}</span>
        </button>
      </div>

      {/* Market Sentiment Gauge */}
      <div className="my-2 space-y-1">
        <div className="flex justify-between text-[10px] font-semibold text-[var(--mm-ink-3)]">
          <span>50.4% Sell</span>
          <span>49.6% Buy</span>
        </div>
        <div className="w-full h-1.5 bg-rose-500/40 rounded-full overflow-hidden flex">
          <div className="h-full bg-rose-500" style={{ width: '50.4%' }} />
          <div className="h-full bg-sky-500" style={{ width: '49.6%' }} />
        </div>
      </div>

      {/* Volume (Lots) Stepper & Presets */}
      <div className="my-3 space-y-2 border-t border-[var(--mm-hairline)] pt-3">
        <div className="flex justify-between items-center text-xs font-bold text-[var(--mm-ink)]">
          <span>VOLUME (LOTS)</span>
          <span className="text-[10px] text-[var(--mm-ink-3)]">Max 0.20 lots</span>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVolumeLots(volumeLots - 0.01)}
            className="w-9 h-9 rounded-lg bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] flex items-center justify-center text-[var(--mm-ink)] font-bold hover:bg-[var(--mm-hairline)] transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            type="number"
            step="0.01"
            value={volumeLots}
            onChange={(e) => setVolumeLots(parseFloat(e.target.value) || 0.01)}
            className="flex-1 text-center bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] text-sm font-mono font-bold py-1.5 rounded-lg text-[var(--mm-ink)] focus:outline-none focus:border-[var(--mm-accent)]"
          />
          <button
            onClick={() => setVolumeLots(volumeLots + 0.01)}
            className="w-9 h-9 rounded-lg bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] flex items-center justify-center text-[var(--mm-ink)] font-bold hover:bg-[var(--mm-hairline)] transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {LOT_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setVolumeLots(preset)}
              className={`py-1 rounded text-[11px] font-mono font-semibold border transition-colors ${
                volumeLots === preset
                  ? 'bg-[var(--mm-accent)] text-black border-[var(--mm-accent)] font-bold'
                  : 'bg-[var(--mm-surface-2)] border-[var(--mm-hairline)] text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]'
              }`}
            >
              {preset.toFixed(2)}
            </button>
          ))}
        </div>
      </div>

      {/* TP / SL Toggle */}
      <div className="my-2 border-t border-[var(--mm-hairline)] pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--mm-ink)]">TP / SL</span>
          <button
            onClick={() => setEnableTPSL(!enableTPSL)}
            className={`w-8 h-4.5 rounded-full transition-colors relative p-0.5 ${
              enableTPSL ? 'bg-[var(--mm-accent)]' : 'bg-[var(--mm-hairline)]'
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-black transition-transform ${
                enableTPSL ? 'translate-x-3.5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {enableTPSL && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[10px] font-bold text-emerald-400 block mb-1">Take Profit</label>
              <input
                type="number"
                placeholder="4400.00"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] text-xs font-mono py-1 px-2 rounded-lg text-[var(--mm-ink)] focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-rose-400 block mb-1">Stop Loss</label>
              <input
                type="number"
                placeholder="4350.00"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] text-xs font-mono py-1 px-2 rounded-lg text-[var(--mm-ink)] focus:outline-none focus:border-rose-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Execution Action Button */}
      <div className="mt-auto pt-3">
        <button
          onClick={handleExecuteOrder}
          disabled={isLoading}
          className={`w-full py-3 rounded-xl font-extrabold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all shadow-lg ${
            selectedOrderSide === 'BUY'
              ? 'bg-sky-500 hover:bg-sky-400 text-black shadow-sky-500/20'
              : 'bg-rose-500 hover:bg-rose-400 text-black shadow-rose-500/20'
          }`}
        >
          {selectedOrderSide === 'BUY' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          Place {selectedOrderSide} Order at {selectedOrderSide === 'BUY' ? askPrice.toFixed(2) : bidPrice.toFixed(2)}
        </button>
      </div>
    </aside>
  );
};
