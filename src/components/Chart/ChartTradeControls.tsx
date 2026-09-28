"use client";
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Crosshair, Zap, ShieldCheck, X, MousePointer2 } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useOrderFlow } from '@/store/useOrderFlow';
import { formatPrice, instrument } from '@/lib/market';
import { chartPrice } from '@/lib/chartInteraction';
import { useExecutableQuote } from '@/hooks/useExecutableQuote';
import { useOrderSubmit } from '@/components/OrderEntry/useOrderSubmit';
import { useOneClick } from '@/components/OrderEntry/useOneClick';
import type { TradeRequest } from '@/lib/contracts';
import { pendingAtPrice } from '@/lib/practice';
import { ChartDraftProtection } from './ChartDraftProtection';
import { Dialog } from '@/components/terminal/Dialog';
import { useAccountStore } from '@/store/useAccountStore';
import { accountKindLabel } from '@/lib/accountSessions';

export function ChartTradeControls({ symbol, pickedPrice, picking, onPickToggle, onClearPick, onPriceChange, onSelect }: {
  symbol: string; pickedPrice: number | null; picking: boolean;
  onPickToggle: () => void; onClearPick: () => void;
  onPriceChange: (price: number | null) => void; onSelect: (id: string) => void;
}) {
  const { submit, check, submitting, instantFor, canExecute, practice, policy, verifying, spec } = useOrderSubmit();
  const oneClick = useOneClick();
  const quote = useExecutableQuote(symbol);
  const limits = spec(symbol);
  const u = useUIStore(useShallow(s => ({ volumeInput:s.volumeInput, setVolumeInput:s.setVolumeInput, setVolumeLots:s.setVolumeLots, enableTPSL:s.enableTPSL, stopLoss:s.stopLoss, takeProfit:s.takeProfit })));
  const account = useAccountStore(s => s.accounts.find(a => a.id === s.activeId));
  const inFlight = useOrderFlow(s => s.inFlight);
  const [riskOpen, setRiskOpen] = useState(false), [review, setReview] = useState<TradeRequest | null>(null), [error, setError] = useState('');
  const [entryText, setEntryText] = useState('');
  const pending = picking || pickedPrice !== null;
  const lots = u.volumeInput;
  const busy = submitting || inFlight || !!verifying;
  const protectionCount = u.enableTPSL ? Number(!!u.stopLoss) + Number(!!u.takeProfit) : 0;
  useEffect(() => { setReview(null); setRiskOpen(false); setError(''); setEntryText(''); onClearPick(); }, [symbol, practice, account?.id, canExecute, onClearPick]);
  useEffect(() => { setEntryText(pickedPrice === null ? '' : String(pickedPrice)); }, [pickedPrice]);
  function clear() { setEntryText(''); setError(''); onClearPick(); }
  function typeFor(side: 'BUY' | 'SELL') {
    const reference = side === 'BUY' ? quote?.ask : quote?.bid;
    return pending && pickedPrice !== null && reference ? pendingAtPrice(side, pickedPrice, reference) : 'MARKET';
  }
  async function send(request: TradeRequest) {
    const result = await submit(request);
    if (result.ok) { setReview(null); clear(); if (result.id) onSelect(result.id); }
    else if (result.error) setError(result.error);
  }
  function order(side: 'BUY' | 'SELL') {
    setError('');
    if (pending && pickedPrice === null) { setError('Choose an entry price on the chart or enter it below.'); return; }
    const request: TradeRequest = { symbol, orderType:side, lotSize:Number(lots), executionType:typeFor(side), ...(pending ? {limitPrice:pickedPrice!} : {}), ...(u.enableTPSL && u.stopLoss ? {sl:Number(u.stopLoss)} : {}), ...(u.enableTPSL && u.takeProfit ? {tp:Number(u.takeProfit)} : {}) };
    const invalid = check(request);
    if (invalid) { setError(invalid); return; }
    u.setVolumeLots(request.lotSize);
    // A picked price is always a draft. One-click only bypasses review for chart MARKET orders.
    if (!pending && instantFor(request.lotSize)) void send(request);
    else setReview(request);
  }
  if (!canExecute) return <div className="chart-account-context"><span><ShieldCheck />{account ? `${accountKindLabel(account.kind)} account ${account.username}` : 'Market preview'}</span><span title={policy.reason}>{policy.mode === 'close-only' ? 'Close-only' : 'View only'}</span><button onClick={() => { const w=useWorkspaceStore.getState(); w.setFocus(false); w.setPanel('activity'); w.setActivityExpanded(true); useUIStore.getState().setBottomTab('positions'); }}>View positions</button></div>;
  return <>
    <div className="chart-dealing" aria-label="Chart trading">
      {(['SELL','BUY'] as const).map((side, index) => <div className="chart-deal-slot" key={side}>
        {index === 1 && <label className="chart-lots"><span>Lots</span><input aria-label="Chart order volume" type="number" min={limits.min} max={limits.max} step={limits.step} inputMode="decimal" value={lots} onChange={e=>u.setVolumeInput(e.target.value)} /></label>}
        <button className={`chart-deal ${side.toLowerCase()}`} disabled={busy || (pending && pickedPrice === null)} aria-label={`${pending || !instantFor(Number(lots)) ? 'Review' : 'Place'} chart ${side.toLowerCase()} ${pending ? typeFor(side).toLowerCase()+' order' : 'market order'}`} onClick={()=>order(side)}>
          <span>{side === 'BUY' ? 'Buy' : 'Sell'}{pending && pickedPrice !== null ? ` ${typeFor(side).toLowerCase()}` : ''}</span>
          <strong>{formatPrice(pending ? pickedPrice ?? undefined : side === 'BUY' ? quote?.ask : quote?.bid, symbol)}</strong>
        </button>
      </div>)}
    </div>
    <div className="chart-execution-toolbar" aria-label="Chart order tools">
      <div className="chart-order-mode" aria-label="Chart order type"><button aria-pressed={!pending} onClick={clear}>Market</button><button aria-pressed={pending} onClick={()=>{if(!pending) onPickToggle();}}><Crosshair />Pending order</button></div>
      <button className={`chart-execution-option ${oneClick.on ? 'is-on' : ''}`} aria-pressed={oneClick.on} aria-label={`One-click market orders ${oneClick.on ? 'on' : 'off'}`} onClick={()=>oneClick.set(!oneClick.on)} title="One-click applies to market orders. Pending orders always open a review."><Zap /><span>One-click</span><b>{oneClick.on ? 'On' : 'Off'}</b></button>
      <button className="chart-execution-option" aria-label="Set new-order stop loss and take profit" aria-haspopup="dialog" onClick={()=>setRiskOpen(true)}><ShieldCheck /><span>New-order SL/TP</span>{protectionCount > 0 && <b>{protectionCount}</b>}</button>
    </div>
    {pending ? <div className="chart-pending-builder">
      <label>Entry price<input aria-label="Pending chart entry price" type="number" step={10 ** -(instrument(symbol).digits ?? 5)} min="0" inputMode="decimal" placeholder="Pick on chart or enter price" value={entryText} onChange={e=>{ setEntryText(e.target.value); onPriceChange(chartPrice(e.target.value, instrument(symbol).digits ?? 5)); }} /></label>
      <button className="chart-repick" aria-pressed={picking} onClick={onPickToggle}><MousePointer2 />{picking ? 'Choosing on chart…' : 'Pick on chart'}</button>
      <button className="icon-button" onClick={clear} aria-label="Cancel pending order draft"><X /></button>
      <p role="status">{picking ? 'Click the chart to set your entry. This does not place an order.' : 'Drag the entry handle to adjust. Choose Buy or Sell above to review.'}</p>
    </div> : <div className="chart-execution-hint">{oneClick.on && instantFor(Number(lots)) ? 'Buy / Sell sends a market order immediately.' : oneClick.on ? 'This volume requires an order review.' : 'Buy / Sell opens an order review.'}<span>{practice ? 'Practice · virtual funds' : account ? `${accountKindLabel(account.kind)} · ${account.username}` : ''}</span></div>}
    {verifying && <p className="chart-order-error" role="status">Confirming your previous order. New orders are paused until its status is known.</p>}
    {error && !review && <div className="chart-order-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss chart trade error"><X /></button></div>}
    {riskOpen && <ChartDraftProtection symbol={symbol} entry={pickedPrice} onClose={()=>setRiskOpen(false)} />}
    {oneClick.dialog}
    {review && <Dialog title="Review chart order" onClose={()=>{setReview(null);setError('');}}>
      <div className="review-instrument"><span className={`side-label ${review.orderType.toLowerCase()}`}>{review.orderType}</span><h3>{review.symbol}</h3><span>{review.lotSize} lots</span></div>
      <dl className="detail-list"><div><dt>Order type</dt><dd>{review.orderType} {review.executionType}</dd></div><div><dt>Entry price</dt><dd>{formatPrice(review.limitPrice ?? (review.orderType==='BUY' ? quote?.ask : quote?.bid),symbol)}</dd></div><div><dt>Stop loss</dt><dd>{review.sl ? formatPrice(review.sl,symbol) : 'Not set'}</dd></div><div><dt>Take profit</dt><dd>{review.tp ? formatPrice(review.tp,symbol) : 'Not set'}</dd></div><div><dt>Account</dt><dd>{practice ? 'Practice · virtual USD' : account?.username ?? 'Connected account'}</dd></div></dl>
      <p className="notice-note">{review.executionType !== 'MARKET' ? 'This order waits at your chosen price. It does not open a position immediately.' : practice ? 'Simulated execution using virtual funds.' : 'Submitting sends this order for execution. The fill price may differ.'}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className={`button full-width place-order ${review.orderType.toLowerCase()}`} disabled={busy} onClick={()=>void send(review)}>{submitting ? 'Placing…' : `Place ${practice ? 'practice ' : ''}${review.orderType.toLowerCase()} ${review.executionType.toLowerCase()}`}</button>
      <button className="text-button full-width" disabled={busy} onClick={()=>{setReview(null);setError('');}}>Back to chart draft</button>
    </Dialog>}
  </>;
}
