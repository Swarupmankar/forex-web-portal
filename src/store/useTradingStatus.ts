import { create } from "zustand";
export type TradingMode = "enabled" | "close-only" | "halted";
export type TradingStatus = {
  mode: TradingMode;
  haltedSymbols: string[];
  env: "production" | "staging" | "development";
  version: string;
  serverTime: number;
};
type State = {
  status?: TradingStatus;
  // Set when the status endpoint can't be reached; connected execution fails closed.
  error?: string;
  loadedAt: number;
  refresh: () => Promise<void>;
};
const MODES = new Set(["enabled", "close-only", "halted"]);
// Runtime kill switch: the server decides enabled / close-only / halted without a rebuild.
export const useTradingStatus = create<State>((set) => ({
  loadedAt: 0,
  refresh: async () => {
    try {
      const response = await fetch("/api/trading/status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !MODES.has(data?.mode)) throw new Error("Unexpected status response");
      set({
        status: {
          mode: data.mode,
          haltedSymbols: Array.isArray(data.haltedSymbols) ? data.haltedSymbols.map(String) : [],
          env: ["production", "staging"].includes(data.env) ? data.env : "development",
          version: String(data.version ?? ""),
          serverTime: Number(data.serverTime) || Date.now(),
        },
        error: undefined,
        loadedAt: Date.now(),
      });
    } catch {
      set({ error: "Trading status is unavailable.", loadedAt: Date.now() });
    }
  },
}));
