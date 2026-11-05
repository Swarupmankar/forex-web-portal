import type { Receipt } from './orderReceipt';
import type { TradeSound } from './tradeSound';
export type SoundCue={key:string;kind:TradeSound};
export function receiptSound(receipt:Receipt):SoundCue|undefined {
  if(receipt.practice||!receipt.id||receipt.accountId==null)return;
  const kind=receipt.status==='open'?'filled':receipt.status==='pending'?'pending':receipt.status==='rejected'?'alert':undefined;
  if(kind)return {key:`entry:${receipt.accountId}:${receipt.id}:${kind}`,kind};
}
type Event={event:string;tradingAccountId:number;ts:string;data:Record<string,unknown>};
type Operation={key:string;accountId?:number;startedAt:number;command:{action:string;orderId:string}};
export function eventSound(event:Event,operation?:Operation):SoundCue|undefined {
  const data=event.data??{},id=data.orderId;
  const closing=data.closeReason!=null||(data.exitPrice!=null&&data.exitPrice!=='');
  const kind:TradeSound|undefined=event.event==='ORDER_FILLED'?(closing?'closed':'filled'):event.event==='ORDER_REJECTED'||event.event==='MARGIN_CALL'?'alert':event.event==='ORDER_CANCELLED'?'updated':['STOP_LOSS_HIT','TAKE_PROFIT_HIT','POSITION_LIQUIDATED','STOP_OUT'].includes(event.event)?'closed':undefined;
  if(!kind)return;
  if((event.event==='ORDER_FILLED'&&!closing)||event.event==='ORDER_REJECTED'){
    return id!=null?{key:`entry:${event.tradingAccountId}:${id}:${kind}`,kind}:undefined;
  }
  const matching=operation&&operation.accountId===event.tradingAccountId&&operation.command.orderId===String(id)&&Date.parse(event.ts)>=operation.startedAt&&((operation.command.action==='close'&&closing)||(operation.command.action==='cancel'&&event.event==='ORDER_CANCELLED'));
  return {key:matching?`management:${operation.key}`:`event:${event.tradingAccountId}:${event.event}:${id??''}:${event.ts}`,kind};
}
