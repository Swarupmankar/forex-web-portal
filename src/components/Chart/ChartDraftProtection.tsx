"use client";
import { useState } from 'react';
import { Dialog } from '@/components/terminal/Dialog';
import { useUIStore } from '@/store/useUIStore';
import { useExecutableQuote } from '@/hooks/useExecutableQuote';
import { formatPrice } from '@/lib/market';
import { validateTrade } from '@/lib/contracts';
import { pendingAtPrice } from '@/lib/practice';
export function ChartDraftProtection({ symbol, entry, onClose }: { symbol:string; entry:number|null; onClose:()=>void }) {
  const u = useUIStore();
  const quote=useExecutableQuote(symbol);
  const [side,setSide]=useState(u.selectedOrderSide);
  const [sl,setSl]=useState(u.enableTPSL ? u.stopLoss : ''), [tp,setTp]=useState(u.enableTPSL ? u.takeProfit : ''), [error,setError]=useState('');
  const reference=side==='BUY' ? quote?.ask : quote?.bid;
  return <Dialog title="New-order SL / TP" onClose={onClose}>
    <p className="muted">Set exact exit prices for your next {symbol} order. To change an existing trade, select its chart label and choose Edit SL/TP.</p>
    <form onSubmit={e=>{e.preventDefault(); const invalid=validateTrade({symbol,orderType:side,lotSize:1,executionType:entry===null ? 'MARKET' : pendingAtPrice(side,entry,reference ?? entry),...(entry===null ? {} : {limitPrice:entry}),...(sl ? {sl:Number(sl)} : {}),...(tp ? {tp:Number(tp)} : {})},reference); if(invalid && (sl || tp)){setError(invalid);return;} u.setSelectedOrderSide(side);u.setEnableTPSL(!!(sl||tp));u.setStopLoss(sl);u.setTakeProfit(tp);onClose();}}>
      <div className="chart-risk-side" aria-label="Direction to protect">{(['BUY','SELL'] as const).map(s=><button key={s} type="button" aria-pressed={side===s} onClick={()=>{setSide(s);setError('');}}>{s==='BUY' ? 'Buy' : 'Sell'}</button>)}</div>
      <p className="notice-note">{side==='BUY' ? 'Buy' : 'Sell'} {entry===null ? 'market' : 'pending'} entry: <strong>{formatPrice(entry ?? reference,symbol)}</strong></p>
      <div className="form-row"><label>Stop loss<input type="number" step="any" placeholder="Not set" value={sl} onChange={e=>setSl(e.target.value)}/><small>{side==='BUY' ? 'Below' : 'Above'} entry</small></label><label>Take profit<input type="number" step="any" placeholder="Not set" value={tp} onChange={e=>setTp(e.target.value)}/><small>{side==='BUY' ? 'Above' : 'Below'} entry</small></label></div>
      <p className="notice-note">Leave either field empty to omit that exit. Levels are validated again against the price when you submit.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary full-width" type="submit">Apply to next order</button>
      <button type="button" className="text-button full-width" onClick={()=>{u.setEnableTPSL(false);u.setStopLoss('');u.setTakeProfit('');onClose();}}>Clear new-order SL/TP</button>
    </form>
  </Dialog>;
}
