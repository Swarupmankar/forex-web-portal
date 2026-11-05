import type { TradeRequest } from './contracts';
import type { Order } from '../types/trading';
import { findSubmittedOrder } from './orderOutcome';
export type Receipt = {
  request: TradeRequest;
  status: 'sending' | 'submitted' | 'open' | 'pending' | 'checking' | 'unconfirmed' | 'rejected';
  practice: boolean;
  id?: string;
  key: string;
  startedAt: number;
  knownIds: string[];
  message?: string;
  accountId?: number;
  fillPrice?: number;
  awaitingFill?: boolean;
};
/** Acceptance is not a fill. Account rows must explicitly confirm OPEN or PENDING. */
export function confirmReceipt(receipt: Receipt, orders: Order[]): Receipt {
  if (!['sending','submitted','checking','pending','unconfirmed','open'].includes(receipt.status)) return receipt;
  if(receipt.status==='open' && receipt.fillPrice!=null)return receipt;
  const found = receipt.id ? orders.find(o => String(o.id) === receipt.id)
    : findSubmittedOrder(receipt.request, receipt.knownIds, orders, receipt.startedAt);
  if (!found) return receipt;
  const state = String(found.orderStatus ?? found.status).toUpperCase();
  if (state === 'SENDING') return receipt.id === String(found.id) ? receipt : {...receipt,id:String(found.id)};
  if (!['OPEN','PENDING'].includes(state)) return receipt;
  const status = state === 'OPEN' ? 'open' : 'pending';
  const price = Number(found.orderDetails?.entryPrice ?? found.openPrice);
  if(receipt.status==='open' && status!=='open')return receipt;
  if (receipt.id === String(found.id) && receipt.status === status && !(status==='open' && price>0 && Number.isFinite(price))) return receipt;
  return {...receipt, status, id:String(found.id), ...(status==='open' && price>0 && Number.isFinite(price) && {fillPrice:price})};
}

export type ReceiptEvent = {event:string;tradingAccountId:number;ts:string;description?:string;data:Record<string,unknown>};
// Never claim another device's order just because its symbol and side look similar.
export function applyReceiptEvent(receipt: Receipt, event: ReceiptEvent): Receipt {
  if(receipt.practice || !receipt.accountId || event.tradingAccountId!==receipt.accountId || !receipt.id) return receipt;
  if(!['ORDER_FILLED','ORDER_REJECTED'].includes(event.event) || String(event.data.orderId)!==receipt.id) return receipt;
  const at=Date.parse(event.ts);
  if(!Number.isFinite(at) || at < receipt.startedAt-120000) return receipt;
  if(event.data.closeReason!=null || (event.data.exitPrice!=null && event.data.exitPrice!=='')) return receipt;
  if(['open','rejected'].includes(receipt.status)) return receipt;
  if(event.event==='ORDER_REJECTED') return {...receipt,status:'rejected',message:typeof event.data.reason==='string'?event.data.reason:event.description};
  const price=Number(event.data.fillPrice ?? event.data.entryPrice);
  return {...receipt,status:'open',...(price>0 && Number.isFinite(price) && {fillPrice:price})};
}

// A fast socket result or account refresh may beat the HTTP response. Never downgrade it.
export function advanceReceipt(current: Receipt | undefined, incoming: Receipt, events: ReceiptEvent[] = []): Receipt {
  const same=current?.key===incoming.key;
  const terminal=same && ['open','rejected'].includes(current.status) && current.status!==incoming.status;
  const confirmed=same && current.status==='pending' && ['sending','submitted','checking','unconfirmed'].includes(incoming.status);
  let next=terminal || confirmed ? current : same ? {...current,...incoming,id:incoming.id??current.id} : incoming;
  for(const event of events) next=applyReceiptEvent(next,event);
  return next;
}

export function receiptCopy(receipt: Receipt) {
  const {status}=receipt;
  const title={sending:'Sending order',submitted:'Order submitted',open:'Position opened',pending:'Pending order placed',checking:'Checking order status',unconfirmed:'Order outcome unconfirmed',rejected:'Order not placed'}[status];
  const message=receipt.message ?? {
    sending:'Sending your request. Please wait.',
    submitted:'Waiting for execution confirmation from your account. Do not submit the same order again.',
    open:'The opening fill is confirmed. You can manage the position below.',
    pending:'Your order is waiting for its entry price. You can modify or cancel it below.',
    checking:'The response was lost. We are checking your account before another order can be sent.',
    unconfirmed:'Check Positions and History before deciding whether to retry. No fill has been confirmed.',
    rejected:'The order was not placed. Check the details before trying again.',
  }[status];
  return {title,message};
}

export function receiptDestination(receipt: Receipt): 'pending' | 'positions' {
  // Waiting for a market fill is not a resting Limit/Stop order.
  return receipt.status === 'open' || receipt.request.executionType === 'MARKET' ? 'positions' : 'pending';
}

export function expireReceipt(receipt: Receipt, now: number): Receipt {
  return receipt.status === 'submitted' && now - receipt.startedAt >= 30000
    ? {...receipt, status:'unconfirmed'} : receipt;
}
