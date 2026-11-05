import type { Receipt } from './orderReceipt';
import type { ToastKind, ToastOptions } from './notifications';
type Notice = {text:string;kind:ToastKind;options:ToastOptions};
export const orderNotificationKey = (account: number | undefined, id: unknown, practice=false) =>
  id != null && String(id) !== '' && (practice || account != null) ? `order:${practice?'practice':account}:${id}:entry` : undefined;
const priceText = (value: unknown) => {
  const number=Number(value);
  return number>0&&Number.isFinite(number)?number.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:8}):undefined;
};

export function receiptNotification(receipt:Receipt):Notice|undefined {
  // Before an ID is known the inline ticket/receipt already shows request progress.
  const key=orderNotificationKey(receipt.accountId,receipt.id,receipt.practice);
  if(!key||receipt.status==='sending')return;
  const {request,status}=receipt;
  const title={submitted:'Order sent',open:'Order filled',pending:'Pending order placed',checking:'Checking order',unconfirmed:'Order unconfirmed',rejected:'Order rejected'}[status];
  const summary=`${request.orderType==='BUY'?'Buy':'Sell'} ${request.lotSize} lots · ${request.symbol}`;
  const price=priceText(receipt.fillPrice);
  const text=status==='rejected'||status==='unconfirmed'||status==='checking'
    ? `${summary} · ${receipt.message??(status==='rejected'?'Not placed':status==='checking'?'Checking your account':'Check Positions and History before retrying')}`
    : `${summary}${status==='open'&&price?` · ${price}`:status==='submitted'?' · Awaiting confirmation':''}`;
  const settled=['open','pending','rejected'].includes(status);
  return {text,kind:status==='rejected'?'error':status==='unconfirmed'?'warning':settled?'success':'info',options:{key,title:`${title} · #${receipt.id}`,phase:settled?'settled':'progress',sticky:status==='rejected'||status==='unconfirmed'}};
}

type Event = {event:string;tradingAccountId:number;severity?:string;title?:string;description?:string;data:Record<string,unknown>;ts:string};
export function eventNotification(event:Event):Notice {
  const data=event.data??{},id=data.orderId;
  const opening=['ORDER_FILLED','ORDER_REJECTED'].includes(event.event)&&data.closeReason==null&&(data.exitPrice==null||data.exitPrice==='');
  const key=opening?orderNotificationKey(event.tradingAccountId,id):undefined;
  const reason=event.event==='ORDER_REJECTED'&&typeof data.reason==='string'?data.reason:'';
  const symbol=typeof data.symbol==='string'?data.symbol:'';
  const side=String(data.orderType??data.side??'').toUpperCase();
  const lots=Number(data.lotSize??data.volume),price=priceText(data.fillPrice??data.entryPrice);
  const structured=symbol&&['BUY','SELL'].includes(side)&&Number.isFinite(lots)&&lots>0;
  let text=structured?`${side==='BUY'?'Buy':'Sell'} ${lots} lots · ${symbol}${price&&event.event==='ORDER_FILLED'?` · ${price}`:''}`:event.description||event.title||event.event.replaceAll('_',' ');
  if(reason&&!text.includes(reason))text+=` · ${reason}`;
  const title=opening?(event.event==='ORDER_FILLED'?'Order filled':'Order rejected'):(event.title||event.event.replaceAll('_',' '));
  const kind:ToastKind=event.event==='ORDER_REJECTED'||event.severity==='CRITICAL'?'error':event.severity==='ACTION_REQUIRED'?'warning':event.event==='ORDER_FILLED'?'success':'info';
  return {text,kind,options:{key:key??`event:${event.tradingAccountId}:${event.event}:${id??''}:${event.ts}`,title:`${title}${id!=null?` · #${id}`:''}`,phase:'settled',sticky:kind==='error'||kind==='warning'}};
}
