"use client";
import { useEffect } from "react";
import { usePracticeStore } from "@/store/usePracticeStore";
import { useAccountStore } from "@/store/useAccountStore";
import { useUIStore } from "@/store/useUIStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { clearTradingWorkspace } from "@/lib/accountSwitching";

export const INACTIVITY_LOCK_MS = 15 * 60 * 1000;
const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

// Ends a real-money session after 15 minutes without input. Balances and positions disappear
// with the session, one-click consent is revoked, and continuing needs the trading password.
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
      const account = accounts.accounts.find((a) => a.id === accounts.activeId);
      if (!account) return;
      clearTradingWorkspace();
      accounts.expire(account.id);
      useUIStore.setState({ isAuthenticated: false, tradingAccountNo: "" });
      useUIStore.getState().openReconnect(account);
      useWorkspaceStore.getState().notify("Locked after 15 minutes of inactivity. Enter your trading password to continue.", "info", { sticky: true });
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
