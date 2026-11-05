"use client";
import { useMarketDisplay } from '@/hooks/useMarketDisplay';
import { useEffect, useRef, useState } from "react";
import { PORTAL_SIGN_IN } from "@/lib/portalHandoff";
import {
  ArrowRight,
  X,
  ShieldCheck,
  Plus,
  Minus,
  LockKeyhole,
  Crosshair,
  RefreshCw,
  CircleAlert,
  CheckCircle2,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { usePriceStore } from "@/store/usePriceStore";
import { useGetAllStocksQuery } from "@/store/api/tradingApi";

import { validateTrade, TradeRequest } from "@/lib/contracts";
import { isQuoteExecutable } from "@/lib/freshness";
import { validateVolume, stepVolume, needsReview } from "@/lib/volume";
import { useExecutableQuote } from "@/hooks/useExecutableQuote";
import { orderRisk, lotsForRisk } from "@/lib/risk";
import { OrderReview } from "@/components/terminal/OrderReview";
import { OrderResult } from "@/components/terminal/OrderResult";
import { ticketRequest, pendingEntryRule, pendingPriceSuggestion } from '@/lib/orderTicket';
import { PRACTICE_CONTRACTS } from '@/lib/practice';
import { useAccountStore } from '@/store/useAccountStore';
import { accountKindLabel } from '@/lib/accountSessions';
import { useOrderSubmit } from "./useOrderSubmit";
import { useOrderFlow } from '@/store/useOrderFlow';
import { receiptCopy } from '@/lib/orderReceipt';
const usd = (n: number | undefined, signed = false) =>
  n === undefined ? "—" : `${signed ? (n > 0 ? "+" : n < 0 ? "−" : "") : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function OrderEntry({ docked = false }: { docked?: boolean }) {
  const { formatPrice, instrument } = useMarketDisplay();
  const activeAccount = useAccountStore(s => s.accounts.find(a => a.id === s.activeId));
  const u = useUIStore(),
    w = useWorkspaceStore();
  const symbol = u.activeSymbol;
  const connection = usePriceStore((s) => s.connection);
  const volume=u.volumeInput,setVolume=u.setVolumeInput;
  const entry=u.pendingEntry, setEntry=u.setPendingEntry;
  const [error, setError] = useState(""),
    [review, setReview] = useState<TradeRequest | null>(null),
    [showResult, setShowResult] = useState(false),
    [riskAmount, setRiskAmount] = useState(""),
    [now, setNow] = useState(0);
  const { submit, check: checkSubmit, submitting, canExecute, practice, policy, verifying, spec, specReady } = useOrderSubmit();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const generation = useAccountStore(s=>s.generation);
  const receipt = useOrderFlow(s=>s.receipt);
  const inFlight=useOrderFlow(s=>s.inFlight);
  const ticketOpen=useWorkspaceStore(s=>s.ticketOpen);
  useEffect(()=>{
    if(!ticketOpen)return;
    const frame=requestAnimationFrame(()=>{
      const input=document.getElementById('lot-volume');
      if(input?.getClientRects().length)input.focus();
    });
    return ()=>cancelAnimationFrame(frame);
  },[ticketOpen,u.orderDraftVersion]);
  const stocks = useGetAllStocksQuery(undefined, { skip: practice || !u.isAuthenticated });
  const metadata = practice ? undefined : stocks.data?.find((i) => i.symbol === symbol);
  // The same quote the submit path validates against: the live bid and ask.
  const quote = useExecutableQuote(symbol);
  const limits = spec(symbol);
  const min = limits.min, step = limits.step;
  const contract = practice ? PRACTICE_CONTRACTS[symbol] : metadata?.contractSize ?? instrument(symbol).contractSize;
  const quoteReady = isQuoteExecutable(quote, now) && (practice || connection === "connected");
  const fresh = quoteReady;
  const executable = policy.canPlaceSymbol(symbol) && quoteReady;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setError("");
    setReview(null);
  }, [symbol, practice, ticketOpen, u.selectedOrderSide, u.orderDraftVersion, u.pendingEntry, u.orderMode, u.pendingOrderType, u.stopLoss, u.takeProfit, u.enableTPSL]);
  useEffect(()=>{setShowResult(false);setReview(null);setError('');},[symbol,practice,generation,u.orderDraftVersion]);
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  const side = u.selectedOrderSide;
  const reference = side === "BUY" ? quote?.ask : quote?.bid;
  const entryPrice = Number(entry);
  const pendingType = u.pendingOrderType;
  const entryRule = pendingEntryRule(side,pendingType);
  const draft = ticketRequest(u,side);
  const risk = orderRisk(draft, reference, contract, practice ? 100 : undefined);
  function check(payload: TradeRequest) {
    if (canExecute && !specReady) return "Loading instrument details…";
    if (u.orderMode === "PENDING" && !(entryPrice > 0)) return "Set an entry price for the pending order.";
    return validateVolume(payload.lotSize, limits) ?? validateTrade(payload, quote);
  }
  async function place(payload: TradeRequest) {
    const submittedGeneration = useAccountStore.getState().generation;
    const issue = checkSubmit(payload);
    if(issue){setError(issue);return;}
    setReview(null);
    setShowResult(true);
    const result = await submit(payload);
    if(submittedGeneration !== useAccountStore.getState().generation)return;
    if (result.ok) {
      setError("");
      if (result.id) w.selectTrade(result.id);
      w.setActivityExpanded(true);
      u.setPickingEntry(false);
    } else if (result.unknown) {
      setError("");
    } else if (result.error) {
      setError(result.error);
      if(!useOrderFlow.getState().receipt)setShowResult(false);
    }
  }
  function act(orderSide: 'BUY'|'SELL') {
    setError("");
    const payload = ticketRequest(u,orderSide), issue = check(payload) ?? checkSubmit(payload);
    if (issue) {
      setError(issue);
      return;
    }
    u.setVolumeLots(payload.lotSize);
    // The configured ticket is the final action, as in the app. Retain the large-volume guard.
    if(needsReview(payload.lotSize))setReview(payload);
    else void place(payload);
  }
  function sizeByRisk() {
    const stop = Number(u.stopLoss), amount = Number(riskAmount);
    const at = u.orderMode === "PENDING" ? entryPrice : reference;
    const lots = contract && at && stop ? lotsForRisk(symbol, side, amount, contract, at, stop, step) : undefined;
    if (!lots) {
      setError(!(stop > 0) ? "Set a stop loss first, then size by risk." : "That risk is too small for the minimum volume at this stop.");
      return;
    }
    setError("");
    setVolume(String(Math.min(lots, limits.max)));
  }
  const locked = submitting || inFlight || !!verifying;
  const pendingIssue = u.orderMode==='PENDING' && entry ? check(draft) : null;
  const sideIssues = {BUY:check(ticketRequest(u,'BUY')),SELL:check(ticketRequest(u,'SELL'))};
  const confirmed = !!receipt && receipt.request.symbol === symbol && (receipt.status === 'open' || receipt.status === 'pending');
  const resultVisible = showResult && !!receipt && ['rejected','unconfirmed'].includes(receipt.status);
  const receiptUncertain = receipt?.status === 'rejected' || receipt?.status === 'unconfirmed';
  const blockedReason = verifying || !canExecute ? null
    : !policy.canPlaceSymbol(symbol) ? `Trading in ${symbol} is paused.`
    : !quoteReady ? "Waiting for a fresh quote…" : null;
  return (
    <aside className="order-panel panel">
      <div className="panel-heading">
        <div>
          <h2>{resultVisible ? "Order status" : review ? "Review large order" : "New order"}<span className="ticket-heading-symbol">{symbol}</span></h2>
          <span className="ticket-mode">{practice ? "Practice account" : activeAccount ? `${accountKindLabel(activeAccount.kind)} · ${activeAccount.username}` : "No account connected"}</span>
        </div>
        {!docked && <button className="icon-button" aria-label="Close order ticket" disabled={submitting || inFlight} onClick={()=>{setReview(null);w.closeOrderTicket();u.setPickingEntry(false);}}><X/></button>}
      </div>
      {resultVisible ? <OrderResult onBack={()=>{setShowResult(false);setError('');}}/> : !review && <>
      <fieldset className="order-scroll ticket-fields" disabled={locked}>
        {receipt && receipt.request.symbol === symbol && !resultVisible && <div className={`ticket-confirmed-inline ${confirmed?'':receiptUncertain?'is-uncertain':'is-working'}`} role="status"><strong>{confirmed?<CheckCircle2/>:receiptUncertain?<CircleAlert/>:<RefreshCw className="spin"/>}{receiptCopy(receipt).title}{receipt.id?` · #${receipt.id}`:''}</strong><span>{receipt.request.orderType} {receipt.request.lotSize} {receipt.request.symbol}{receipt.fillPrice!=null?` · ${formatPrice(receipt.fillPrice,receipt.request.symbol)}`:''}</span>{!confirmed&&<small>{receiptCopy(receipt).message}</small>}</div>}
        {error && <p ref={errorRef} tabIndex={-1} className="form-error ticket-error" role="alert">{error}</p>}
        <label className="ticket-order-kind">Order type
          <select aria-label="Order type" value={u.orderMode==='MARKET'?'MARKET':`${side}_${pendingType}`} onChange={e=>{
            setError('');
            if(e.target.value==='MARKET'){u.setExecutionType('MARKET');return;}
            const [nextSide,nextType]=e.target.value.split('_') as ['BUY'|'SELL','LIMIT'|'STOP'];
            u.setSelectedOrderSide(nextSide);u.setExecutionType(nextType);
            if(!entry){const suggested=pendingPriceSuggestion(nextSide,nextType,quote,instrument(symbol).digits??5);if(suggested!=null)setEntry(String(suggested));}
          }}>
            <option value="MARKET">Market execution</option>
            <option value="BUY_LIMIT">Buy limit — below market</option><option value="SELL_LIMIT">Sell limit — above market</option>
            <option value="BUY_STOP">Buy stop — above market</option><option value="SELL_STOP">Sell stop — below market</option>
          </select>
        </label>
        <label className="field-label" htmlFor="lot-volume">
          Volume <span>Lots</span>
        </label>
        <div className="volume-control">
          <button
            type="button"
            aria-label="Decrease volume"
            onClick={() => setVolume(String(stepVolume(Number(volume), limits, -1)))}
          >
            <Minus />
          </button>
          <input
            id="lot-volume"
            type="number"
            inputMode="decimal"
            min={min}
            step={step}
            max={limits.max}
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
          />
          <button
            type="button"
            aria-label="Increase volume"
            onClick={() => setVolume(String(stepVolume(Number(volume), limits, 1)))}
          >
            <Plus />
          </button>
        </div>
        <p className="volume-limits">Min {limits.min} · Max {limits.max} · Step {limits.step} lots</p>
        <div className="volume-presets">
          {["0.01", "0.10", "0.50", "1.00"].map((v) => (
            <button
              key={v}
              aria-pressed={Number(volume) === Number(v)}
              onClick={() => setVolume(v)}
            >
              {v}
            </button>
          ))}
        </div>
        {u.orderMode === "PENDING" && (
          <div className="pending-fields">
            <label>
              {pendingType==='LIMIT'?'Limit price':'Stop price'}
              <span className="input-with-action">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={entry}
                  aria-invalid={!!pendingIssue}
                  aria-describedby="pending-entry-rule"
                  onChange={(e) => setEntry(e.target.value)}
                  placeholder="Set your entry price"
                />
                <button type="button" title="Suggest an entry just beyond the quote on the required side" aria-label="Suggest valid pending entry" disabled={!reference} onClick={() => {const price=pendingPriceSuggestion(side,pendingType,quote,instrument(symbol).digits??5);if(price!=null)setEntry(String(price));}}><Crosshair /></button>
              </span>
            </label>
<button className="text-button ticket-chart-pick" onClick={()=>{u.setPickingEntry(true);w.closeOrderTicket();w.setFocus(false);}}><Crosshair/>Choose entry on chart</button>
            <p className="pending-type" id="pending-entry-rule">
              {entryRule.sideName} {pendingType.toLowerCase()}: set the entry {entryRule.direction} {entryRule.quoteName} ({formatPrice(reference,symbol)}).
            </p>
            {pendingIssue && <p className="form-error" role="status">{pendingIssue}</p>}
          </div>
        )}
        <div className="risk-heading">
          <span>
            <ShieldCheck />
            Risk controls
          </span>
          <label className="switch">
            <input
              aria-label="Enable stop loss and take profit"
              type="checkbox"
              checked={u.enableTPSL}
              onChange={(e) => u.setEnableTPSL(e.target.checked)}
            />
            <span />
          </label>
        </div>
        {u.enableTPSL ? (
          <>
            {u.orderMode === 'MARKET' && <div className="risk-direction">
              <span className="field-label">SL/TP direction</span>
              <div className="segmented" aria-label="Direction for stop loss and take profit">
                {(['SELL', 'BUY'] as const).map(s => <button key={s} aria-pressed={side === s} onClick={() => { u.setSelectedOrderSide(s); setError(''); }}>{s === 'BUY' ? 'Buy' : 'Sell'}</button>)}
              </div>
            </div>}
            <div className="risk-fields">
              <label>
                Stop loss
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={u.stopLoss}
                  onChange={(e) => u.setStopLoss(e.target.value)}
                  placeholder="Price"
                />
                <small className={`risk-hint ${risk.atStop !== undefined ? "negative" : ""}`}>{u.stopLoss ? usd(risk.atStop, true) : "Optional"}</small>
              </label>
              <label>
                Take profit
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={u.takeProfit}
                  onChange={(e) => u.setTakeProfit(e.target.value)}
                  placeholder="Price"
                />
                <small className={`risk-hint ${risk.atTarget !== undefined ? "positive" : ""}`}>{u.takeProfit ? usd(risk.atTarget, true) : "Optional"}</small>
              </label>
            </div>
            <details className="ticket-extra"><summary>Size by risk amount</summary><div className="risk-size">
              <label htmlFor="risk-amount">Size by risk</label>
              <span className="input-with-prefix"><span>$</span><input id="risk-amount" type="number" inputMode="decimal" min="0" step="any" placeholder="Amount" value={riskAmount} onChange={(e) => setRiskAmount(e.target.value)} /></span>
              <button type="button" className="button button-outline" disabled={!riskAmount} onClick={sizeByRisk}>Set lots</button>
            </div></details>
          </>
        ) : (
          <p className="helper risk-helper">
            Set optional exit levels before you enter a trade.
          </p>
        )}
        <details className="ticket-extra"><summary>Order details</summary><dl className="ticket-summary">
          <div>
            <dt>{practice ? "Est. margin" : "Instrument"}</dt>
            <dd>{practice ? usd(risk.margin) : instrument(symbol).name}</dd>
          </div>
          <div>
            <dt>{risk.rewardRisk !== undefined ? "Reward : risk" : practice ? "Practice leverage" : "Execution"}</dt>
            <dd>
              {risk.rewardRisk !== undefined ? `1 : ${risk.rewardRisk}` : practice ? "1:100 · USD" : u.orderMode === "MARKET"
                ? "Market price"
                : pendingType ? `${side.toLowerCase()} ${pendingType.toLowerCase()}` : "Pending"}
            </dd>
          </div>
        </dl></details>
      </fieldset>
      <div className="order-bottom">
        {!practice && u.isAuthenticated && policy.reason && (
          <div className="execution-notice">
            <LockKeyhole />
            <span>
              <strong>{policy.mode === "close-only" ? "Close-only mode" : "New orders unavailable"}</strong>
              <small>{policy.mode === "close-only" ? "You can close or reduce positions. New orders are paused." : policy.reason}</small>
            </span>
          </div>
        )}
        {verifying && (
          <div className="execution-notice is-verifying" role="status">
            <RefreshCw className="spin" />
            <span>
              <strong>Confirming {verifying.request.orderType.toLowerCase()} {verifying.request.lotSize} {verifying.request.symbol}</strong>
              <small>The response was lost. We're checking your account — don't place it again.</small>
            </span>
          </div>
        )}
        {u.orderMode==='MARKET' ? <div className="ticket-market-actions">
          {(['SELL','BUY'] as const).map(orderSide=><div key={orderSide}>
            <button className={`button place-order ${orderSide.toLowerCase()}`} onClick={()=>act(orderSide)} disabled={locked || !executable || !specReady || !!sideIssues[orderSide]} aria-label={`${needsReview(Number(volume))?'Review ':''}${orderSide==='BUY'?'Buy':'Sell'} ${Number(volume)||0} lots ${symbol}`} aria-describedby={`ticket-${orderSide.toLowerCase()}-hint`}>
              <span>{needsReview(Number(volume))?'Review ':''}{orderSide==='BUY'?'Buy':'Sell'} {Number(volume)||0}</span><strong>{formatPrice(orderSide==='BUY'?quote?.ask:quote?.bid,symbol)}</strong>
            </button>
            <small id={`ticket-${orderSide.toLowerCase()}-hint`}>{quoteReady && specReady ? sideIssues[orderSide] ?? '' : 'Waiting for live prices'}</small>
          </div>)}
        </div> : <button className={`button full-width place-order ${side.toLowerCase()}`} onClick={()=>act(side)} disabled={locked || !executable || !specReady || !!check(draft)}>
          {needsReview(Number(volume))?'Review':'Place'} {side.toLowerCase()} {pendingType.toLowerCase()}<ArrowRight/>
        </button>}
        <p className="ticket-submit-hint">{needsReview(Number(volume))?'Large volume: review the details before sending.':u.orderMode==='MARKET'?'Buy / Sell sends immediately at the available market price.':'Place sends this pending order to your account.'}</p>
        {blockedReason && canExecute && <p className="helper ticket-blocked" role="status">{blockedReason}</p>}
        {!practice && !u.isAuthenticated && (
          <a className="text-button connect-inline" href={PORTAL_SIGN_IN}>
            Open an account from your client portal
            <ArrowRight />
          </a>
        )}
        {practice && <p className="ticket-disclaimer">Simulated prices · no real money or market execution</p>}
      </div>
      </>}
      {!resultVisible && review && <OrderReview inline request={review} reference={review.orderType==='BUY'?quote?.ask:quote?.bid} contract={contract} practice={practice} account={u.tradingAccountNo || 'Not connected'} busy={locked} available={executable} error={error} notice={policy.reason || (!fresh ? 'Waiting for a fresh market quote.' : undefined)} onConfirm={()=>void place(review)} onClose={()=>{setReview(null);setError('');requestAnimationFrame(()=>document.getElementById('lot-volume')?.focus());}} />}

    </aside>
  );
}
