"use client";
import { useEffect } from "react";
import { Header } from "@/components/Header/Header";
import { MarketWatch } from "@/components/MarketWatch/MarketWatch";
import { TradingChart } from "@/components/Chart/TradingChart";
import { PositionsTable } from "@/components/PositionsTable/PositionsTable";
import { OrderEntry } from "@/components/OrderEntry/OrderEntry";
import { FooterBar } from "@/components/Footer/FooterBar";
import { DepositModal } from "@/components/DepositModal/DepositModal";
import { WorkspaceTools } from "@/components/terminal/WorkspaceTools";
import { PanelBoundary } from "@/components/terminal/PanelBoundary";
import { TradingStatusBanner } from "@/components/terminal/TradingStatusBanner";
import {
  initPriceSocket,
  stopPriceSocket,
  subscribeSymbol,
  unsubscribeSymbol,
} from "@/services/priceSocket";
import { useUIStore } from "@/store/useUIStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { usePracticeStore } from "@/store/usePracticeStore";
import { PracticeSession } from "@/components/terminal/PracticeSession";
import { useAccountStore } from '@/store/useAccountStore';
import { useAccountMetrics } from "@/hooks/useAccountMetrics";
import { useTradingStatusPolling } from "@/hooks/useExecutionPolicy";
import { useInactivityLock } from "@/hooks/useInactivityLock";
import { startTerminalSession } from "@/lib/portalHandoff";
import { SessionGate } from "@/components/terminal/SessionGate";

function AccountHeader() {
  const m = useAccountMetrics();
  return <Header balance={m.balance} equity={m.equity} freeMargin={m.freeMargin} loading={m.loading} error={m.error} onRefresh={m.refetch} />;
}
function AccountFooter() {
  // The footer instance also keeps the saved account details in sync with the server.
  const m = useAccountMetrics({ syncAccount: true });
  return <FooterBar balance={m.balance} equity={m.equity} margin={m.margin} freeMargin={m.freeMargin} marginLevel={m.marginLevel} />;
}

// The page subscribes only to layout state; ticks and account figures re-render the components that show them.
export default function TerminalPage() {
  const generation = useAccountStore(s => s.generation);
  const practice = usePracticeStore(s => s.mode === "practice");
  const access = useUIStore(s => s.access);
  const symbol = useUIStore(s => s.activeSymbol);
  const panel = useWorkspaceStore((s) => s.panel),
    focus = useWorkspaceStore((s) => s.focusChart),
    activityExpanded = useWorkspaceStore(s => s.activityExpanded),
    alerts = useWorkspaceStore((s) => s.alerts);
  useEffect(() => {
    // A portal Trade link, or this tab's saved session; with neither, back to the portal login.
    void startTerminalSession();
  }, []);
  useEffect(() => {
    if (practice || access !== "granted") return;
    initPriceSocket();
    return stopPriceSocket;
  }, [practice, generation, access]);
  useTradingStatusPolling(true);
  useInactivityLock();
  const alertSymbols = Array.from(
    new Set(alerts.filter((a) => !practice && !a.triggeredAt && a.mode !== "practice").map((a) => a.symbol)),
  )
    .sort()
    .join(",");
  useEffect(() => {
    const symbols = alertSymbols.split(",").filter(Boolean);
    symbols.forEach(subscribeSymbol);
    return () => symbols.forEach(unsubscribeSymbol);
  }, [alertSymbols]);
  const resetKey = `${practice}:${generation}:${symbol}`;
  if (access !== "granted") return <SessionGate />;
  return (
    <div
      className={`terminal-app ${focus ? "chart-focused" : ""} ${activityExpanded ? "activity-expanded" : "activity-collapsed"}`}
      data-panel={panel}
    >
      <AccountHeader />
      <TradingStatusBanner />
      <main key={`${practice}:${generation}`} className="terminal-workspace" aria-label="Trading workspace">
        <PanelBoundary name="watchlist" className="markets-panel" resetKey={resetKey}><MarketWatch /></PanelBoundary>
        <PanelBoundary name="chart" className="chart-panel" resetKey={resetKey}><TradingChart /></PanelBoundary>
        <PanelBoundary name="order ticket" className="order-panel" resetKey={resetKey}><OrderEntry /></PanelBoundary>
        <PanelBoundary name="activity panel" className="activity-panel" resetKey={resetKey}><PositionsTable /></PanelBoundary>
      </main>
      <AccountFooter />
      <PracticeSession />
      <WorkspaceTools />
      <DepositModal />
    </div>
  );
}
