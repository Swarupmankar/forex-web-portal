import type {Order, PriceTick} from '@/types/trading';
import {orderEntry,orderRequest,pendingOrder,validateOrderChanges,type OrderChanges} from './connectedOrders';
import {validateVolume} from './volume';
import {isQuoteExecutable} from './freshness';

export type ManagementAction='edit'|'close'|'cancel';
export type ManagementCommand={action:ManagementAction;orderId:string;changes:OrderChanges;lots?:number};
export type ManagementResult={
  key:string;before:Order;command:ManagementCommand;practice:boolean;accountId?:number;generation:number;
  startedAt:number;knownExits:string[];status:'sending'|'submitted'|'checking'|'unconfirmed'|'complete'|'rejected'|'changed';
  message?:string;remaining?:number;exitPrice?:number;pnl?:number;
  notify?:boolean;
};
export type ManagementDraft={sl:string;tp:string;entry:string;lots:string};
export const managementPending=(r?:ManagementResult)=>!!r && ['sending','submitted','checking','unconfirmed'].includes(r.status);
export const managementPolling=(r?:ManagementResult)=>!!r && ['sending','submitted','checking'].includes(r.status);
export const expireManagement=(r:ManagementResult,now:number):ManagementResult=>['submitted','checking'].includes(r.status)&&now-r.startedAt>=30000?{...r,status:'unconfirmed'}:r;
export const tradeStatus=(o:Order)=>String(o.orderStatus??o.status).toUpperCase();
export const openLots=(o:Order)=>Number(o.lotSize??o.volume);
export function closeBreakdown(open:number,amount:number) {
  const issue=validateVolume(amount,{min:.01,max:open,step:.01});
  if(!Number.isFinite(open)||open<=0||issue)return {error:issue??'Open volume is unavailable.'};
  const remaining=Number((open-amount).toFixed(2));
  if(remaining>0 && validateVolume(remaining,{min:.01,max:open,step:.01}))return {error:'The remaining position must be at least 0.01 lots, in steps of 0.01.'};
  return {remaining,partial:remaining>0};
}
/** Revalidate the current account row at submit time, not the row used to open the panel. */
export function prepareManagement(before:Order,current:Order|undefined,action:ManagementAction,draft:ManagementDraft,quote?:PriceTick):{command?:ManagementCommand;error?:string} {
  if(!current||String(current.id)!==String(before.id)||current.symbol!==before.symbol)return {error:'This trade is no longer available. Refresh your account.'};
  if((before.createdAt&&current.createdAt&&before.createdAt!==current.createdAt)||orderRequest(before).orderType!==orderRequest(current).orderType)return {error:'The selected trade changed. Reload its latest details.'};
  if(tradeStatus(before)!==tradeStatus(current)||Math.abs(openLots(before)-openLots(current))>1e-8)return {error:'This trade changed while you were editing. Reload its latest details.'};
  for(const key of ['sl','tp'] as const)if(orderRequest(before)[key]!==orderRequest(current)[key])return {error:'Protection changed while you were editing. Reload its latest details.'};
  if(orderEntry(before)!==orderEntry(current))return {error:'The entry changed while you were editing. Reload its latest details.'};
  const status=tradeStatus(current),command:ManagementCommand={action,orderId:String(current.id),changes:{}};
  if(action==='cancel')return status==='PENDING'?{command}:{error:'Only a pending order can be cancelled.'};
  if(action==='close'){
    if(status!=='OPEN')return {error:'Only an open position can be closed.'};
    const lots=Number(draft.lots),check=closeBreakdown(openLots(current),lots);
    return check.error?{error:check.error}:{command:{...command,lots}};
  }
  for(const key of ['sl','tp'] as const){
    const old=orderRequest(current)[key],text=draft[key].trim();
    if(!text && old!=null)return {error:'Existing protection can be moved, but the backend does not support removing it.'};
    if(text && Number(text)!==old)command.changes[key]=Number(text);
  }
  if(pendingOrder(current)&&Number(draft.entry)!==orderEntry(current))command.changes.limitPrice=Number(draft.entry);
  const error=!isQuoteExecutable(quote)?'Waiting for a fresh quote.':validateOrderChanges(current,command.changes,quote);
  return error?{error}:{command};
}
const near=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-7;
/** Missing rows and accepted HTTP responses never prove a close. Require account/exit evidence. */
export function reconcileManagement(result:ManagementResult,orders:Order[],history:Order[],observedAt:number):ManagementResult {
  if(!managementPending(result)||observedAt<result.startedAt)return result;
  const id=String(result.before.id),current=orders.find(o=>String(o.id)===id);
  const {action,changes,lots=0}=result.command;
  if(action==='edit'){
    if(current && tradeStatus(current)!==tradeStatus(result.before))return {...result,status:'changed',message:'The order status changed before these edits were confirmed. Review the trade.'};
    if(current && Object.entries(changes).every(([key,value])=>near(Number(key==='limitPrice'?orderEntry(current):orderRequest(current)[key as 'sl'|'tp']),Number(value))))return {...result,status:'complete'};
  }else if(action==='cancel'){
    if(current && tradeStatus(current)==='OPEN')return {...result,status:'changed',message:'The pending order filled before cancellation was confirmed. It is now a position.'};
    if((!current||tradeStatus(current)==='CANCELLED')&&history.some(o=>String(o.id)===id&&tradeStatus(o)==='CANCELLED'))return {...result,status:'complete'};
  }else{
    const rows=history.filter(o=>String(o.id)===id&&!result.knownExits.includes(o.exitRowId??'') && !tradeStatus(o).includes('CANCEL') && Date.parse(o.closedAt??'')>=result.startedAt-120000);
    const closed=rows.reduce((n,o)=>n+openLots(o),0),remaining=Number((openLots(result.before)-lots).toFixed(2));
    const actual=current?openLots(current):0;
    if(near(closed,lots)&&near(actual,remaining)){
      const price=rows.reduce((n,o)=>n+Number(o.orderDetails?.exitPrice)*openLots(o),0)/lots;
      const profit=rows.reduce((n,o)=>n+(o.pnl==null?NaN:Number(o.pnl)),0);
      return {...result,status:'complete',remaining,...(Number.isFinite(price)&&price>0&&{exitPrice:price}),...(Number.isFinite(profit)&&{pnl:profit})};
    }
    if(closed>lots+1e-7)return {...result,status:'changed',message:'More volume closed than this request. Review History before another action.'};
  }
  return result;
}
export function managementTitle(result:ManagementResult) {
  if(result.status==='complete')return result.command.action==='edit'?'Protection updated':result.command.action==='cancel'?'Pending order cancelled':result.remaining===0?'Position closed':'Position partially closed';
  return {sending:'Sending request',submitted:result.command.action==='close'?'Close requested':'Changes requested',checking:'Checking request status',unconfirmed:'Outcome unconfirmed',rejected:'Request rejected',changed:'Trade changed'}[result.status];
}
