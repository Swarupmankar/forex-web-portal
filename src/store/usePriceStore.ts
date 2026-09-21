import { create } from 'zustand';
import { PriceTick } from '@/types/trading';

interface PriceState {
  prices: Record<string, PriceTick>;
  updateTick: (symbol: string, bid: number, ask: number, mid?: number, ts?: number | string) => void;
  getTick: (symbol: string) => PriceTick | undefined;
}

// Default initial fallback prices so UI looks populated instantly
const INITIAL_PRICES: Record<string, PriceTick> = {
  XAUUSD: { symbol: 'XAUUSD', bid: 4377.85, ask: 4378.11, mid: 4377.98, spread: 26, change24h: 0.03, direction: 'same' },
  BTCUSD: { symbol: 'BTCUSD', bid: 81153.41, ask: 81160.00, mid: 81156.70, spread: 659, change24h: -0.47, direction: 'same' },
  ETHUSD: { symbol: 'ETHUSD', bid: 2631.13, ask: 2631.80, mid: 2631.46, spread: 67, change24h: 0.12, direction: 'same' },
  GBPUSD: { symbol: 'GBPUSD', bid: 1.33942, ask: 1.33955, mid: 1.33948, spread: 13, change24h: 0.03, direction: 'same' },
  EURUSD: { symbol: 'EURUSD', bid: 1.14843, ask: 1.14854, mid: 1.14848, spread: 11, change24h: 0.01, direction: 'same' },
  USDJPY: { symbol: 'USDJPY', bid: 156.871, ask: 156.885, mid: 156.878, spread: 14, change24h: 0.13, direction: 'same' },
  AUDUSD: { symbol: 'AUDUSD', bid: 0.71200, ask: 0.71212, mid: 0.71206, spread: 12, change24h: -0.07, direction: 'same' },
};

export const usePriceStore = create<PriceState>((set, get) => ({
  prices: INITIAL_PRICES,

  updateTick: (symbol, bid, ask, mid, ts) => {
    const current = get().prices[symbol];
    let direction: 'up' | 'down' | 'same' = 'same';

    if (current && current.bid !== undefined) {
      if (bid > current.bid) direction = 'up';
      else if (bid < current.bid) direction = 'down';
    }

    const calculatedMid = mid ?? Number(((bid + ask) / 2).toFixed(5));
    const calculatedSpread = Math.round(Math.abs(ask - bid) * 100);

    set((state) => ({
      prices: {
        ...state.prices,
        [symbol]: {
          symbol,
          bid,
          ask,
          mid: calculatedMid,
          spread: calculatedSpread,
          change24h: current?.change24h ?? 0.0,
          direction,
          timestamp: ts ?? Date.now(),
        },
      },
    }));
  },

  getTick: (symbol) => get().prices[symbol],
}));
