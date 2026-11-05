import type { Order } from '@/types/trading';
import type { TradeRequest } from './contracts';
import type { ManagementResult } from './tradeManagement';

export const awaitingMarketFill = (order: Order) => {
  const status = String(order.orderStatus ?? order.status).toUpperCase();
  const type = String(order.orderDetails?.entryExecutionType ?? order.executionType ?? order.pendingType ?? order.orderType).toUpperCase();
  return status === 'SENDING' && !type.includes('LIMIT') && !type.includes('STOP');
};

/** Presentation only: unfilled market requests stay out of valuation and chart positions. */
export function activityBuckets(open: Order[], pending: Order[]) {
  return { positions: [...open, ...pending.filter(awaitingMarketFill)], pending: pending.filter(order => !awaitingMarketFill(order)) };
}

/** Like the app's quick quote buttons: market execution, shared lot size, no hidden draft protection. */
export function quickMarketRequest(symbol: string, side: 'BUY' | 'SELL', volume: string): TradeRequest {
  return { symbol, orderType: side, executionType: 'MARKET', lotSize: Number(volume) };
}

export function managementProgressLabel(result?: ManagementResult) {
  if (!result) return '';
  if (result.status === 'unconfirmed') return 'Status unconfirmed';
  if (result.status === 'checking') return 'Checking status…';
  if (!['sending', 'submitted'].includes(result.status)) return '';
  return result.command.action === 'close' ? 'Closing…' : result.command.action === 'cancel' ? 'Cancelling…' : 'Updating…';
}
