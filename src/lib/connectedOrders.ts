import type { Order, OrderHistoryResponseDTO, PriceTick } from '@/types/trading';
import type { PracticeOrder } from './practice';
import { validateTrade, type TradeRequest } from './contracts';

const positive = (value: unknown) => Number(value) > 0 && Number.isFinite(Number(value)) ? Number(value) : undefined;
export const pendingOrder = (order: Order) => String(order.orderStatus ?? order.status).toUpperCase() === 'PENDING';
export const orderEntry = (order: Order) => pendingOrder(order) || String(order.orderStatus ?? order.status).toUpperCase() === 'CANCELLED'
  ? positive(order.orderDetails?.entrylimit ?? order.orderDetails?.limitPrice ?? order.limitPrice ?? order.targetPrice ?? order.openPrice)
  : positive(order.orderDetails?.entryPrice ?? order.entryPrice ?? order.openPrice ?? order.orderDetails?.price);
export function orderRequest(order: Order): TradeRequest {
  const execution = String(order.orderDetails?.entryExecutionType ?? order.executionType ?? order.pendingType ?? order.orderType).toUpperCase();
  return {
    symbol: order.symbol, orderType: String(order.orderType).toUpperCase().includes('BUY') ? 'BUY' : 'SELL',
    executionType: pendingOrder(order) ? execution.includes('STOP') ? 'STOP' : 'LIMIT' : 'MARKET',
    lotSize: Number(order.lotSize ?? order.volume), limitPrice: orderEntry(order),
    sl: positive(order.sl ?? order.stopLoss), tp: positive(order.tp ?? order.takeProfit),
  };
}
export function chartOrders(orders: Order[]): PracticeOrder[] {
  return orders.flatMap(order => {
    const status = String(order.orderStatus ?? order.status).toUpperCase();
    const openPrice = orderEntry(order);
    if (!['OPEN', 'PENDING'].includes(status) || !openPrice) return [];
    return [{ ...orderRequest(order), id: String(order.id), status: status as 'OPEN' | 'PENDING', openPrice,
      margin: Number(order.marginInUse) || 0, createdAt: order.createdAt || '', pnl: Number(order.pnl) || 0 }];
  });
}
export type OrderChanges = { sl?: number; tp?: number; limitPrice?: number };
/** Existing protections can be moved, not removed (the engine's modify contract). */
export function validateOrderChanges(order: Order, changes: OrderChanges, quote?: Pick<PriceTick, 'bid' | 'ask'>): string | null {
  if (!['OPEN', 'PENDING'].includes(String(order.orderStatus ?? order.status).toUpperCase())) return 'This order is no longer available to edit.';
  if (changes.limitPrice !== undefined && !pendingOrder(order)) return 'Only a pending order can change its entry price.';
  if (!Object.keys(changes).length) return 'No levels have changed.';
  if (!quote || !(quote.bid > 0) || !(quote.ask >= quote.bid)) return 'Waiting for a current quote.';
  return validateTrade({ ...orderRequest(order), ...changes }, quote);
}

/** One row per exit, preserving partial-close price, volume, realised P&L and time. */
export function historyRows(response?: OrderHistoryResponseDTO): Order[] {
  const unique = new Map<string, Order>();
  for (const order of [...(response?.fullyCompletedOrders ?? []), ...(response?.completedOrders ?? []), ...(response?.partiallyCompletedOrders ?? []), ...(response?.cancelledOrders ?? [])]) {
    const rawExits = order.orderDetails?.orderExitEntries;
    const exits = Array.isArray(rawExits) ? rawExits : rawExits ? [rawExits] : [];
    const rows: Order[] = exits.length ? exits.map((exit, index) => ({
      ...order, exitRowId: `${order.id}:${exit.id ?? index}`, lotSize: exit.exitLotSize ?? (exits.length === 1 ? order.lotSizeStore ?? order.lotSize : undefined),
      pnl: exit.pnl ?? (exits.length === 1 && ['COMPLETED', 'CLOSED', 'FULLY_COMPLETED'].includes(order.orderStatus) ? order.pnl : null),
      swap: exit.swap, closeReason: exit.closeReason, closedAt: exit.createdAt ?? order.closedAt ?? order.updatedAt,
      orderDetails: { ...order.orderDetails, exitPrice: exit.exitPrice ?? order.orderDetails?.exitPrice },
    })) : [{ ...order, exitRowId: `${order.id}:full`, lotSize: order.lotSizeStore ?? order.lotSize, closedAt: order.closedAt ?? order.updatedAt }];
    for (const row of rows) if (!unique.has(row.exitRowId!)) unique.set(row.exitRowId!, row);
  }
  return [...unique.values()].sort((a,b) => (Date.parse(b.closedAt ?? b.createdAt ?? '') || 0) - (Date.parse(a.closedAt ?? a.createdAt ?? '') || 0));
}

/** An unavailable profit is not a zero-profit trade. Cancelled orders have no realised P&L. */
export function totalProfit(orders: Order[]): number {
  return orders.filter(o => !String(o.orderStatus ?? o.status).toUpperCase().includes('CANCEL'))
    .reduce((total, o) => {
      const raw = o.pnl ?? o.profit;
      return total + (raw == null || raw === '' ? NaN : Number(raw));
    }, 0);
}
