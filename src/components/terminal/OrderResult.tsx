"use client";
import {useEffect,useRef} from 'react';
import {CheckCircle2,CircleAlert,Clock3,LoaderCircle,ArrowLeft,ChartCandlestick} from 'lucide-react';
import {useOrderFlow} from '@/store/useOrderFlow';
import {receiptCopy,receiptDestination} from '@/lib/orderReceipt';
import {showActivity,viewInstrument} from '@/lib/tradingWorkflow';
import {useMarketDisplay} from '@/hooks/useMarketDisplay';

export function OrderResult({onBack}:{onBack:()=>void}) {
  const receipt=useOrderFlow(s=>s.receipt);
  const inFlight=useOrderFlow(s=>s.inFlight);
  const {formatPrice}=useMarketDisplay();
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();},[receipt?.key]);
  if(!receipt)return null;
  const {request,status,id}=receipt;
  const {title,message}=receiptCopy(receipt);
  const waiting=status==='sending'||status==='checking';
  const confirmed=status==='open'||status==='pending';
  const problem=status==='rejected'||status==='unconfirmed';
  const destination=receiptDestination(receipt);
  return <div className={`ticket-result ${confirmed?'is-confirmed':problem?'is-problem':''}`}>
    <div className="ticket-result-state" role="status" aria-live="polite" aria-atomic="true">
      {waiting?<LoaderCircle className="spin"/>:confirmed?<CheckCircle2/>:problem?<CircleAlert/>:<Clock3/>}
      <h3 ref={heading} tabIndex={-1}>{title}</h3><p>{message}</p>
    </div>
    <dl className="detail-list">
      <div><dt>Instrument</dt><dd>{request.symbol}</dd></div>
      <div><dt>Order</dt><dd className={request.orderType==='BUY'?'positive':'negative'}>{request.orderType==='BUY'?'Buy':'Sell'} {request.lotSize} lots · {request.executionType.toLowerCase()}</dd></div>
      {id&&<div><dt>Order ID</dt><dd>#{id}</dd></div>}
      {receipt.fillPrice!=null&&<div><dt>Filled at</dt><dd>{formatPrice(receipt.fillPrice,request.symbol)}</dd></div>}
      {request.limitPrice!=null&&<div><dt>Requested entry</dt><dd>{formatPrice(request.limitPrice,request.symbol)}</dd></div>}
      <div><dt>Stop loss</dt><dd>{request.sl!=null?formatPrice(request.sl,request.symbol):'Not set'}</dd></div>
      <div><dt>Take profit</dt><dd>{request.tp!=null?formatPrice(request.tp,request.symbol):'Not set'}</dd></div>
    </dl>
    <div className="ticket-result-actions">
      <button className="button button-primary" onClick={()=>showActivity(destination,id)}>View {destination==='pending'?'pending orders':'positions'}</button>
      {status==='unconfirmed'&&<button className="button button-outline" onClick={()=>showActivity('history')}>Check history</button>}
      <button className="button button-outline" onClick={()=>viewInstrument(request.symbol,id)}><ChartCandlestick/>View on chart</button>
      <button className="text-button" disabled={inFlight||waiting} onClick={onBack}><ArrowLeft/>{problem?'Back to draft':'Back to order ticket'}</button>
    </div>
  </div>;
}
