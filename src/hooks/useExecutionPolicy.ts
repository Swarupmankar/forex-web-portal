"use client";
import { useEffect } from "react";
import { DEVELOPMENT_FEED, PREVIEW_FEED } from "@/lib/market";
import { usePracticeStore } from "@/store/usePracticeStore";
import { useTradingStatus } from "@/store/useTradingStatus";
import { useUIStore } from "@/store/useUIStore";

export type ExecutionPolicy = {
  practice: boolean;
  // New orders can be sent for this account (symbol-level halts are checked by canPlaceSymbol).
  canPlace: boolean;
  // Positions can be closed, cancelled or have their SL/TP edited (also allowed in close-only).
  canManage: boolean;
  canPlaceSymbol: (symbol: string) => boolean;
  // Why execution is limited, for banners and disabled buttons; undefined when fully available.
  reason?: string;
  mode?: "enabled" | "close-only" | "halted";
};

// Practice never depends on the server. Connected execution needs a trading session, a real feed
// and the runtime status endpoint saying so; if that endpoint can't be read, it fails closed.
export function useExecutionPolicy(): ExecutionPolicy {
  const practice = usePracticeStore((s) => s.mode === "practice");
  const authenticated = useUIStore((s) => s.isAuthenticated);
  const status = useTradingStatus((s) => s.status);
  const statusError = useTradingStatus((s) => s.error);
  if (practice) return { practice, canPlace: true, canManage: true, canPlaceSymbol: () => true };
  const mode = statusError ? undefined : status?.mode;
  const reason = !authenticated ? "Connect a trading account to trade."
    : PREVIEW_FEED || DEVELOPMENT_FEED ? "Trading is unavailable on the development price feed."
    : statusError ? "Trading status is unavailable. Orders are paused until it's confirmed."
    : !mode ? "Checking trading availability…"
    : mode === "halted" ? "Trading is temporarily unavailable. Your account remains accessible."
    : mode === "close-only" ? "Close-only mode: you can close or reduce positions; new orders are paused."
    : undefined;
  const base = authenticated && !PREVIEW_FEED && !DEVELOPMENT_FEED && !!mode;
  const canPlace = base && mode === "enabled";
  const halted = new Set(status?.haltedSymbols ?? []);
  return {
    practice,
    canPlace,
    canManage: base && mode !== "halted",
    canPlaceSymbol: (symbol) => canPlace && !halted.has(symbol),
    reason,
    mode,
  };
}

// Mounted once by the page: polls the kill switch every 30 s and when the tab regains focus.
export function useTradingStatusPolling(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const refresh = useTradingStatus.getState().refresh;
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [enabled]);
}
