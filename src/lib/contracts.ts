import type { SymbolItem } from "@/types/trading";
// Verified against Paper Trading's useChart.ts and services/models/login.ts.
export const CHART_INTERVALS: Record<
  string,
  { interval: "minute" | "hourly" | "daily"; period: number }
> = {
  "1m": { interval: "minute", period: 1 },
  "5m": { interval: "minute", period: 5 },
  "15m": { interval: "minute", period: 15 },
  "1h": { interval: "hourly", period: 1 },
  "4h": { interval: "hourly", period: 4 },
  "1D": { interval: "daily", period: 1 },
};
export interface TradeRequest {
  symbol: string;
  orderType: "BUY" | "SELL";
  executionType: "MARKET" | "LIMIT" | "STOP";
  lotSize: number;
  limitPrice?: number;
  sl?: number;
  tp?: number;
}
export function normalizeInstruments(response: unknown): SymbolItem[] {
  const r = response as any;
  const rows = Array.isArray(r) ? r : (r?.stocks ?? r?.data ?? []);
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((i) => typeof i.symbol === "string")
    .map((i) => {
      const group = String(
        i.category ?? i.currencyGroup ?? i.currency_group ?? "",
      ).toLowerCase();
      const category = group.includes("metal")
        ? "Metals"
        : group.includes("crypto")
          ? "Crypto"
          : group.includes("indice") || group.includes("index")
            ? "Indices"
            : group.includes("forex") ||
                group.includes("currency") ||
                group.includes("major") ||
                group.includes("minor") ||
                group.includes("exotic")
              ? "Forex"
              : "All";
      return {
        ...i,
        id: i.id ?? i.symbol,
        name:
          i.name ??
          `${i.currencyBase ?? i.currency_base ?? i.symbol} / ${i.currencyQuote ?? i.currency_quote ?? "USD"}`,
        category,
        pipSize: Number(i.pipSize ?? i.pip_size) || undefined,
        contractSize: Number(i.contractSize ?? i.contract_size) || undefined,
        spreadPips:
          i.spreadPips === undefined ? undefined : Number(i.spreadPips),
        minLots: Number(i.minLots ?? i.min_lot ?? i.minLot) || undefined,
        maxLots: Number(i.maxLots ?? i.max_lot ?? i.maxLot) || undefined,
        lotStep: Number(i.lotStep ?? i.lot_step) || undefined,
      };
    });
}
export function validateTrade(
  order: TradeRequest,
  referencePrice?: number,
): string | null {
  if (!order.symbol || !Number.isFinite(order.lotSize) || order.lotSize <= 0)
    return "Enter a volume greater than zero.";
  const entry =
    order.executionType === "MARKET" ? referencePrice : order.limitPrice;
  if (!entry || !Number.isFinite(entry) || entry <= 0)
    return "A valid entry price is required.";
  for (const [key, label] of [
    ["sl", "Stop loss"],
    ["tp", "Take profit"],
  ] as const) {
    const n = order[key];
    if (n !== undefined && (!Number.isFinite(n) || n <= 0))
      return `${label} must be greater than zero.`;
  }
  const buy = order.orderType === "BUY";
  // Market orders are checked against the live price, so say so rather than "entry".
  const ref = order.executionType === "MARKET" ? "current price" : "entry price";
  if (order.sl !== undefined && (buy ? order.sl >= entry : order.sl <= entry))
    return `Stop loss must be ${buy ? "below" : "above"} the ${ref}.`;
  if (order.tp !== undefined && (buy ? order.tp <= entry : order.tp >= entry))
    return `Take profit must be ${buy ? "above" : "below"} the ${ref}.`;
  if (referencePrice && order.executionType !== "MARKET") {
    const above = entry > referencePrice;
    if (
      entry === referencePrice ||
      (order.executionType === "LIMIT"
        ? buy
          ? above
          : !above
        : buy
          ? !above
          : above)
    )
      return "The pending price is on the wrong side of the market for this order type.";
  }
  return null;
}

export function accountQuote(
  tick: import("@/types/trading").PriceTick | undefined,
  meta?: import("@/types/trading").SymbolItem,
) {
  if (!tick) return undefined;
  const spread = Number(meta?.spreadPips),
    pip = Number(meta?.pipSize);
  if (
    meta?.spreadPips === undefined ||
    !Number.isFinite(spread) ||
    spread < 0 ||
    !Number.isFinite(pip) ||
    pip <= 0
  )
    return tick;
  return { ...tick, ask: tick.bid + spread * pip, spread: spread * pip };
}
