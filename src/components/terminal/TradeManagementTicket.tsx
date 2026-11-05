"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,CheckCircle2,CircleAlert,Clock3,LoaderCircle,RefreshCw} from 'lucide-react';
import {OrderEntry} from '@/components/OrderEntry/OrderEntry';
import {useManagementTracking,useManagementSubmit} from '@/hooks/useTradeManagement';
import {useTradeManagement,type ManagementSelection} from '@/store/useTradeManagement';
import {useUIStore} from '@/store/useUIStore';
import {useOrderFlow} from '@/store/useOrderFlow';
import {usePracticeStore} from '@/store/usePracticeStore';
import {usePriceStore} from '@/store/usePriceStore';
import {useExecutionPolicy} from '@/hooks/useExecutionPolicy';
import {useMarketDisplay} from '@/hooks/useMarketDisplay';
import {useExecutableQuote} from '@/hooks/useExecutableQuote';
import {useTradingAccountId} from '@/hooks/useTradingAccountId';
import {ownOrders,runningPnl,withInstrument} from '@/lib/positionPnl';
import {orderEntry,orderRequest,pendingOrder} from '@/lib/connectedOrders';
import {closeBreakdown,managementPending,managementPolling,managementTitle,openLots,prepareManagement,type ManagementResult} from '@/lib/tradeManagement';
import {shiftPendingEntry} from '@/lib/contracts';
import {isQuoteExecutable} from '@/lib/freshness';
import {PRACTICE_CONTRACTS} from '@/lib/practice';
import {showActivity,viewInstrument} from '@/lib/tradingWorkflow';
import {openTradeManagement} from '@/lib/openTradeManagement';
import type {Order} from '@/types/trading';
import {InstrumentIcon} from './InstrumentIcon';
import {CloseVolumePresets} from './CloseVolumePresets';

const money=(value?:number)=>value==null||!Number.isFinite(value)?'—':`${value<0?'−':value>0?'+':''}$${Math.abs(value).toFixed(2)}`;
export function TradingTicket() {
  const tracking=useManagementTracking();
  const selection=useTradeManagement(s=>s.selection);
  const results=useTradeManagement(s=>s.results);
  const version=useUIStore(s=>s.orderDraftVersion);
  const previous=useRef(version);
  const paper=usePracticeStore(s=>s.account.orders),accountId=useTradingAccountId();
  useEffect(()=>{if(previous.current!==version){previous.current=version;useTradeManagement.getState().select(undefined);}},[version]);
  const unresolved=Object.values(results).filter(managementPending);
  useEffect(()=>{
    // Confirmed actions return to the ticket automatically; failures stay inspectable.
    if(selection&&results[String(selection.order.id)]?.status==='complete')useTradeManagement.getState().select(undefined);
  },[selection,results]);
  const rows=selection?.practice?paper:ownOrders([...(tracking.orders.currentData?.openOrders??[]),...(tracking.orders.currentData?.pendingOrders??[])],accountId);
  return <>
    {!selection&&unresolved.length>0&&<div className="management-pending-strip" role="status"><span>{unresolved.length} trade request{unresolved.length>1?'s':''} awaiting confirmation</span><button className="text-button" onClick={()=>{const r=unresolved[0];openTradeManagement(r.before,r.command.action,r.practice);}}>View status</button></div>}
    {selection?<ManagementEditor key={selection.key} selection={selection} current={rows.find(o=>String(o.id)===String(selection.order.id))} refresh={tracking.refresh}/>:<OrderEntry docked/>}
  </>;
}

export function ManagementEditor({selection,current,refresh}:{selection:ManagementSelection;current?:Order;refresh:()=>void}) {
  const {order,action,initial={},practice}=selection;
  const original=orderRequest(order),{formatPrice,instrument}=useMarketDisplay(),meta=instrument(order.symbol);
  const [sl,setSl]=useState(String(initial.sl??original.sl??'')),[tp,setTp]=useState(String(initial.tp??original.tp??''));
  const [entry,setEntry]=useState(String(initial.limitPrice??orderEntry(order)??''));
  const [lots,setLots]=useState(String(openLots(order))),[error,setError]=useState(''),[now,setNow]=useState(Date.now());
  const anchor=useRef(Number(entry)),heading=useRef<HTMLHeadingElement>(null),errorRef=useRef<HTMLParagraphElement>(null);
  const result=useTradeManagement(s=>s.results[String(order.id)]),inFlight=useOrderFlow(s=>s.inFlight),verifying=useOrderFlow(s=>!!s.verifying);
  const policy=useExecutionPolicy(),quote=useExecutableQuote(order.symbol),prices=usePriceStore(s=>s.prices),paperQuotes=usePracticeStore(s=>s.quotes);
  const submit=useManagementSubmit();
  const pending=pendingOrder(order),open=openLots(current??order),amount=Number(lots),breakdown=closeBreakdown(open,amount);
  const draft={sl,tp,entry,lots},prepared=prepareManagement(order,current,action,draft,quote);
  const issue=!policy.canManage?policy.reason??'Trade management is unavailable.':prepared.error;
  const changes=prepared.command?.changes,changesKey=JSON.stringify(changes);
  const observed=current??order;
  const valued={...withInstrument(observed,meta),contractSize:practice?PRACTICE_CONTRACTS[order.symbol]:observed.contractSize??meta.contractSize,orderDetails:{...observed.orderDetails,entryPrice:action==='edit'&&pending&&Number(entry)>0?Number(entry):orderEntry(observed)}};
  const fresh=isQuoteExecutable(quote,now),priceMap=practice?paperQuotes:prices;
  const pnl=fresh?runningPnl({...valued,lotSize:action==='close'?amount:open},priceMap):NaN;
  const atLevel=(text:string)=>fresh&&Number(text)>0?runningPnl(valued,{...priceMap,[order.symbol]:{bid:Number(text),ask:Number(text)}}):NaN;
  useEffect(()=>{heading.current?.focus();const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{if(selection.focus&&!result)document.getElementById(`manage-${selection.focus}`)?.focus();},[selection.focus,result]);
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  useEffect(()=>{
    useTradeManagement.getState().setPreview(action==='edit'&&!result&&changes&&Object.keys(changes).length?{id:String(order.id),changes}:undefined);
    return ()=>useTradeManagement.getState().setPreview(undefined);
  },[action,order.id,result,changesKey]);
  function changeEntry(value:string){
    setEntry(value);const next=Number(value);
    if(!(next>0)||!Number.isFinite(next))return;
    if(anchor.current>0){const moved=shiftPendingEntry(anchor.current,next,{...(sl.trim()&&{sl:Number(sl)}),...(tp.trim()&&{tp:Number(tp)})},meta.digits);if(moved.sl!=null)setSl(String(moved.sl));if(moved.tp!=null)setTp(String(moved.tp));}
    anchor.current=next;
  }
  const back=()=>useTradeManagement.getState().select(undefined);
  const title=action==='edit'?(pending?'Modify pending order':'Stop loss & take profit'):action==='cancel'?'Cancel pending order':'Close position';
  return <aside className="order-panel panel management-ticket" aria-label="Manage selected trade">
    <div className="panel-heading"><div><span className="ticket-mode">{practice?'Practice':'Trading account'} · #{order.id}</span><h2 ref={heading} tabIndex={-1}>{title}</h2></div><button className="icon-button" aria-label="Back to new order" disabled={inFlight} onClick={back}><ArrowLeft/></button></div>
    <div className="ticket-instrument-heading"><InstrumentIcon symbol={order.symbol}/><strong>{order.symbol}</strong><span>{original.orderType} · {openLots(order)} lots</span></div>
    {result?<ManagementOutcome result={result} current={current} refresh={refresh} onBack={back}/>:<form className="management-form" onSubmit={async e=>{e.preventDefault();setError('');const error=await submit(selection,draft);if(error)setError(error);}}>
      <fieldset className="order-scroll ticket-fields" disabled={inFlight||verifying}>
        {error&&<p className="form-error" ref={errorRef} tabIndex={-1} role="alert">{error}</p>}
        <div className="management-quote"><span>{original.orderType==='BUY'?'Bid · sell to close':'Ask · buy to close'}</span><strong>{formatPrice(original.orderType==='BUY'?quote?.bid:quote?.ask,order.symbol)}</strong><small>{fresh?'Live quote':'Quote unavailable or stale'}</small></div>
        {action==='edit'&&<>
          {pending&&<label className="management-price-field">{original.executionType==='STOP'?'Stop':'Limit'} entry<input id="manage-entry" type="number" step={10**-(meta.digits??5)} value={entry} onChange={e=>changeEntry(e.target.value)}/></label>}
          <div className="risk-fields"><label>Stop loss<input id="manage-sl" type="number" step={10**-(meta.digits??5)} value={sl} onChange={e=>setSl(e.target.value)} placeholder="Not set"/><small>{money(atLevel(sl))}</small></label><label>Take profit<input id="manage-tp" type="number" step={10**-(meta.digits??5)} value={tp} onChange={e=>setTp(e.target.value)} placeholder="Not set"/><small>{money(atLevel(tp))}</small></label></div>
          <p className="helper">{original.orderType==='BUY'?'SL below, TP above':'SL above, TP below'} {pending?'the pending entry':original.orderType==='BUY'?'current Bid':'current Ask'}. Existing protection can be moved, but cannot be removed.</p>
          {pending&&<p className="helper">Moving the entry shifts SL/TP together. The Limit/Stop type stays fixed.</p>}
          <dl className="detail-list management-changes">{(['sl','tp','limitPrice'] as const).filter(key=>changes?.[key]!=null).map(key=><div key={key}><dt>{key==='sl'?'Stop loss':key==='tp'?'Take profit':'Entry'}</dt><dd><del>{formatPrice(key==='limitPrice'?orderEntry(order):original[key],order.symbol)}</del> → {formatPrice(changes![key],order.symbol)}</dd></div>)}</dl>
          <p className="helper">Preview changes on the chart, then save them here.</p>
        </>}
        {action==='close'&&<>
          <div className="segmented" aria-label="Close amount"><button type="button" aria-pressed={amount===open} onClick={()=>setLots(String(open))}>Full close</button><button type="button" aria-pressed={amount<open} disabled={open<.02} onClick={()=>setLots((Math.max(.01,Math.floor(open*50)/100)).toFixed(2))}>Partial close</button></div>
          <label className="field-label" htmlFor="manage-lots">Volume to close <span>of {open} lots</span></label><input id="manage-lots" className="management-volume" type="number" min="0.01" step="0.01" max={open} value={lots} onChange={e=>setLots(e.target.value)} aria-invalid={!!breakdown.error}/>
          <CloseVolumePresets open={open} value={lots} onChange={setLots}/>
          <dl className="detail-list management-close-summary"><div><dt>Closing</dt><dd>{Number.isFinite(amount)?amount:'—'} lots</dd></div><div><dt>Remaining</dt><dd>{breakdown.remaining??'—'} lots</dd></div><div><dt>Indicative P&L</dt><dd className={pnl>=0?'positive':'negative'}>{money(pnl)}</dd></div></dl>
          <p className="helper">{breakdown.remaining===0?'This closes the full position.':'The remaining position keeps its existing SL/TP.'} The final price and P&L are confirmed after execution.</p>
        </>}
        {action==='cancel'&&<p className="helper">Cancel this {original.orderType.toLowerCase()} {original.executionType.toLowerCase()} at {formatPrice(orderEntry(order),order.symbol)}. It may fill before cancellation reaches the server.</p>}
        {issue&&<p className="form-error" role="status">{issue}</p>}
        {!current&&!practice&&<button className="button button-outline" type="button" onClick={refresh}><RefreshCw/>Refresh trade</button>}
        {issue?.includes('changed')&&current&&<button className="button button-outline" type="button" onClick={()=>openTradeManagement(current,action,practice)}>Reload latest details</button>}
      </fieldset>
      <div className="order-bottom"><button className={`button full-width ${action==='edit'?'button-primary':'button-danger'}`} type="submit" disabled={inFlight||verifying||!!issue}>{action==='edit'?'Save changes':action==='cancel'?'Cancel pending order':breakdown.partial?`Close ${amount} of ${open} lots`:`Close full position · ${open} lots`}</button><button className="text-button management-back" type="button" onClick={back}>Keep trade unchanged</button></div>
    </form>}
  </aside>;
}

export function ManagementOutcome({result,current,refresh,onBack}:{result:ManagementResult;current?:Order;refresh:()=>void;onBack:()=>void}) {
  const {formatPrice}=useMarketDisplay(),waiting=managementPolling(result),done=result.status==='complete';
  const title=managementTitle(result),heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();},[result.key]);
  const message=result.message??(done?'Confirmed by your account.':result.status==='unconfirmed'?'The outcome is still unknown. Check the trade and history; this request cannot be repeated yet.':result.status==='checking'?'The response was lost. Checking your account before this trade can be changed again.':result.status==='sending'?'Sending your request…':'Accepted for processing. Waiting for the account to confirm the change.');
  return <div className={`ticket-result ${done?'is-confirmed':''}`}>
    <div className="ticket-result-state" role="status" aria-atomic="true">{waiting?<LoaderCircle className="spin"/>:done?<CheckCircle2/>:result.status==='unconfirmed'?<Clock3/>:<CircleAlert/>}<h3 ref={heading} tabIndex={-1}>{title}</h3><p>{message}</p></div>
    <dl className="detail-list"><div><dt>Order</dt><dd>#{result.command.orderId}</dd></div>{Object.entries(result.command.changes).map(([key,value])=><div key={key}><dt>{done?'':'Requested '}{key==='sl'?'SL':key==='tp'?'TP':'entry'}</dt><dd>{formatPrice(value,result.before.symbol)}</dd></div>)}{result.command.lots!=null&&<div><dt>Requested close</dt><dd>{result.command.lots} lots</dd></div>}{result.remaining!=null&&<div><dt>Remaining</dt><dd>{result.remaining} lots</dd></div>}{result.exitPrice!=null&&<div><dt>Exit price</dt><dd>{formatPrice(result.exitPrice,result.before.symbol)}</dd></div>}{result.pnl!=null&&<div><dt>Realised P&L</dt><dd>{money(result.pnl)}</dd></div>}</dl>
    <div className="ticket-result-actions"><button className="button button-outline" onClick={()=>showActivity('positions',result.command.orderId)}>View positions</button><button className="button button-outline" onClick={()=>showActivity(result.command.action==='edit'&&pendingOrder(result.before)?'pending':'history',result.command.orderId)}>{result.command.action==='edit'&&pendingOrder(result.before)?'View pending orders':'View history'}</button><button className="button button-outline" onClick={()=>viewInstrument(result.before.symbol,result.command.orderId)}>View on chart</button>
      {!done&&!result.practice&&<button className="text-button" onClick={refresh}><RefreshCw/>Refresh status</button>}
      {current&&openLots(current)>0&&!managementPending(result)&&<button className="button button-primary" onClick={()=>{useTradeManagement.getState().clearResult(result.command.orderId);openTradeManagement(current,result.command.action==='cancel'&&!pendingOrder(current)?'edit':result.command.action,result.practice);}}>{result.command.action==='close'?'Manage remaining trade':result.command.action==='cancel'&&!pendingOrder(current)?'Manage filled position':'Edit trade again'}</button>}
      <button className="text-button" disabled={result.status==='sending'} onClick={onBack}>Back to new order</button>
    </div>
  </div>;
}
