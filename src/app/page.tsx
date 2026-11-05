"use client";
import { useSessionServices } from "@/store/useSessionServices";
import { AccountSummaryBar } from "@/components/terminal/AccountSummaryBar";
import { ActivityDivider } from "@/components/terminal/ActivityDivider";
import { useTicketVisibility } from '@/hooks/useTicketVisibility';
import { OrderReceiptTracker } from "@/components/terminal/OrderReceipt";
import { InstrumentPicker } from "@/components/terminal/InstrumentPicker";
import { useEffect, useRef, type CSSProperties } from "react";
import { PanelRightClose } from 'lucide-react';
import { Header } from "@/components/Header/Header";
import { MarketWatch } from "@/components/MarketWatch/MarketWatch";
import { TradingChart } from "@/components/Chart/TradingChart";
import { PositionsTable } from "@/components/PositionsTable/PositionsTable";
import { TradingTicket } from "@/components/terminal/TradeManagementTicket";
import {useTradeManagement} from '@/store/useTradeManagement';
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
import { mobileSocketService } from "@/services/mobileSocket";
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
// The page subscribes only to layout state; ticks and account figures re-render the components that show them.
export default function TerminalPage() {
  const generation = useAccountStore(s => s.generation);
  const practice = usePracticeStore(s => s.mode === "practice");
  const access = useUIStore(s => s.access);
  const symbol = useUIStore(s => s.activeSymbol);
  const panel = useWorkspaceStore(s => s.panel);
  const tab = useUIStore(s => s.bottomTab);
  const activityHeight = useWorkspaceStore(s => s.activityHeight);
  const activityExpanded = useWorkspaceStore(s => s.activityExpanded);
  const activityOnly = useWorkspaceStore(s => s.activityMaximized);
  const marketsOpen = useWorkspaceStore(s => s.marketsOpen);
  const {visible: ticketOpen, compact} = useTicketVisibility();
  const draftVersion = useUIStore(s => s.orderDraftVersion);
  const managementKey=useTradeManagement(s=>s.selection?.key);
  const density = useWorkspaceStore(s => s.density);
  const focus = useWorkspaceStore(s => s.focusChart);
  const alerts = useWorkspaceStore(s => s.alerts);
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    // Small windows stack the same panels; actions reveal their target without replacing the page.
    if (!window.matchMedia('(max-width: 759px)').matches || panel === 'trade') return;
    const target = panel === 'activity' ? 'workspace-activity' : panel === 'chart' ? 'workspace-chart' : 'workspace-watchlist';
    const frame = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [panel, tab, draftVersion, managementKey, ticketOpen, activityExpanded, marketsOpen]);
  useEffect(() => {
    // A portal Trade link or saved session; otherwise show the account-entry screen.
    void startTerminalSession();
  }, []);
  useEffect(() => {
    if (practice || access !== "granted") return;
    // Order fills and venue rejections arrive here; it is opened before any order can be placed.
    let cancelled = false;
    const connect = async () => {
      if (await useSessionServices.getState().load() && !cancelled) {
        mobileSocketService.start();
        initPriceSocket();
      }
    };
    void connect();
    const retry = window.setInterval(() => {
      const service = useSessionServices.getState();
      if (!service.binding && !service.loading) void connect();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(retry);
      useSessionServices.getState().clear();
      mobileSocketService.stop();
      stopPriceSocket();
    };
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
    <div data-density={density} className={`terminal-app terminal-desktop terminal-single-page ${focus ? 'desktop-chart-focused' : ''}`}>
      <AccountHeader />
      <TradingStatusBanner />
      <OrderReceiptTracker/>
      <main key={`${practice}:${generation}`} className="unified-workspace" data-activity-only={activityOnly} data-ticket-open={ticketOpen} data-markets-open={marketsOpen} data-activity-expanded={activityExpanded} style={{ '--activity-height': `${activityHeight}px` } as CSSProperties} aria-label="Trading workspace">
        <section id="workspace-watchlist" className="workspace-watchlist" aria-label="Watchlist" hidden={!marketsOpen || activityOnly}>
          <PanelBoundary name="watchlist" className="markets-panel" resetKey={resetKey}><MarketWatch /></PanelBoundary>
        </section>
        <section id="workspace-chart" className="workspace-chart" aria-label="Price chart" hidden={activityOnly}>
          <PanelBoundary name="chart" className="chart-panel" resetKey={resetKey}><TradingChart /></PanelBoundary>
        </section>
        {/* Keep the ticket mounted while tucked away: drafts, confirmations and reconciliation stay alive. */}
        <section id="workspace-ticket" className="workspace-ticket" data-floating={compact} aria-label="Order ticket" hidden={!ticketOpen || activityOnly}>
          <div className="ticket-visibility-control"><button className="text-button" onClick={() => { useWorkspaceStore.getState().closeOrderTicket(); document.querySelector<HTMLButtonElement>('.workspace-ticket-toggle')?.focus(); }}><PanelRightClose />Hide ticket</button></div>
          <PanelBoundary name="order ticket" className="order-panel" resetKey={resetKey}><TradingTicket /></PanelBoundary>
        </section>
        <ActivityDivider />
        <section id="workspace-activity" className="workspace-activity" aria-label="Positions and history">
          <PanelBoundary name="activity panel" className="activity-panel" resetKey={resetKey}><PositionsTable docked /></PanelBoundary>
        </section>
      </main>
      <AccountSummaryBar />
      <FooterBar />
      <PracticeSession />
      <WorkspaceTools />
      <InstrumentPicker />
      <DepositModal />
    </div>
  );
}
