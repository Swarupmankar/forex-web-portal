"use client";
import { receiptNotification } from '@/lib/tradeNotifications';
import { confirmReceipt, receiptDestination, type Receipt } from '@/lib/orderReceipt';
import { useAccountStore } from "@/store/useAccountStore";
import { useState } from "react";
import { usePlaceOrderMutation, useGetAllStocksQuery, tradingApi } from "@/store/api/tradingApi";
import { store } from "@/store";
import { usePracticeStore } from "@/store/usePracticeStore";
import { useUIStore } from "@/store/useUIStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useOrderFlow, type Verifying } from "@/store/useOrderFlow";
import { validateTrade, type TradeRequest } from "@/lib/contracts";
import { errorMessage } from "@/lib/market";
import { isQuoteExecutable } from "@/lib/freshness";
import { volumeSpec, validateVolume } from "@/lib/volume";
import { classifyFailure } from "@/lib/orderOutcome";
import { ownOrders } from '@/lib/positionPnl';
import { executableQuote } from "@/hooks/useExecutableQuote";
import { mobileSocketService } from "@/services/mobileSocket";
import { useExecutionPolicy } from "@/hooks/useExecutionPolicy";

export type SubmitResult =
  | { ok: true; id?: string; status: "OPEN" | "PENDING" | "SUBMITTED" }
  | { ok: false; error: string; unknown?: boolean };

const describe = (r: TradeRequest) =>
  `${r.orderType === "BUY" ? "Buy" : "Sell"} ${r.executionType === "MARKET" ? "" : r.executionType.toLowerCase() + " "}${r.lotSize} ${r.symbol}`;
const VERIFY_FOR_MS = 30000, VERIFY_EVERY_MS = 3000;

function openOrderIds() {
  const data = tradingApi.endpoints.getOpenOrders.select()(store.getState()).data;
  return [...(data?.openOrders ?? []), ...(data?.pendingOrders ?? [])].map((o) => String(o.id));
}
// After a timeout or lost response, poll the account until the order shows up or the window ends.
async function reconcile(v: Verifying) {
  const flow = useOrderFlow.getState(), notify = useWorkspaceStore.getState().notify;
  while (Date.now() - v.startedAt < VERIFY_FOR_MS) {
    await new Promise((r) => setTimeout(r, VERIFY_EVERY_MS));
    // An account switch clears the verification; its results must not leak into the next account.
    if (useOrderFlow.getState().verifying?.key !== v.key) return;
    const sub = store.dispatch(tradingApi.endpoints.getOpenOrders.initiate(undefined, { forceRefetch: true }));
    try {
      const data = await sub.unwrap();
      if (useOrderFlow.getState().verifying?.key !== v.key) return;
      const current=useOrderFlow.getState().receipt;
      if(!current || current.key!==v.key)return;
      const next=confirmReceipt(current,ownOrders([...(data.openOrders ?? []),...(data.pendingOrders ?? [])],current.accountId));
      flow.set({receipt:next});
      if(['open','pending','rejected'].includes(useOrderFlow.getState().receipt?.status ?? ''))return;
    } catch {
      // Keep checking until the window ends.
    } finally {
      sub.unsubscribe();
    }
  }
  if (useOrderFlow.getState().verifying?.key !== v.key) return;
  const current=useOrderFlow.getState().receipt;
  flow.set({ verifying: undefined, ...(current?.key===v.key && {receipt:{...current,status:'unconfirmed'}}) });
  const notice=current?.key===v.key?receiptNotification({...current,status:'unconfirmed'}):undefined;
  if(notice)notify(notice.text,notice.kind,notice.options);
  else notify(`We couldn't find ${describe(v.request)} on your account after 30 seconds. The outcome remains uncertain. Check History and Positions before deciding whether to retry.`, "error");
}

// One submission path enforces volume limits, executable quotes, trading policy,
// duplicate guards and idempotency for every configured ticket.
export function useOrderSubmit() {
  const policy = useExecutionPolicy();
  const { practice } = policy;
  const authenticated = useUIStore((s) => s.isAuthenticated);
  const stocks = useGetAllStocksQuery(undefined, { skip: practice || !authenticated });
  const verifying = useOrderFlow((s) => s.verifying);
  const [placeRemote] = usePlaceOrderMutation();
  const [submitting, setSubmitting] = useState(false);
  const canExecute = policy.canPlace;
  const spec = (symbol: string) => volumeSpec(practice, stocks.data?.find((i) => i.symbol === symbol));
  // Connected orders wait for instrument specs (lot limits); if they can't load, the safe defaults and server checks apply.
  const specReady = practice || stocks.isSuccess || stocks.isError;

  // Checks everything that doesn't need the network; returns an error message or null.
  function check(request: TradeRequest): string | null {
    if (!specReady) return "Loading instrument details…";
    if (!policy.canPlaceSymbol(request.symbol)) return policy.reason ?? `Trading in ${request.symbol} is paused.`;
    const volumeIssue = validateVolume(request.lotSize, spec(request.symbol));
    if (volumeIssue) return volumeIssue;
    const quote = executableQuote(request.symbol);
    if (!isQuoteExecutable(quote)) return "Waiting for a fresh quote. Try again in a moment.";
    return validateTrade(request, quote!);
  }

  async function submit(request: TradeRequest): Promise<SubmitResult> {
    const generation = useAccountStore.getState().generation;
    const flow = useOrderFlow.getState();
    if (flow.verifying) return { ok: false, error: "Still confirming your previous order. Check Positions before placing another." };
    // Swallows double-clicks and key repeats (the same order again within 500 ms) without delaying a different, deliberate order.
    const key = JSON.stringify(request);
    if (flow.inFlight || (key === flow.last.key && Date.now() - flow.last.at < 500)) return { ok: false, error: "" };
    const issue = check(request);
    if (issue) return { ok: false, error: issue };
    setSubmitting(true);
    const ui = useUIStore.getState(), ws = useWorkspaceStore.getState();
    const idempotencyKey = crypto.randomUUID();
    const knownIds = practice ? [] : openOrderIds();
    const startedAt = Date.now();
    const cached=tradingApi.endpoints.getAccountDetails.select(undefined)(store.getState()).data;
    const accountId=(cached?.account ?? cached)?.id ?? useAccountStore.getState().accounts.find(a=>a.id===useAccountStore.getState().activeId)?.tradingAccountId;
    const receipt: Omit<Receipt, "status"> = { request, practice, key:idempotencyKey, startedAt, knownIds, ...(accountId!=null && Number.isFinite(Number(accountId)) && {accountId:Number(accountId)}) };
    flow.set({inFlight:true,receipt:{...receipt,status:'sending'}});
    ui.setBottomTab(receiptDestination({...receipt,status:'sending'}));
    ws.setActivityExpanded(true);
    try {
      if (practice) {
        usePracticeStore.getState().place(request);
        const order = usePracticeStore.getState().account.orders[0];
        ui.setBottomTab(order.status === "OPEN" ? "positions" : "pending");
        flow.set({receipt:{...receipt,id:order.id,status:order.status === "OPEN" ? "open" : "pending"}});
        ws.setActivityExpanded(true);
        const notice=receiptNotification(useOrderFlow.getState().receipt!);
        if(notice)ws.notify(notice.text,notice.kind,notice.options);
        return { ok: true, id: order.id, status: order.status === "OPEN" ? "OPEN" : "PENDING" };
      }
      // The fill (or a venue rejection) arrives on the notification socket; nothing is queued while it is down.
      mobileSocketService.ensureConnected();
      const placed = await placeRemote({ order: request, idempotencyKey }).unwrap();
      if (generation !== useAccountStore.getState().generation) return { ok: false, error: "Account changed. Check the original account for the result." };
      // A-book answers 202 / SENDING: accepted, not filled. The venue can still refuse it.
      const sending = placed?.accepted === true || String(placed?.orderStatus ?? "").toUpperCase() === "SENDING";
      const orderId=placed?.orderId ?? placed?.id;
      flow.set({receipt:{...receipt,status:"submitted",awaitingFill:sending,...(orderId!=null && String(orderId)!=='' && {id:String(orderId)})}});
      const notice=receiptNotification(useOrderFlow.getState().receipt!);
      if(notice)ws.notify(notice.text,notice.kind,notice.options);
      return { ok: true, status: "SUBMITTED" };
    } catch (e) {
      if (generation !== useAccountStore.getState().generation) return { ok: false, error: "Account changed." };
      if (!practice && classifyFailure(e) === "unknown") {
        const v: Verifying = { request, key: idempotencyKey, startedAt, knownIds };
        useOrderFlow.getState().set({ verifying: v, receipt:{...receipt,status:"checking"} });
        void reconcile(v);
        return { ok: false, unknown: true, error: "We couldn't confirm this order yet. Checking your account for it — don't place it again." };
      }
      const message=errorMessage(e, practice ? "Practice order could not be placed." : "Order could not be submitted. No success has been confirmed.");
      flow.set({receipt:{...receipt,status:'rejected',message}});
      return { ok: false, error: message };
    } finally {
      if (generation === useAccountStore.getState().generation) useOrderFlow.getState().set({ inFlight: false, last: { key, at: Date.now() } });
      setSubmitting(false);
    }
  }
  return { submit, check, submitting, canExecute, practice, policy, verifying, spec, specReady };
}
