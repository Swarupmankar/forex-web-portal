"use client";
import { TriangleAlert } from "lucide-react";
import { useExecutionPolicy } from "@/hooks/useExecutionPolicy";
import { useTradingStatus } from "@/store/useTradingStatus";
import { useUIStore } from "@/store/useUIStore";

// Tells connected traders when execution is limited by the server (close-only, halted, unknown),
// and marks non-production deployments so nobody mistakes staging for the live terminal.
export function TradingStatusBanner() {
  const policy = useExecutionPolicy();
  const authenticated = useUIStore((s) => s.isAuthenticated);
  const status = useTradingStatus((s) => s.status);
  const halted = status?.haltedSymbols ?? [];
  const limited = !policy.practice && authenticated && policy.mode !== "enabled" && policy.reason;
  return (
    <>
      {(limited || (!policy.practice && authenticated && halted.length > 0)) && (
        <div className={`trading-status-banner ${policy.mode === "close-only" ? "is-close-only" : ""}`} role="status">
          <TriangleAlert />
          <span>{limited ? policy.reason : `Trading paused for ${halted.join(", ")}. Other instruments are available.`}</span>
        </div>
      )}
    </>
  );
}
