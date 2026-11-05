"use client";
import { ShieldCheck, ArrowLeft, LoaderCircle } from 'lucide-react';
import { Dialog } from './Dialog';
import { InstrumentIcon } from './InstrumentIcon';
import { useMarketDisplay } from '@/hooks/useMarketDisplay';
import type { TradeRequest } from '@/lib/contracts';
import { orderRisk } from '@/lib/risk';
import { needsReview } from '@/lib/volume';
import {useEffect,useRef} from 'react';
const money=(value?:number)=>value==null?'—':`${value<0?'−':''}$${Math.abs(value).toFixed(2)}`;

// Both chart and ticket use the same review; the submit path still revalidates the live quote.
export function OrderReview({request,reference,contract,practice,account,busy,available,error,notice,onConfirm,onClose,inline=false}: {
  request:TradeRequest;reference?:number;contract?:number;practice:boolean;account:string;
  busy:boolean;available:boolean;error?:string;notice?:string;onConfirm:()=>void;onClose:()=>void;inline?:boolean;
}) {
  const {formatPrice}=useMarketDisplay();
  const reviewHeading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{if(inline)reviewHeading.current?.focus();},[inline]);
  const risk=orderRisk(request,reference,contract,practice?100:undefined);
  const side=request.orderType==='BUY'?'Buy':'Sell';
  const content=<>
    <div className="order-review-heading"><InstrumentIcon symbol={request.symbol}/><div><h3>{request.symbol}</h3><span>{request.executionType==='MARKET'?'Market order':`${side} ${request.executionType.toLowerCase()}`}</span></div><strong className={request.orderType==='BUY'?'positive':'negative'}>{side} {request.lotSize} lots</strong></div>
    <div className="review-account"><ShieldCheck /><div><span>Trading account</span><strong>{practice?'Practice · virtual USD':account}</strong></div></div>
    <dl className="detail-list">
      <div><dt>{request.executionType==='MARKET'?'Indicative entry':'Entry price'}</dt><dd>{formatPrice(request.limitPrice??reference,request.symbol)}</dd></div>
      <div><dt>Stop loss</dt><dd>{request.sl?formatPrice(request.sl,request.symbol):'Not set'}{risk.atStop!=null&&<small className="negative">{money(risk.atStop)}</small>}</dd></div>
      <div><dt>Take profit</dt><dd>{request.tp?formatPrice(request.tp,request.symbol):'Not set'}{risk.atTarget!=null&&<small className="positive">{money(risk.atTarget)}</small>}</dd></div>
      {practice&&<div><dt>Estimated margin</dt><dd>{money(risk.margin)}</dd></div>}
    </dl>
    <p className="review-explanation">{request.executionType!=='MARKET'?'The order waits for your entry price. It does not open a position immediately.':practice?'This simulated order uses virtual funds and prices.':'The order is sent for execution. Its final fill price can differ from the price shown.'}</p>
    {needsReview(request.lotSize)&&<p className="review-warning">Large order: {request.lotSize} lots. Check the volume before confirming.</p>}
    {notice&&<p className="review-warning" role="status">{notice}</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <button className={`button full-width place-order ${request.orderType.toLowerCase()}`} disabled={busy||!available} onClick={onConfirm}>{busy?<><LoaderCircle className="spin"/>Submitting…</>:!available?'Waiting for trading availability':`Place ${practice?'practice ':''}${side.toLowerCase()} ${request.executionType.toLowerCase()}`}</button>
    <button className="text-button review-back" disabled={busy} onClick={onClose}><ArrowLeft />Back to draft</button>
  </>;
  return inline?<div className="order-review-inline" aria-label="Review order"><h3 ref={reviewHeading} tabIndex={-1} className="sr-only">Review {side.toLowerCase()} {request.symbol} order</h3>{content}</div>:<Dialog title="Review order" className="order-review-dialog" onClose={()=>{if(!busy)onClose();}}>{content}</Dialog>;
}
