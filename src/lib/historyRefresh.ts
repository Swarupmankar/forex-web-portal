import type { OrderlistResponseDTO } from '../types/trading';
export const HISTORY_FOLLOW_UPS_MS = [2500, 6000, 12000] as const;
/** Changes to the order lifecycle matter; per-tick quotes and cash do not. */
export function orderListSignature(list?: OrderlistResponseDTO): string {
  return [...(list?.openOrders ?? []), ...(list?.pendingOrders ?? [])]
    .map(o => [o.id, o.orderStatus ?? o.status, o.lotSize, o.orderDetails?.entryPrice, o.sl, o.tp].join(':'))
    .sort().join('|');
}
export function followHistory(refresh: () => void, schedule = setTimeout, cancel = clearTimeout) {
  refresh();
  const timers = HISTORY_FOLLOW_UPS_MS.map(delay => schedule(refresh, delay));
  return () => timers.forEach(cancel);
}
