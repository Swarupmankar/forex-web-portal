"use client";
import { useState } from "react";
import { Dialog } from "@/components/terminal/Dialog";
import { usePracticeStore } from "@/store/usePracticeStore";
import { useUIStore } from "@/store/useUIStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

// Practice one-click is a saved preference. Connected one-click needs an explicit
// acknowledgement and is cleared on every account switch (see resetOrderDraft).
export function useOneClick() {
  const practice = usePracticeStore((s) => s.mode === "practice");
  const practiceOn = useWorkspaceStore((s) => s.oneClickPractice);
  const connectedOn = useUIStore((s) => s.oneClickTrading);
  const [asking, setAsking] = useState(false);
  const on = practice ? practiceOn : connectedOn;
  function set(next: boolean) {
    if (practice) useWorkspaceStore.getState().setOneClickPractice(next);
    else if (!next) useUIStore.getState().setOneClickTrading(false);
    else setAsking(true);
  }
  const dialog = asking ? (
    <Dialog title="Enable one-click trading" onClose={() => setAsking(false)}>
      <p className="muted">Buy and Sell will send orders to your connected account immediately, without a review step. Closing a position from Activity or the chart will also happen immediately.</p>
      <p className="notice-note">Real funds may be at risk. One-click turns off when you switch or reconnect an account.</p>
      <button className="button button-primary full-width" onClick={() => { useUIStore.getState().setOneClickTrading(true); setAsking(false); }}>I understand, enable one-click</button>
      <button className="text-button full-width" onClick={() => setAsking(false)}>Keep reviewing orders</button>
    </Dialog>
  ) : null;
  return { on, set, dialog, practice };
}
