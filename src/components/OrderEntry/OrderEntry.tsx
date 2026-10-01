"use client";
import { useEffect, useRef, useState } from "react";
import { PORTAL_SIGN_IN } from "@/lib/portalHandoff";
import {
  ArrowRight,
  ShieldCheck,
  Info,
  Plus,
  Minus,
  LockKeyhole,
  Zap,
  Crosshair,
  RefreshCw,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { usePriceStore } from "@/store/usePriceStore";
import { useGetAllStocksQuery } from "@/store/api/tradingApi";
import { formatPrice, instrument } from "@/lib/market";
import { validateTrade, TradeRequest } from "@/lib/contracts";
import { isQuoteExecutable } from "@/lib/freshness";
import { validateVolume, stepVolume, needsReview } from "@/lib/volume";
import { useExecutableQuote } from "@/hooks/useExecutableQuote";
import { orderRisk, lotsForRisk } from "@/lib/risk";
import { Dialog } from "@/components/terminal/Dialog";
import { InstrumentIcon } from '@/components/terminal/InstrumentIcon';
import { PRACTICE_CONTRACTS, pendingAtPrice } from '@/lib/practice';
import { useAccountStore } from '@/store/useAccountStore';
import { accountKindLabel } from '@/lib/accountSessions';
import { useOrderSubmit } from "./useOrderSubmit";
import { useOneClick } from "./useOneClick";
const usd = (n: number | undefined, signed = false) =>
  n === undefined ? "—" : `${signed ? (n > 0 ? "+" : n < 0 ? "−" : "") : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function OrderEntry() {
  const activeAccount = useAccountStore(s => s.accounts.find(a => a.id === s.activeId));
  const u = useUIStore(),
    w = useWorkspaceStore();
  const symbol = u.activeSymbol;
  const connection = usePriceStore((s) => s.connection);
  const volume=u.volumeInput,setVolume=u.setVolumeInput;
  const [entry, setEntry] = useState(""),
    [error, setError] = useState(""),
    [review, setReview] = useState<TradeRequest | null>(null),
    [riskAmount, setRiskAmount] = useState(""),
    [now, setNow] = useState(0);
  const { submit, check: checkSubmit, submitting, instantFor, canExecute, practice, policy, verifying, spec, specReady } = useOrderSubmit();
  const oneClick = useOneClick();
  const stocks = useGetAllStocksQuery(undefined, { skip: practice || !u.isAuthenticated });
  const metadata = practice ? undefined : stocks.data?.find((i) => i.symbol === symbol);
  // The same quote the submit path validates against, including any account spread markup.
  const quote = useExecutableQuote(symbol);
  const limits = spec(symbol);
  const min = limits.min, step = limits.step;
  const contract = practice ? PRACTICE_CONTRACTS[symbol] : metadata?.contractSize ?? instrument(symbol).contractSize;
  const quoteReady = isQuoteExecutable(quote, now) && (practice || connection === "connected");
  const fresh = quoteReady;
  const executable = canExecute && quoteReady;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setError("");
    setEntry("");
    u.setStopLoss("");
    u.setTakeProfit("");
    setReview(null);
  }, [symbol, practice, u.setStopLoss, u.setTakeProfit]);
  const side = u.selectedOrderSide;
  // Exit levels are side-specific: a Buy stop below the market is invalid for a Sell, so switching sides clears them.
  const previousSide = useRef(side);
  useEffect(() => {
    if (previousSide.current === side) return;
    previousSide.current = side;
    if (u.stopLoss || u.takeProfit) {
      u.setStopLoss("");
      u.setTakeProfit("");
    }
  }, [side, u]);
  const reference = side === "BUY" ? quote?.ask : quote?.bid;
  // The pending type follows from where the entry sits relative to the market, so it can never be on the wrong side.
  const entryPrice = Number(entry);
  const pendingType = u.orderMode === "PENDING" && entry && entryPrice > 0 && reference ? pendingAtPrice(side, entryPrice, reference) : undefined;
  function build(): TradeRequest {
    return {
      symbol,
      orderType: side,
      executionType: u.orderMode === "MARKET" ? "MARKET" : pendingType ?? "LIMIT",
      lotSize: Number(volume),
      ...(u.orderMode === "PENDING" ? { limitPrice: entryPrice } : {}),
      ...(u.enableTPSL && u.stopLoss ? { sl: Number(u.stopLoss) } : {}),
      ...(u.enableTPSL && u.takeProfit ? { tp: Number(u.takeProfit) } : {}),
    };
  }
  const draft = build();
  const risk = orderRisk(draft, reference, contract, practice ? 100 : undefined);
  function check(payload: TradeRequest) {
    if (canExecute && !specReady) return "Loading instrument details…";
    if (u.orderMode === "PENDING" && !(entryPrice > 0)) return "Set an entry price for the pending order.";
    return validateVolume(payload.lotSize, limits) ?? validateTrade(payload, reference);
  }
  async function place(payload: TradeRequest) {
    const result = await submit(payload);
    if (result.ok) {
      setReview(null);
      setError("");
      if (payload.executionType !== "MARKET") setEntry("");
      if (result.id) w.selectTrade(result.id);
      w.setActivityExpanded(true);
    } else if (result.unknown) {
      // The "Confirming…" notice below owns this state until the order is found or ruled out.
      setError("");
      setReview(null);
    } else if (result.error) {
      setError(result.error);
      setReview(null);
    }
  }
  const instant = instantFor(Number(volume));
  function act() {
    setError("");
    const payload = build(), issue = check(payload);
    if (issue) {
      setError(issue);
      return;
    }
    u.setVolumeLots(payload.lotSize);
    // With one-click, anything the submit path would reject is shown here instead of a dialog.
    if (instant && quoteReady) {
      const blocked = checkSubmit(payload);
      if (blocked) setError(blocked);
      else void place(payload);
    } else setReview(payload);
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
  const actionLabel = u.orderMode === "MARKET"
    ? `${side === "BUY" ? "Buy" : "Sell"} ${Number(volume) || 0} lots at market`
    : `Place ${side.toLowerCase()} ${(pendingType ?? "limit").toLowerCase()}`;
  const blockedReason = verifying || !canExecute ? null
    : !policy.canPlaceSymbol(symbol) ? `Trading in ${symbol} is paused.`
    : !quoteReady ? "Waiting for a fresh quote…" : null;
  return (
    <aside className="order-panel panel">
      <div className="panel-heading">
        <div>
          <span className="ticket-mode">{practice ? "Practice account" : activeAccount ? `${accountKindLabel(activeAccount.kind)} · ${activeAccount.username}` : "No account connected"}</span>
          <h2>Order ticket</h2>
        </div>
        <span className="ticket-instrument"><InstrumentIcon symbol={symbol}/>{symbol}</span>
      </div>
      <div className="order-scroll">
        <div className="segmented" aria-label="Order execution type">
          {(["MARKET", "PENDING"] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={u.orderMode === mode}
              onClick={() => {
                u.setOrderMode(mode);
                setError("");
              }}
            >
              {mode === "MARKET" ? "Market order" : "Pending order"}
            </button>
          ))}
        </div>
        <div className="price-choice" aria-label="Trade direction">
          {(["SELL", "BUY"] as const).map((s) => (
            <button
              key={s}
              className={`quote-side ${s.toLowerCase()}`}
              aria-pressed={side === s}
              onClick={() => {
                u.setSelectedOrderSide(s);
                setError("");
              }}
            >
              <span>
                {s === "BUY" ? "Buy" : "Sell"}
                <span>{s === "BUY" ? "Ask" : "Bid"}</span>
              </span>
              <strong>
                {formatPrice(s === "BUY" ? quote?.ask : quote?.bid, symbol)}
              </strong>
            </button>
          ))}
        </div>
        <div className="spread-line">
          <span>Spread</span>
          <span>
            {quote ? formatPrice(quote.ask - quote.bid, symbol) : "—"}{" "}
            <small>price units</small>
          </span>
        </div>
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
              Entry price
              <span className="input-with-action">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  placeholder="Set your entry price"
                />
                <button type="button" title="Start from the current price" aria-label="Use current market price" disabled={!reference} onClick={() => reference && setEntry(String(Number(reference.toFixed(instrument(symbol).digits ?? 5))))}><Crosshair /></button>
              </span>
            </label>
            <p className="pending-type" aria-live="polite">
              {pendingType ? <><strong>{side === "BUY" ? "Buy" : "Sell"} {pendingType.toLowerCase()}</strong> · fills when the {side === "BUY" ? "ask" : "bid"} {pendingType === "LIMIT" ? (side === "BUY" ? "falls to" : "rises to") : side === "BUY" ? "rises to" : "falls to"} this price</> : "Limit or stop is chosen from where you place the entry."}
            </p>
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
            <div className="risk-size">
              <label htmlFor="risk-amount">Size by risk</label>
              <span className="input-with-prefix"><span>$</span><input id="risk-amount" type="number" inputMode="decimal" min="0" step="any" placeholder="Amount" value={riskAmount} onChange={(e) => setRiskAmount(e.target.value)} /></span>
              <button type="button" className="button button-outline" disabled={!riskAmount} onClick={sizeByRisk}>Set lots</button>
            </div>
          </>
        ) : (
          <p className="helper risk-helper">
            Set optional exit levels before you enter a trade.
          </p>
        )}
        <dl className="ticket-summary">
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
        </dl>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
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
        <button
          className={`button full-width place-order ${side.toLowerCase()}`}
          onClick={act}
          disabled={submitting || !!verifying}
          aria-describedby="ticket-execution-mode"
        >
          {submitting ? "Placing…" : instant && quoteReady ? actionLabel : needsReview(Number(volume)) && oneClick.on ? `Review large ${side.toLowerCase()} order` : `Review ${side.toLowerCase()} order`}
          {instant && quoteReady ? <Zap /> : <ArrowRight />}
        </button>
        {canExecute && (
          <div className="one-click-line" id="ticket-execution-mode">
            <span>{oneClick.on ? <><Zap />One-click trading on</> : "Review before placing"}</span>
            <button className="text-button" onClick={() => oneClick.set(!oneClick.on)}>{oneClick.on ? "Review first" : "Turn on one-click"}</button>
          </div>
        )}
        {blockedReason && canExecute && <p className="helper ticket-blocked" role="status">{blockedReason}</p>}
        {!practice && !u.isAuthenticated && (
          <a className="text-button connect-inline" href={PORTAL_SIGN_IN}>
            Open an account from your client portal
            <ArrowRight />
          </a>
        )}
        <p className="ticket-disclaimer">
          {practice ? "Simulated prices · no real money or market execution" : "Prices can change. Orders execute at the available market price."}
        </p>
      </div>
      {oneClick.dialog}
      {review && (
        <Dialog
          title={practice ? "Review practice order" : "Review your order"}
          onClose={() => {
            if (!submitting) setReview(null);
          }}
        >
          <div className="review-instrument">
            <span className={`side-label ${review.orderType.toLowerCase()}`}>
              {review.orderType}
            </span>
            <h3>{review.symbol}</h3>
            <span>{review.lotSize} lots</span>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Order type</dt>
              <dd>{review.executionType === "MARKET" ? "Market" : `${review.orderType === "BUY" ? "Buy" : "Sell"} ${review.executionType.toLowerCase()}`}</dd>
            </div>
            <div>
              <dt>
                {review.executionType === "MARKET"
                  ? "Indicative entry"
                  : "Entry price"}
              </dt>
              <dd>
                {formatPrice(review.limitPrice ?? reference, review.symbol)}
              </dd>
            </div>
            <div>
              <dt>Stop loss</dt>
              <dd>{review.sl ? <>{formatPrice(review.sl, review.symbol)} <small className="negative">{usd(orderRisk(review, reference, contract).atStop, true)}</small></> : "Not set"}</dd>
            </div>
            <div>
              <dt>Take profit</dt>
              <dd>{review.tp ? <>{formatPrice(review.tp, review.symbol)} <small className="positive">{usd(orderRisk(review, reference, contract).atTarget, true)}</small></> : "Not set"}</dd>
            </div>
            {practice && <div>
              <dt>Est. margin</dt>
              <dd>{usd(orderRisk(review, reference, contract, 100).margin)}</dd>
            </div>}
            <div>
              <dt>Trading account</dt>
              <dd>{practice ? "Practice · virtual USD" : u.tradingAccountNo || "Not connected"}</dd>
            </div>
          </dl>
          <p className="notice-note">
            <Info />
            {practice ? "This is a simulated trade, saved in this browser. 1:100 practice leverage, no commission or swap. Pending orders and exit levels run while practice mode is open." : policy.reason
              ? `${policy.reason} This review does not place a trade.`
              : !fresh
                ? "Waiting for a fresh market quote."
                : "Submitting sends this order for execution. The final fill price may differ."}
            {needsReview(review.lotSize) && <><br /><strong>Large order: {review.lotSize} lots.</strong> Check the volume before confirming.</>}
          </p>
          <button
            className={`button full-width place-order ${review.orderType.toLowerCase()}`}
            disabled={!executable || submitting || !!verifying}
            onClick={() => void place(review)}
          >
            {submitting
              ? "Placing…"
              : practice ? `Place practice ${review.orderType.toLowerCase()}` : !canExecute
                ? "Trading unavailable"
                : `Confirm ${review.orderType.toLowerCase()}`}
          </button>
          <button
            className="text-button full-width"
            disabled={submitting}
            onClick={() => setReview(null)}
          >
            Back to order ticket
          </button>
          {practice && !oneClick.on && <button className="text-button full-width" onClick={() => { oneClick.set(true); void place(review); }}><Zap />Place and skip review next time</button>}
        </Dialog>
      )}
    </aside>
  );
}
