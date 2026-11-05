"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/terminal/Dialog";
import { usePracticeStore } from "@/store/usePracticeStore";
import { useUIStore } from "@/store/useUIStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useAccountStore } from '@/store/useAccountStore';

// Practice one-click is a saved preference. Connected one-click needs an explicit
// acknowledgement and is cleared on every account switch (see resetOrderDraft).
export function useOneClick(kind: 'orders' | 'close' = 'orders') {
  const practice = usePracticeStore((s) => s.mode === "practice");
  const practiceOn = useWorkspaceStore((s) => kind === 'orders' ? s.oneClickPractice : s.oneClickClosePractice);
  const connectedOn = useUIStore((s) => kind === 'orders' ? s.oneClickTrading : s.oneClickClose);
  const generation = useAccountStore(s => s.generation);
  const [asking, setAsking] = useState(false);
  useEffect(() => setAsking(false), [generation, practice]);
  const on = practice ? practiceOn : connectedOn;
  function set(next: boolean) {
    if (practice) (kind === 'orders' ? useWorkspaceStore.getState().setOneClickPractice : useWorkspaceStore.getState().setOneClickClosePractice)(next);
    else if (!next) (kind === 'orders' ? useUIStore.getState().setOneClickTrading : useUIStore.getState().setOneClickClose)(false);
    else setAsking(true);
  }
  const dialog = asking ? (
    <Dialog title={kind === 'orders' ? 'Enable one-tap trading' : 'Enable one-tap close'} onClose={() => setAsking(false)}>
      <p className="muted">{kind === 'orders' ? 'The chart’s Buy and Sell buttons will immediately send a market order at the displayed lot size, without SL/TP. Use the ticket for protected or pending orders. Large volumes still open the ticket for review.' : 'Close and Cancel will immediately send a full-position close or pending-order cancellation. Use Reduce for a partial close. Bulk actions still ask for confirmation.'}</p>
      <p className="notice-note">Applies to this account. Turns off when you switch or reconnect an account.</p>
      <button className="button button-primary full-width" onClick={() => { if (generation === useAccountStore.getState().generation) (kind === 'orders' ? useUIStore.getState().setOneClickTrading : useUIStore.getState().setOneClickClose)(true); setAsking(false); }}>Enable {kind === 'orders' ? 'one-tap trading' : 'one-tap close'}</button>
      <button className="text-button full-width" onClick={() => setAsking(false)}>Keep confirmation</button>
    </Dialog>
  ) : null;
  return { on, set, dialog, practice };
}
