import { create } from "zustand";
import { PriceTick } from "@/types/trading";
export type RawTick = { symbol: string; bid: number; ask: number; mid?: number; sourceTs?: number; lagMs?: number; receivedAt: number };
interface PriceState {
  prices: Record<string, PriceTick>;
  connection: "connecting" | "connected" | "disconnected";
  lastReceivedAt: number;
  setConnection: (v: PriceState["connection"]) => void;
  // Applies a batch of ticks in one update, so a burst of socket messages causes one render.
  applyTicks: (ticks: RawTick[]) => void;
  getTick: (symbol: string) => PriceTick | undefined;
  // Removes prices the feed says no longer exist (NO_PRICE / FEED_DOWN): blank, never stale.
  clearPrices: (symbols: string[]) => void;
  // Marks every held quote as current at `now` (an open feed is silent while nothing changes).
  touch: (now: number) => void;
}
export const usePriceStore = create<PriceState>((set, get) => ({
  prices: {},
  connection: "disconnected",
  lastReceivedAt: 0,
  setConnection: (connection) => set({ connection }),
  applyTicks: (ticks) => {
    const valid = ticks.filter((t) => Number.isFinite(t.bid) && Number.isFinite(t.ask) && t.bid > 0 && t.ask >= t.bid);
    if (!valid.length) return;
    set((s) => {
      const prices = { ...s.prices };
      for (const t of valid) {
        const previous = prices[t.symbol]?.bid ?? t.bid;
        prices[t.symbol] = {
          symbol: t.symbol,
          bid: t.bid,
          ask: t.ask,
          mid: t.mid,
          timestamp: t.receivedAt,
          sourceTs: t.sourceTs,
          lagMs: t.lagMs,
          direction: t.bid > previous ? "up" : t.bid < previous ? "down" : "same",
        };
      }
      return { prices, lastReceivedAt: Math.max(...valid.map((t) => t.receivedAt)) };
    });
  },
  getTick: (symbol) => get().prices[symbol],
  clearPrices: (symbols) =>
    set((s) => {
      if (!symbols.some((symbol) => symbol in s.prices)) return s;
      const prices = { ...s.prices };
      for (const symbol of symbols) delete prices[symbol];
      return { prices };
    }),
  touch: (now) =>
    set((s) => {
      const prices: Record<string, PriceTick> = {};
      for (const [symbol, tick] of Object.entries(s.prices)) prices[symbol] = { ...tick, timestamp: now };
      return { prices, lastReceivedAt: now };
    }),
}));
