import { create } from "zustand";
import type { TradeRequest } from "@/lib/contracts";
export type Verifying = { request: TradeRequest; key: string; startedAt: number; knownIds: string[] };
type State = {
  // Module-wide in-flight lock shared by the ticket and chart, so two panels can't send at once.
  inFlight: boolean;
  last: { key: string; at: number };
  // An order whose outcome is unknown (timeout / lost response). No new order may be sent while set.
  verifying?: Verifying;
  set: (patch: Partial<Omit<State, "set">>) => void;
};
export const useOrderFlow = create<State>((set) => ({
  inFlight: false,
  last: { key: "", at: 0 },
  set: (patch) => set(patch),
}));
