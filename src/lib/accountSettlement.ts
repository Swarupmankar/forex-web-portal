import type { OrderlistResponseDTO } from '../types/trading';
import { orderMargin, ownOrders } from './positionPnl';

// Match the app's bounded display adjustment while orders and spendable cash
// settle separately. This never writes a balance or invents realised trade P&L.
export const SETTLE_MS = 45000;
export const SETTLED_RECENTLY_MS = 10000;
export type Settlement = { accountId?: number; cash: number; margins: Record<string, number>; pending: number; since: number; cashAt: number };
export function nextSettlement(previous: Settlement | undefined, list: OrderlistResponseDTO, accountId: number | undefined, now: number): Settlement | undefined {
  const cash = list.balance == null || list.balance === '' ? NaN : Number(list.balance);
  if (!Number.isFinite(cash)) return undefined;
  const margins: Record<string, number> = {};
  for (const order of ownOrders(list.openOrders ?? [], accountId)) {
    const margin = orderMargin(order);
    // An incomplete snapshot must not be interpreted as released margin.
    if (!Number.isFinite(margin)) return undefined;
    margins[String(order.id)] = margin;
  }
  if (!previous || previous.accountId !== accountId || previous.cash !== cash) {
    return { accountId, cash, margins, pending: 0, since: now, cashAt: previous && previous.accountId === accountId ? now : -Infinity };
  }
  const total = (values: Record<string, number>) => Object.values(values).reduce((sum, amount) => sum + amount, 0);
  const delta = total(previous.margins) - total(margins);
  if (delta !== 0 && now - previous.cashAt < SETTLED_RECENTLY_MS) return { ...previous, margins };
  // Never revive an expired adjustment when a later trade changes margin.
  const carried = settlementPending(previous, now) ? previous.pending : 0;
  const pending = carried + delta;
  return { ...previous, margins, pending, since: Math.abs(pending - carried) < 1e-9 ? previous.since : now };
}
export function settlementPending(value: Settlement | undefined, now: number) {
  return !!value && value.pending !== 0 && now - value.since < SETTLE_MS;
}
export function settledCash(value: Settlement | undefined, now: number): number {
  return value ? value.cash + (settlementPending(value, now) ? value.pending : 0) : NaN;
}
