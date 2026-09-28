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
          spread: t.ask - t.bid,
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
}));
