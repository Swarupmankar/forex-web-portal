import type { Order, OrderlistResponseDTO, SymbolItem } from "@/types/trading";
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
// The trading engine takes every amount as a decimal string ("0.10", "1.10005") and rejects
// JSON numbers. Rounding to 8 places (the feed's 1e8 scale) drops float noise such as
// 0.1 + 0.2 = 0.30000000000000004 before the value becomes text.
export const decimalString = (n: number) => String(Number(n.toFixed(8)));
/** Price-feed 1e8-scaled integer text to a number, via its exact decimal ("114810000" -> 1.1481). */
export function fromScaled(text: string): number {
  const negative = text.startsWith("-");
  const digits = (negative ? text.slice(1) : text).padStart(9, "0");
  if (!/^\d+$/.test(digits)) return NaN;
  return Number(`${negative ? "-" : ""}${digits.slice(0, -8)}.${digits.slice(-8)}`);
}
export function engineOrder(order: TradeRequest) {
  // Only the documented fields: the engine answers 400 to any unknown key.
  return {
    symbol: order.symbol,
    orderType: order.orderType,
    executionType: order.executionType,
    lotSize: order.lotSize.toFixed(2),
    ...(order.executionType !== "MARKET" && order.limitPrice !== undefined && { limitPrice: decimalString(order.limitPrice) }),
    ...(order.sl !== undefined && { sl: decimalString(order.sl) }),
    ...(order.tp !== undefined && { tp: decimalString(order.tp) }),
  };
}
// Under A-book a placed order is SENDING (lotSize "0", no entry price) until the venue fills it.
// It must never show as a position, so unfilled rows found among open orders move to pending.
export function normalizeOrderlist(list: OrderlistResponseDTO): OrderlistResponseDTO {
  const unfilled = (o: Order) => ["SENDING", "PENDING"].includes(String(o.orderStatus ?? "").toUpperCase());
  const open = list?.openOrders ?? [];
  if (!open.some(unfilled)) return list;
  const pending = list.pendingOrders ?? [];
  const known = new Set(pending.map((o) => String(o.id)));
  return {
    ...list,
    openOrders: open.filter((o) => !unfilled(o)),
    pendingOrders: [...pending, ...open.filter((o) => unfilled(o) && !known.has(String(o.id)))],
  };
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
