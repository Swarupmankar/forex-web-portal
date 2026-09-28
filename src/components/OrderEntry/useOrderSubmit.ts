"use client";
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
import { volumeSpec, validateVolume, needsReview } from "@/lib/volume";
import { classifyFailure, findSubmittedOrder } from "@/lib/orderOutcome";
import { executableQuote } from "@/hooks/useExecutableQuote";
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
      const found = findSubmittedOrder(v.request, v.knownIds, [...(data.openOrders ?? []), ...(data.pendingOrders ?? [])], v.startedAt);
      if (found) {
        flow.set({ verifying: undefined });
        notify(`${describe(v.request)} confirmed · order #${found.id}.`, "success");
        return;
      }
    } catch {
      // Keep checking until the window ends.
    } finally {
      sub.unsubscribe();
    }
  }
  if (useOrderFlow.getState().verifying?.key !== v.key) return;
  flow.set({ verifying: undefined });
  notify(`We couldn't find ${describe(v.request)} on your account after 30 seconds. It's safe to try again; if it appears in Positions later, it was filled.`, "error");
}

// One submission path for the order ticket and chart console, so both obey the same one-click
// policy, volume limits, executable quote, kill switch, duplicate guard and idempotency rules.
export function useOrderSubmit() {
  const policy = useExecutionPolicy();
  const { practice } = policy;
  const oneClickPractice = useWorkspaceStore((s) => s.oneClickPractice);
  const oneClickConnected = useUIStore((s) => s.oneClickTrading);
  const authenticated = useUIStore((s) => s.isAuthenticated);
  const stocks = useGetAllStocksQuery(undefined, { skip: practice || !authenticated });
  const verifying = useOrderFlow((s) => s.verifying);
  const [placeRemote] = usePlaceOrderMutation();
  const [submitting, setSubmitting] = useState(false);
  const canExecute = policy.canPlace;
  const spec = (symbol: string) => volumeSpec(practice, stocks.data?.find((i) => i.symbol === symbol));
  // Connected orders wait for instrument specs (lot limits); if they can't load, the safe defaults and server checks apply.
  const specReady = practice || stocks.isSuccess || stocks.isError;
  // Orders skip the review dialog only when one-click is on for this account type and the order isn't unusually large.
  const oneClick = canExecute && (practice ? oneClickPractice : oneClickConnected);
  const instantFor = (lots: number) => oneClick && !needsReview(lots);

  // Checks everything that doesn't need the network; returns an error message or null.
  function check(request: TradeRequest): string | null {
    if (!specReady) return "Loading instrument details…";
    if (!policy.canPlaceSymbol(request.symbol)) return policy.reason ?? `Trading in ${request.symbol} is paused.`;
    const volumeIssue = validateVolume(request.lotSize, spec(request.symbol));
    if (volumeIssue) return volumeIssue;
    const quote = executableQuote(request.symbol);
    if (!isQuoteExecutable(quote)) return "Waiting for a fresh quote. Try again in a moment.";
    return validateTrade(request, request.orderType === "BUY" ? quote!.ask : quote!.bid);
  }

  async function submit(request: TradeRequest): Promise<SubmitResult> {
    const flow = useOrderFlow.getState();
    if (flow.verifying) return { ok: false, error: "Still confirming your previous order. Check Positions before placing another." };
    // Swallows double-clicks and key repeats (the same order again within 500 ms) without delaying a different, deliberate order.
    const key = JSON.stringify(request);
    if (flow.inFlight || (key === flow.last.key && Date.now() - flow.last.at < 500)) return { ok: false, error: "" };
    const issue = check(request);
    if (issue) return { ok: false, error: issue };
    flow.set({ inFlight: true });
    setSubmitting(true);
    const ui = useUIStore.getState(), ws = useWorkspaceStore.getState();
    const idempotencyKey = crypto.randomUUID();
    const knownIds = practice ? [] : openOrderIds();
    const startedAt = Date.now();
    try {
      if (practice) {
        usePracticeStore.getState().place(request);
        const order = usePracticeStore.getState().account.orders[0];
        ui.setBottomTab(order.status === "OPEN" ? "positions" : "pending");
        ws.notify(`${describe(request)} · ${order.status === "OPEN" ? "opened" : "pending order placed"} (practice)`, "success");
        return { ok: true, id: order.id, status: order.status === "OPEN" ? "OPEN" : "PENDING" };
      }
      await placeRemote({ order: request, idempotencyKey }).unwrap();
      ui.setBottomTab(request.executionType === "MARKET" ? "positions" : "pending");
      ws.notify(`${describe(request)} submitted. Check Activity for its execution status.`, "info");
      return { ok: true, status: "SUBMITTED" };
    } catch (e) {
      if (!practice && classifyFailure(e) === "unknown") {
        const v: Verifying = { request, key: idempotencyKey, startedAt, knownIds };
        useOrderFlow.getState().set({ verifying: v });
        void reconcile(v);
        return { ok: false, unknown: true, error: "We couldn't confirm this order yet. Checking your account for it — don't place it again." };
      }
      return { ok: false, error: errorMessage(e, practice ? "Practice order could not be placed." : "Order could not be submitted. No success has been confirmed.") };
    } finally {
      useOrderFlow.getState().set({ inFlight: false, last: { key, at: Date.now() } });
      setSubmitting(false);
    }
  }
  return { submit, check, submitting, instantFor, oneClick, canExecute, practice, policy, verifying, spec, specReady };
}
