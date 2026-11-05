"use client";
import {Crosshair, X, ShieldCheck, Zap, LoaderCircle} from 'lucide-react';
import {useMarketDisplay} from '@/hooks/useMarketDisplay';
import {useExecutableQuote} from '@/hooks/useExecutableQuote';
import {useExecutionPolicy} from '@/hooks/useExecutionPolicy';
import {useUIStore} from '@/store/useUIStore';
import {composeOrder,composePendingOrder} from '@/lib/tradingWorkflow';
import {pendingPriceSuggestion} from '@/lib/orderTicket';
import {ToolbarMenu} from '@/components/terminal/ToolbarMenu';
import {useOneClick} from '@/components/OrderEntry/useOneClick';
import {useOrderSubmit} from '@/components/OrderEntry/useOrderSubmit';
import {useOrderFlow} from '@/store/useOrderFlow';
import {useWorkspaceStore} from '@/store/useWorkspaceStore';
import {quickMarketRequest} from '@/lib/tradeExperience';
import {needsReview} from '@/lib/volume';

// Quick market orders share the ticket's validated submission path.
export function ChartTradeControls({symbol,picking,onPickToggle,onClearPick}: {
  symbol:string;picking:boolean;onPickToggle:()=>void;
  onClearPick:()=>void;
}) {
  const {formatPrice,instrument}=useMarketDisplay();
  const quote=useExecutableQuote(symbol);
  const policy=useExecutionPolicy();
  const oneTap=useOneClick(),oneTapClose=useOneClick('close');
  const {submit,check,spec,specReady}=useOrderSubmit();
  const volume=useUIStore(s=>s.volumeInput);
  const inFlight=useOrderFlow(s=>s.inFlight),verifying=useOrderFlow(s=>s.verifying);
  const receipt=useOrderFlow(s=>s.receipt);
  const limits=spec(symbol);
  const locked=inFlight||!!verifying;
  const quickIssue=oneTap.on?check(quickMarketRequest(symbol,'BUY',volume)):null;
  const pending=useUIStore(s=>s.orderMode==='PENDING');
  function market() {useUIStore.getState().setOrderMode('MARKET');onClearPick();}
  async function deal(side:'BUY'|'SELL') {
    if(!oneTap.on){composeOrder(symbol,side);return;}
    const request=quickMarketRequest(symbol,side,useUIStore.getState().volumeInput);
    if(needsReview(request.lotSize)){composeOrder(symbol,side);useWorkspaceStore.getState().notify('Large volume: review the order in the ticket.','info');return;}
    const result=await submit(request);
    if(!result.ok&&result.error)useWorkspaceStore.getState().notify(result.error,result.unknown?'warning':'error');
    if(result.ok&&result.id)useWorkspaceStore.getState().selectTrade(result.id);
  }
  return <>
    <div className="chart-order-actions" data-one-tap={oneTap.on} aria-label="Order controls">
      <button type="button" className="one-tap-toggle" aria-pressed={oneTap.on} onClick={()=>oneTap.set(!oneTap.on)} title="Trade from the chart at the displayed lot size"><Zap/><span>One tap {oneTap.on?'On':'Off'}</span></button>
      {oneTap.on&&<label className="quick-lots"><span>Lots</span><input aria-label="One-tap lot size" type="number" inputMode="decimal" min={limits.min} max={limits.max} step={limits.step} value={volume} disabled={locked} onChange={e=>useUIStore.getState().setVolumeInput(e.target.value)}/></label>}
      {(['SELL','BUY'] as const).map(side=>{
        const issue=oneTap.on?check(quickMarketRequest(symbol,side,volume)):null;
        const sending=inFlight&&receipt?.status==='sending'&&receipt.request.orderType===side&&receipt.request.symbol===symbol;
        return <button className={`chart-order-start ${side.toLowerCase()}`} key={side} disabled={!policy.canPlace||locked||(oneTap.on&&(!specReady||!!issue))} title={issue??(oneTap.on?'Market order · no SL/TP':'Open order ticket')} onClick={()=>void deal(side)} aria-label={`${oneTap.on?'Place':'Create'} ${symbol} ${side.toLowerCase()}${oneTap.on?` market ${volume} lots`:''} order`}>
          <span>{sending?<><LoaderCircle className="spin"/>Sending</>:<>{side==='BUY'?'Buy':'Sell'}{oneTap.on?` ${volume}`:''}</>}</span><strong>{formatPrice(side==='BUY'?quote?.ask:quote?.bid,symbol)}</strong>
        </button>;
      })}
      <ToolbarMenu label="Order entry options" icon={<Crosshair />} className="chart-entry-menu">
        <button aria-pressed={oneTapClose.on} onClick={()=>oneTapClose.set(!oneTapClose.on)}><Zap/>One-tap close {oneTapClose.on?'On':'Off'}</button>
        <button aria-pressed={!pending} onClick={()=>{market();composeOrder(symbol,useUIStore.getState().selectedOrderSide);}}>Market order</button>
        {(['LIMIT','STOP'] as const).flatMap(type=>(['BUY','SELL'] as const).map(side=><button key={`${side}-${type}`} onClick={()=>composePendingOrder(symbol,side,type,pendingPriceSuggestion(side,type,quote,instrument(symbol).digits??5))} disabled={!policy.canPlace}>{side==='BUY'?'Buy':'Sell'} {type.toLowerCase()}</button>))}
        <button disabled={!policy.canPlace} onClick={()=>{const draft=useUIStore.getState();draft.prepareOrder(symbol,draft.selectedOrderSide);draft.setExecutionType(draft.pendingOrderType);onPickToggle();}}><Crosshair />Pick entry on chart</button>
      </ToolbarMenu>
    </div>
    {oneTap.on&&quickIssue&&<div className="chart-workflow-tools quick-trade-issue" role="status">{quickIssue}</div>}
    {oneTap.dialog}{oneTapClose.dialog}
    {!policy.canPlace && <div className="chart-workflow-tools"><span className="chart-execution-policy"><ShieldCheck/>{policy.mode==='close-only'?'Close-only account':'View-only account'}</span></div>}
    {picking&&<div className="chart-pick-prompt" role="status"><Crosshair/><span>Click a price on the chart. Then set volume and place the pending order.</span><button onClick={market} aria-label="Cancel choosing chart entry"><X/></button></div>}

  </>;
}
