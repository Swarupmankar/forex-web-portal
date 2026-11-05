import type { Order, OrderlistResponseDTO, PriceTick, SymbolItem } from "@/types/trading";

// Live P&L and account figures for a connected account, as the Xpert Trader app computes them.
// The backend fills an order's `pnl` only when it closes, so an open position is valued here
// from the live quote, converted from the symbol's quote currency to USD (EURJPY: yen → USD).

type Prices = Record<string, Pick<PriceTick, "bid" | "ask"> | undefined>;

const num = (v: unknown) => (v === undefined || v === null || v === "" ? NaN : Number(v));
const mid = (t: Prices[string]) => (t && t.bid > 0 && t.ask > 0 ? (t.bid + t.ask) / 2 : NaN);

export function ownOrders<T extends { tradingAccountId?: number; accountId?: number }>(orders: T[], accountId?: number): T[] {
  return orders.filter(o => {
    const owner = o.tradingAccountId ?? o.accountId;
    return owner == null || accountId == null || Number(owner) === accountId;
  });
}
export function withInstrument(order: Order, metadata?: SymbolItem): Order {
  return { ...order, currencyBase: metadata?.baseCurrency ?? order.currencyBase ?? order.currency_base,
    currencyQuote: metadata?.quoteCurrency ?? order.currencyQuote ?? order.currency_quote };
}

/** Base and quote currency: the order's own fields, else the 6-letter convention (EURJPY, XAUUSD). */
export function pairOf(o: Order) {
  const s = String(o.symbol ?? "").toUpperCase();
  const base = String(o.currencyBase ?? o.currency_base ?? "").toUpperCase() || (s.length === 6 ? s.slice(0, 3) : s.endsWith("USD") ? s.slice(0, -3) : "");
  const quote = String(o.currencyQuote ?? o.currency_quote ?? "").toUpperCase() || (s.length === 6 ? s.slice(3) : s.endsWith("USD") ? "USD" : "");
  return { base, quote };
}

/** Feed symbols needed to convert these positions to USD. Both directions: the feed lists only one. */
export function conversionSymbols(orders: Order[] = []) {
  const out = new Set<string>();
  for (const o of orders) {
    const { base, quote } = pairOf(o);
    if (quote && quote !== "USD" && base !== "USD") out.add(`${quote}USD`).add(`USD${quote}`);
  }
  return [...out].sort();
}

/** USD P&L of one open position at the live quote; NaN while its price or USD rate is unknown. */
export function runningPnl(o: Order, prices: Prices) {
  const buy = String(o.orderType).toUpperCase().includes("BUY");
  const units = num(o.contractSize) * num(o.lotSize);
  const entry = num(o.orderDetails?.entryPrice ?? o.entryPrice ?? o.openPrice ?? o.orderDetails?.price);
  // A position closes at the opposite side: a buy at the bid, a sell at the ask.
  const price = buy ? prices[o.symbol]?.bid : prices[o.symbol]?.ask;
  if (!(units > 0) || !(entry > 0) || !price || !(price > 0)) return NaN;
  const { base, quote } = pairOf(o);
  if (!quote) return NaN;
  const direct = mid(prices[`${quote}USD`]);
  const rate = quote === "USD" ? 1 : base === "USD" ? 1 / price : direct > 0 ? direct : 1 / mid(prices[`USD${quote}`]);
  return (buy ? price - entry : entry - price) * units * rate;
}

/** Current reserved margin, already adjusted by the engine for partial closes. */
export function orderMargin(o: Order) {
  const margin = num(o.marginInUse);
  return margin >= 0 ? margin : NaN;
}

/**
 * The order list's `balance` is cash with open margin already taken out, so the balance is
 * cash + margin and equity adds the floating P&L. Any unknown leg makes the figure NaN ("—").
 */
export function accountFigures(list: OrderlistResponseDTO | undefined, cash: unknown, prices: Prices, accountId?: number) {
  const open = ownOrders(list?.openOrders ?? [], accountId);
  const margin = list ? open.reduce((n, o) => n + orderMargin(o), 0) : NaN;
  const balance = num(cash) + margin;
  const equity = open.reduce((n, o) => n + runningPnl(o, prices), balance);
  return { balance, margin, equity, freeMargin: equity - margin, marginLevel: margin > 0 ? (equity / margin) * 100 : undefined };
}
