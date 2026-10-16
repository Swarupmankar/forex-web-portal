"use client";
import { useEffect } from "react";
import { usePracticeStore } from "@/store/usePracticeStore";
import { useAccountStore } from "@/store/useAccountStore";
import { useUIStore } from "@/store/useUIStore";
import { clearTradingWorkspace } from "@/lib/accountSwitching";

export const INACTIVITY_LOCK_MS = 15 * 60 * 1000;
const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

// Ends real-money sessions after 15 minutes without input. Balances and positions disappear
// with the session, one-click consent is revoked, and continuing needs the client portal.
export function useInactivityLock() {
  const practice = usePracticeStore((s) => s.mode === "practice");
  const activeId = useAccountStore((s) => s.activeId);
  const kind = useAccountStore((s) => s.accounts.find((a) => a.id === s.activeId)?.kind);
  const guarded = !practice && !!activeId && kind !== "demo";
  useEffect(() => {
    if (!guarded) return;
    let last = Date.now();
    const touch = () => { last = Date.now(); };
    const check = () => {
      if (Date.now() - last < INACTIVITY_LOCK_MS) return;
      const accounts = useAccountStore.getState();
      if (!accounts.accounts.some((a) => a.id === accounts.activeId)) return;
      clearTradingWorkspace();
      // Every real account locks, so none can be resumed from the session-ended screen.
      accounts.accounts.filter((a) => a.kind !== "demo" && !a.expired).forEach((a) => accounts.expire(a.id));
      if (accounts.activeId) accounts.expire(accounts.activeId);
      useUIStore.setState({ isAuthenticated: false, tradingAccountNo: "", oneClickTrading: false });
      useUIStore.getState().endSession("Locked after 15 minutes of inactivity. Open your account again from the client portal to continue.");
    };
    ACTIVITY.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(check, 15000);
    // Timers are throttled in background tabs, so also check the moment the tab comes back.
    document.addEventListener("visibilitychange", check);
    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [guarded, activeId]);
}
