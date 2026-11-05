import { advanceReceipt, type Receipt, type ReceiptEvent } from '@/lib/orderReceipt';
import { create } from "zustand";
import type { TradeRequest } from "@/lib/contracts";
export type Verifying = { request: TradeRequest; key: string; startedAt: number; knownIds: string[] };
type State = {
  receipt?: Receipt;
  // Module-wide in-flight lock shared by the ticket and chart, so two panels can't send at once.
  inFlight: boolean;
  last: { key: string; at: number };
  // An order whose outcome is unknown (timeout / lost response). No new order may be sent while set.
  verifying?: Verifying;
  events: ReceiptEvent[];
  receive: (event: ReceiptEvent) => void;
  set: (patch: Partial<Omit<State, "set" | "receive">>) => void;
};
export const useOrderFlow = create<State>((set) => ({
  inFlight: false,
  last: { key: "", at: 0 },
  events:[],
  receive: event => set(state=>{
    if(!state.receipt || state.receipt.practice || state.receipt.accountId!==event.tradingAccountId)return {};
    const events=[...state.events,event].slice(-20);
    const receipt=advanceReceipt(state.receipt,state.receipt,events);
    return {events,receipt,...(['open','pending','rejected'].includes(receipt.status) && {verifying:undefined})};
  }),
  set: patch => set(state=>{
    const events='receipt' in patch && patch.receipt?.key!==state.receipt?.key ? [] : state.events;
    const receipt=patch.receipt ? advanceReceipt(state.receipt,patch.receipt,events) : patch.receipt;
    return {...patch,events,...('receipt' in patch && {receipt}),...(receipt && ['open','pending','rejected'].includes(receipt.status) && {verifying:undefined})};
  }),
}));
