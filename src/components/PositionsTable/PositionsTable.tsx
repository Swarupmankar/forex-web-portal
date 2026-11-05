"use client";
import { composeOrder, viewInstrument, openActivityView } from '@/lib/tradingWorkflow';
import { activityRecords, activitySummary } from "@/lib/activityRecords";
import type { ActivitySort, ActivityStatus } from "@/lib/workspaceLayout";
import { useMarketDisplay } from '@/hooks/useMarketDisplay';
import { useAccountStore } from "@/store/useAccountStore";
import { useOrderFlow } from "@/store/useOrderFlow";
import { historyRows, orderEntry, totalProfit } from "@/lib/connectedOrders";
import {openTradeManagement} from "@/lib/openTradeManagement";
import {activityBuckets,awaitingMarketFill,managementProgressLabel} from '@/lib/tradeExperience';
import {useQuickTradeActions} from '@/hooks/useQuickTradeActions';
import {useOneClick} from '@/components/OrderEntry/useOneClick';
import {useTradeManagement} from "@/store/useTradeManagement";
import {isQuoteExecutable} from '@/lib/freshness';
import {managementPending,prepareManagement,type ManagementResult} from "@/lib/tradeManagement";
import {store} from '@/store';
import { InstrumentIcon } from "@/components/terminal/InstrumentIcon";
import { PORTAL_SIGN_IN } from "@/lib/portalHandoff";
import { useEffect, useRef, useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  Bell,
  Download,
  FolderOpen,
  Plus,
  RefreshCw,
  Trash2,
  ArrowUpRight,
  SlidersHorizontal,
  X,
  ListX,
  Maximize2,
  Minimize2,
  ChartCandlestick,
  Info,
  Search,
  Zap,
  LoaderCircle,
  Clock3,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { usePriceStore } from "@/store/usePriceStore";
import {
  useGetOpenOrdersQuery,
  useExitOrderMutation,
  useModifyOrderMutation,
  tradingApi,
} from "@/store/api/tradingApi";
import { errorMessage } from "@/lib/market";
import { classifyFailure } from "@/lib/orderOutcome";
import { useExecutionPolicy } from "@/hooks/useExecutionPolicy";
import { executableQuote } from "@/hooks/useExecutableQuote";
import { Dialog } from "@/components/terminal/Dialog";
import type { Order } from "@/types/trading";
import { usePracticeStore } from "@/store/usePracticeStore";
import { practicePnl, practiceHistory, type BulkClose } from "@/lib/practice";
import { useTradingAccountId } from "@/hooks/useTradingAccountId";
import { useTradeHistory } from "@/hooks/useTradeHistory";
import { TradeDetails } from "@/components/terminal/TradeDetails";
import { runningPnl, ownOrders, withInstrument } from "@/lib/positionPnl";
const money = (n: unknown, signed = false) => {
  if (n === undefined || n === null || n === "" || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  return `${signed && v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const when = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString(undefined, today ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
const pnlOf = (o: Order) => o.pnl == null && o.profit == null ? NaN : Number(o.pnl ?? o.profit);
const lotsOf = (o: Order) => Number(o.lotSize ?? o.volume);
const PERIODS = { today: "Today", "7d": "7 days", "30d": "30 days", all: "All time" } as const;
type Period = keyof typeof PERIODS;
function inPeriod(iso: string | undefined, period: Period) {
  if (period === "all") return true;
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return false;
  if (period === "today") return new Date(t).toDateString() === new Date().toDateString();
  return Date.now() - t <= (period === "7d" ? 7 : 30) * 86400000;
}
type Action = { type: "bulk"; which: BulkClose };
export function PositionsTable({ standalone = false, docked = false }: { standalone?: boolean; docked?: boolean }) {
  const { formatPrice, instrument } = useMarketDisplay();
  const accountId = useTradingAccountId();
  const [detail, setDetail] = useState<Order | null>(null);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<ActivitySort>("newest");
  const [status, setStatus] = useState<ActivityStatus>("all");
  const practice=usePracticeStore(s=>s.mode === "practice");
  const demo=usePracticeStore(s=>s.account);
  const quotes=usePracticeStore(s=>s.quotes);
  const livePrices = usePriceStore((s) => s.prices);
  const u = useUIStore(),
    w = useWorkspaceStore();
  // Polling is owned by the page; this subscription only reads the shared cache.
  const orders = useGetOpenOrdersQuery(undefined, {
      skip: practice || !u.isAuthenticated,
    });
  const history = useTradeHistory(!practice && u.isAuthenticated && u.bottomTab === 'history', orders.currentData);
  const ownOpen = ownOrders(orders.currentData?.openOrders ?? [], accountId);
  const ownPending = ownOrders(orders.currentData?.pendingOrders ?? [], accountId);
  const activity=activityBuckets(ownOpen,ownPending);
  const quick=useQuickTradeActions(),oneTapClose=useOneClick('close');
  const managementResults=useTradeManagement(s=>s.results);
  const requestInFlight=useOrderFlow(s=>s.inFlight||!!s.verifying);
  const [exit, { isLoading: exiting }] = useExitOrderMutation(),
    [modify, { isLoading: modifying }] = useModifyOrderMutation();
  const [action, setAction] = useState<Action | null>(null),
    [error, setError] = useState(""),
    [bulkBusy, setBulkBusy] = useState(false),
    [bulkMenu, setBulkMenu] = useState(false),
    [symbolOnly, setSymbolOnly] = useState(false),
    [period, setPeriod] = useState<Period>("all");
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bulkMenu) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setBulkMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [bulkMenu]);
  const policy = useExecutionPolicy();
  const generation = useAccountStore(s => s.generation);
  // Close-only mode still allows closing, cancelling and editing exits.
  const canManage = policy.canManage;
  function inspectTrade(order:Order){setDetail(order);}
  const tab = u.bottomTab;
  useEffect(()=>setDetail(null),[tab]);
  const demoRows = tab === 'positions' ? demo.orders.filter(o => o.status === 'OPEN') : tab === 'pending' ? demo.orders.filter(o => o.status === 'PENDING') : practiceHistory(demo.orders);
  const demoRecords: Order[] = demoRows.map(o=>({...o,orderType:o.status === "PENDING" ? `${o.orderType} ${o.executionType}` : o.orderType,pnl:practicePnl(o,quotes[o.symbol]),orderStatus:o.reason || o.status,closedAt:o.closedAt}));
  const allRecords: Order[] = practice ? demoRecords :
    tab === "positions"
      ? activity.positions.map((o) => ({ ...o, pnl: awaitingMarketFill(o)?NaN:runningPnl(withInstrument(o, instrument(o.symbol)), livePrices) }))
      : tab === "pending"
        ? activity.pending
        : ownOrders(historyRows(history.currentData), accountId);
  const records = activityRecords(allRecords.filter(o => (!symbolOnly || o.symbol === u.activeSymbol) && (tab !== "history" || inPeriod(o.closedAt ?? o.createdAt, period))), query, status, sort, tab === "history");
  const totals = activitySummary(records);
  const inspected=detail ? allRecords.find(o=>(o.exitRowId??String(o.id))===(detail.exitRowId??String(detail.id))) : undefined;
  const inspectedOrder=inspected ?? detail;
  const inspectable=!!inspected && tab!=='history' && ['OPEN','PENDING'].includes(String(inspected.orderStatus??inspected.status));
  const fetching = tab === "history" ? history : orders;
  useEffect(()=>{
    // A filled pending order or a closed position leaves this list; don't leave an OPEN inspector behind.
    if(detail && !inspected && tab!=='history' && (practice || orders.isSuccess) && !orders.isFetching)setDetail(null);
  },[detail,!!inspected,tab,practice,orders.isSuccess,orders.isFetching]);
  const busy = exiting || modifying || bulkBusy;
  const activeAlerts = w.alerts.filter(a => (a.mode || "connected") === (practice ? "practice" : "connected"));
  const totalPnl = totalProfit(records.filter(o=>!awaitingMarketFill(o)));
  const currency = "USD";
  function currentPrice(o: Order) {
    // livePrices/quotes are subscribed above so rows re-render per tick; the value uses the account's executable quote.
    const q = practice ? quotes[o.symbol] : livePrices[o.symbol] && executableQuote(o.symbol);
    const buy = String(o.orderType).startsWith("BUY");
    // Open positions close at the opposite side; pending orders trigger on their own side.
    if (q) return tab === "pending" ? (buy ? q.ask : q.bid) : buy ? q.bid : q.ask;
    return Number(o.currentPrice) || undefined;
  }
  function exportHistory() {
    const rows = [
      ["Order ID", "Exit ID", "Instrument", "Side", "Lots", "Entry", "Exit", "Gross PnL (USD)", "Swap (USD)", "Entry commission (USD, whole order)", "Status", "Close reason", "Opened", "Closed"],
      ...records.map((o) => [
        o.id,
        o.exitRowId,
        o.symbol,
        o.orderType,
        o.lotSize ?? o.volume,
        orderEntry(o),
        o.orderDetails?.exitPrice ?? (o as Order & { exitPrice?: number }).exitPrice,
        o.pnl ?? o.profit,
        o.swap,
        o.commission,
        o.orderStatus ?? o.status,
        o.closeReason,
        o.createdAt,
        o.closedAt,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = practice ? "movement-markets-practice-history.csv" : "movement-markets-trade-history.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function closeOrder(order: Order, type: "close" | "cancel", lots?: number, quiet = false) {
    if(managementPending(useTradeManagement.getState().results[String(order.id)]))throw new Error("This trade has an unresolved management request. Check its status first.");
    if (practice) {
      const id = String(order.id);
      if (type === "cancel") usePracticeStore.getState().manage(id, "cancel");
      else if (lots !== undefined && lots < lotsOf(order)) usePracticeStore.getState().closeVolume(id, lots);
      else usePracticeStore.getState().manage(id, "close");
      w.notify(type === "cancel" ? `Order #${id} cancelled.` : lots !== undefined && lots < lotsOf(order) ? `Closed ${lots} of ${lotsOf(order)} lots · #${id}.` : `Position #${id} closed. Virtual balance updated.`);
      return;
    }
    if (generation !== useAccountStore.getState().generation) throw new Error("Account changed; remaining requests were stopped.");
    const idempotencyKey = crypto.randomUUID();
    const list=tradingApi.endpoints.getOpenOrders.select()(store.getState()).data;
    const current=ownOrders([...(list?.openOrders??[]),...(list?.pendingOrders??[])],accountId).find(o=>String(o.id)===String(order.id));
    const prepared=prepareManagement(order,current,type,{lots:String(lots??lotsOf(order)),sl:'',tp:'',entry:''},executableQuote(order.symbol));
    if(!prepared.command)throw new Error(prepared.error);
    const receipt:ManagementResult={key:idempotencyKey,before:current!,command:prepared.command,practice:false,accountId,generation,startedAt:Date.now(),knownExits:historyRows(tradingApi.endpoints.getOrderHistory.select()(store.getState()).data).filter(o=>String(o.id)===String(order.id)).map(o=>o.exitRowId!),status:'sending'};
    useTradeManagement.getState().put(receipt);
    try {
      if (type === "close") {
        const volume = lots ?? lotsOf(order);
        if (!Number.isFinite(volume) || volume <= 0)
          throw new Error("The open volume could not be verified. Refresh before closing.");
        await exit({ orderId: order.id, exitLotSize: volume, idempotencyKey }).unwrap();
      } else await modify({ orderId: order.id, cancelOrder: true, idempotencyKey }).unwrap();
      if(generation===useAccountStore.getState().generation)useTradeManagement.getState().put({...receipt,status:'submitted'});
    } catch (e) {
      if (generation !== useAccountStore.getState().generation) throw e;
      useTradeManagement.getState().put({...receipt,status:classifyFailure(e)==='unknown'?'checking':'rejected',...(classifyFailure(e)!=='unknown'&&{message:errorMessage(e,'The request was rejected.')})});
      if (classifyFailure(e) === "unknown") {
        void orders.refetch();
        throw new Error(`We couldn't confirm the ${type === "close" ? "close" : "cancellation"} of #${order.id}. Check Positions before trying again.`);
      }
      throw e;
    }
    if (!quiet) w.notify("Request accepted. Refreshing the order status.", "info");
  }
  async function runBulk(which: BulkClose) {
    const symbol = symbolOnly ? u.activeSymbol : undefined;
    if (practice) {
      const r = usePracticeStore.getState().closeMany(which, symbol);
      w.notify(r.done ? `${which === "pending" ? "Cancelled" : "Closed"} ${r.done} order${r.done === 1 ? "" : "s"}${r.skipped ? ` · ${r.skipped} waiting for a quote` : ""}.` : "Nothing matched.", r.done ? "success" : "info");
      return;
    }
    // The backend has no batch endpoint: send up to 4 at a time and report every failure with its reason.
    const targets = records.filter(o => ["OPEN", "PENDING"].includes(String(o.orderStatus ?? o.status)) && (which === "pending" || which === "all" || (which === "profitable" ? pnlOf(o) > 0 : pnlOf(o) < 0)));
    const failures: string[] = [];
    let ok = 0, next = 0;
    const worker = async () => {
      while (next < targets.length && generation === useAccountStore.getState().generation) {
        const o = targets[next++];
        try { await closeOrder(o, which === "pending" ? "cancel" : "close", undefined, true); ok++; }
        catch (e) { failures.push(`#${o.id} ${o.symbol}: ${errorMessage(e, "failed")}`); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker));
    if (generation !== useAccountStore.getState().generation) return;
    w.notify(`${ok} of ${targets.length} request${targets.length === 1 ? "" : "s"} accepted.${failures.length ? ` Not done — ${failures.join("; ")}` : ""}`, failures.length ? "error" : "info");
  }
  async function confirm() {
    if(!canManage||!action||busy||useOrderFlow.getState().inFlight||useOrderFlow.getState().verifying)return;
    setError('');setBulkBusy(true);useOrderFlow.getState().set({inFlight:true});
    try{await runBulk(action.which);if(generation===useAccountStore.getState().generation)setAction(null);}
    catch(e){if(generation===useAccountStore.getState().generation)setError(errorMessage(e,'The request was not confirmed.'));}
    finally{if(generation===useAccountStore.getState().generation)useOrderFlow.getState().set({inFlight:false});setBulkBusy(false);}
  }
  const openCount = practice ? demo.orders.filter(o=>o.status==='OPEN').length : activity.positions.length;
  const pendingCount = practice ? demo.orders.filter(o=>o.status==='PENDING').length : activity.pending.length;
  const bulkOptions: [BulkClose, string][] = tab === "pending" ? [["pending", "Cancel all pending"]] : [["all", "Close all positions"], ["profitable", "Close profitable"], ["losing", "Close losing"]];
  const bulkLabel = (which: BulkClose) => bulkOptions.find(b => b[0] === which)?.[1] ?? "";
  return (
    <section className="activity-panel panel">
      <div className="activity-heading">
        {oneTapClose.dialog}
        <div
          className="activity-tabs"
          role="tablist"
          aria-label="Trading activity"
        >
          {(standalone ? tab === "history" ? ["history"] as const : ["positions", "pending", "alerts"] as const : ["positions", "pending", "history", "alerts"] as const).map(
            (t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {u.setBottomTab(t);w.setActivityExpanded(true);setBulkMenu(false);}}
              >
                {t === "positions"
                  ? "Positions"
                  : t === "pending"
                    ? "Pending"
                    : t === "history"
                      ? "History"
                      : "Price alerts"}
                {t !== "history" && (
                  <span className="count">
                    {t === "alerts" ? activeAlerts.length : t === "positions" ? openCount : pendingCount}
                  </span>
                )}
              </button>
            ),
          )}
        </div>
        <div className="activity-actions">
          {(tab==='positions'||tab==='pending')&&<button className="icon-button quick-close-toggle" aria-label={`One-tap close ${oneTapClose.on?'on':'off'}`} aria-pressed={oneTapClose.on} title={`One-tap close ${oneTapClose.on?'on':'off'}`} onClick={()=>oneTapClose.set(!oneTapClose.on)}><Zap/><span>Close {oneTapClose.on?'On':'Off'}</span></button>}
          {tab !== 'alerts' && <button className="icon-button" title="Search and filter activity" aria-label="Search and filter activity" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><Search /></button>}
          {tab !== "alerts" && (
            <label className="activity-filter" title="Show only the instrument on the chart">
              <input type="checkbox" checked={symbolOnly} onChange={e => setSymbolOnly(e.target.checked)} />
              <span>{u.activeSymbol} only</span>
            </label>
          )}
          {tab === "history" && (
            <select className="activity-period" aria-label="History period" value={period} onChange={e => setPeriod(e.target.value as Period)}>
              {(Object.keys(PERIODS) as Period[]).map(p => <option key={p} value={p}>{PERIODS[p]}</option>)}
            </select>
          )}
          {(tab === "positions" || tab === "pending") && canManage && (u.isAuthenticated || practice) && (
            <div className="bulk-menu" ref={menuRef}>
              <button className="icon-button" aria-label="Close or cancel several orders" aria-haspopup="menu" aria-expanded={bulkMenu} title="Bulk actions" disabled={!records.length || busy} onClick={() => setBulkMenu(!bulkMenu)}><ListX /></button>
              {bulkMenu && (
                <div className="bulk-menu-list" role="menu">
                  {bulkOptions.map(([which, label]) => (
                    <button key={which} role="menuitem" onClick={() => { setBulkMenu(false); setError(""); setAction({ type: "bulk", which }); }}>{label}{symbolOnly ? ` · ${u.activeSymbol}` : ""}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === "history" ? (
            <button
              className="icon-button"
              aria-label="Export trade history as CSV"
              title="Export CSV"
              disabled={!records.length}
              onClick={exportHistory}
            >
              <Download />
            </button>
          ) : tab === "alerts" ? (
            <button
              className="icon-button"
              aria-label="Create price alert"
              onClick={() => w.setAlertOpen(true)}
            >
              <Plus />
            </button>
          ) : !practice && (
            <button
              className="icon-button"
              aria-label="Refresh orders"
              disabled={!u.isAuthenticated}
              onClick={() => orders.refetch()}
            >
              <RefreshCw className={orders.isFetching ? "spin" : ""} />
            </button>
          )}
          {tab === 'history' && !practice && <button className="icon-button" aria-label="Refresh history" title="Refresh history" disabled={!u.isAuthenticated || history.isFetching} onClick={() => history.refetch()}><RefreshCw className={history.isFetching ? 'spin' : ''} /></button>}
          {!standalone && <button className="icon-button activity-maximize" aria-label={w.activityMaximized ? 'Back to trading workspace' : `Open ${tab==='history'?'History':tab==='positions'?'Positions':tab==='pending'?'Pending orders':'Price alerts'} view`} title={w.activityMaximized ? 'Back to trading workspace' : 'Open this table in its own view'} aria-pressed={w.activityMaximized} onClick={() => w.activityMaximized?w.setActivityMaximized(false):openActivityView(tab)}>{w.activityMaximized ? <Minimize2 /> : <Maximize2 />}<span>{w.activityMaximized?'Restore':'Open view'}</span></button>}
          {!standalone && !w.activityMaximized && <button className="icon-button activity-expand" aria-label={w.activityExpanded?"Collapse activity":"Expand activity"} title={w.activityExpanded?"Collapse activity":"Expand activity"} aria-expanded={w.activityExpanded} onClick={()=>w.setActivityExpanded(!w.activityExpanded)}>{w.activityExpanded?<ChevronDown/>:<ChevronUp/>}</button>}
        </div>
      </div>
      {tab !== 'alerts' && (filtersOpen || !!query || tab === 'history') && <div className="activity-query-bar">
        <label className="activity-search"><Search /><input aria-label="Search trading activity" placeholder="Search symbol or order ID" value={query} onChange={e=>setQuery(e.target.value)} />{query && <button className="icon-button" aria-label="Clear activity search" onClick={()=>setQuery('')}><X /></button>}</label>
        {tab === 'history' && <select aria-label="History status" value={status} onChange={e=>setStatus(e.target.value as ActivityStatus)}><option value="all">All records</option><option value="closed">Closed trades</option><option value="cancelled">Cancelled orders</option></select>}
        <select aria-label="Sort trading activity" value={sort} onChange={e=>setSort(e.target.value as ActivitySort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="profit">Highest P&amp;L</option><option value="symbol">Instrument A–Z</option></select>
        <span className="activity-result-count">{records.length} of {allRecords.length} records</span>
      </div>}
      {tab !== 'alerts' && (standalone || w.activityMaximized) && <div className="activity-summary">
        <div><span>{tab === 'positions' ? 'Open positions' : tab === 'pending' ? 'Pending orders' : 'Records in view'}</span><strong>{totals.records}</strong></div>
        <div><span>{tab === 'history' ? 'Closed volume' : 'Volume'} · lots</span><strong>{Number.isFinite(totals.volume) ? totals.volume.toLocaleString('en-US',{maximumFractionDigits:4}) : '—'}</strong></div>
        {tab !== 'pending' && <div><span>{tab === 'history' ? 'Realized gross P&L' : 'Floating P&L'} · USD</span><strong className={totalPnl>0?'positive':totalPnl<0?'negative':''}>{money(totalPnl,true)}</strong></div>}
        {tab === 'history' && <div><span>Cancelled orders</span><strong>{totals.cancelled}</strong></div>}
      </div>}
      <div className="activity-body">
      <div
        className="activity-content"
        role="tabpanel"
        aria-label={tab}
      >
        {!practice && tab !== 'alerts' && fetching.isError && fetching.currentData && <div className="activity-notice" role="status">Showing the last loaded activity. <button className="text-button" onClick={() => fetching.refetch()}>Retry refresh</button></div>}
        {tab === "alerts" ? (
          activeAlerts.length ? (
            <div className="alert-list">
              {activeAlerts.map((a) => (
                <div className="alert-row" key={a.id}>
                  <Bell />
                  <div>
                    <strong>{a.symbol}</strong>
                    <span>
                      {a.direction === "above" ? "Bid ≥" : "Bid ≤"}{" "}
                      {formatPrice(a.target, a.symbol)}
                    </span>
                  </div>
                  <span className="alert-status">
                    {a.triggeredAt ? "Triggered" : isQuoteExecutable(practice?quotes[a.symbol]:livePrices[a.symbol]) ? "Watching Bid" : "Waiting for price"}
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${a.symbol} alert`}
                    onClick={() => w.removeAlert(a.id)}
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state horizontal">
              <span className="empty-icon">
                <Bell />
              </span>
              <div>
                <strong>Stay ready for your price.</strong>
                <p>Create an alert and keep an eye on your next opportunity.</p>
              </div>
              <button
                className="text-button"
                onClick={() => w.setAlertOpen(true)}
              >
                Create alert
                <Plus />
              </button>
            </div>
          )
        ) : !practice && !u.isAuthenticated ? (
          <div className="empty-state horizontal">
            <span className="empty-icon">
              <FolderOpen />
            </span>
            <div>
              <strong>Your trading activity, in one place.</strong>
              <p>Open a trading account from your client portal to see its positions and order history.</p>
            </div>
            <a className="text-button" href={PORTAL_SIGN_IN}>
              Open from client portal
              <ArrowUpRight />
            </a>
          </div>
        ) : !practice && fetching.isError && !fetching.currentData ? (
          <div className="empty-state">
            <strong>Activity couldn’t be loaded.</strong>
            <button className="text-button" onClick={() => fetching.refetch()}>
              Try again
            </button>
          </div>
        ) : !practice && fetching.isLoading ? (
          <div className="empty-state">
            <RefreshCw className="spin" />
            <p>Loading activity…</p>
          </div>
        ) : !records.length ? (
          <div className="empty-state horizontal">
            <span className="empty-icon">
              <FolderOpen />
            </span>
            <div>
              <strong>
                {allRecords.length ? "No trades match these filters" : tab === "history"
                  ? "No trade history yet"
                  : tab === "pending"
                    ? "No pending orders"
                    : "No open positions"}
              </strong>
              <p>
                {allRecords.length ? "Clear the search, change the period or show all instruments." : `Your ${tab === "history" ? "completed trades" : "orders"} will appear here.`}
              </p>
              {allRecords.length > 0 && <button className="text-button" onClick={()=>{setQuery('');setStatus('all');setPeriod('all');setSymbolOnly(false);}}>Clear filters</button>}
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Side / lots</th>
                  <th>{tab === "pending" ? "Entry at" : "Entry"}</th>
                  <th>{tab === "history" ? "Exit" : "Current"}</th>
                  <th>SL / TP</th>
                  <th className="num">P&amp;L{currency ? ` · ${currency}` : ""}</th>
                  <th>{tab === "history" ? "Result" : "Manage"}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((o) => {
                  const pnl = pnlOf(o);
                  const sending=awaitingMarketFill(o);
                  const progress=managementProgressLabel(managementResults[String(o.id)]);
                  const exitPrice = Number(o.orderDetails?.exitPrice ?? (o as Order & { exitPrice?: number }).exitPrice) || undefined;
                  return (
                  <tr key={o.exitRowId ?? String(o.id)} className={`${tab==='history'?'history-trade-row ':''}${(detail?.exitRowId ?? String(detail?.id)) === (o.exitRowId ?? String(o.id)) || w.selectedTradeId===String(o.id)?"selected-trade-row":""}`} tabIndex={tab==='history'?0:undefined} aria-label={tab==='history'?`View details for ${o.symbol} order ${o.id}`:undefined}
                    onClick={tab==='history'?e=>{if(!(e.target as HTMLElement).closest('button,a,input,select'))inspectTrade(o);}:undefined}
                    onKeyDown={tab==='history'?e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();inspectTrade(o);}}:undefined}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => {
                          inspectTrade(o);
                          w.setActivityExpanded(true);
                        }}
                      >
                        <InstrumentIcon symbol={o.symbol}/><span className="activity-symbol">{o.symbol}</span>
                      </button>
                      <small>#{o.id} · {when(tab === "history" ? o.closedAt ?? o.createdAt : o.createdAt)}</small>
                    </td>
                    <td>
                      <span
                        className={`side-tag ${String(o.orderType).includes("BUY") ? "positive" : "negative"}`}
                      >
                        {String(o.orderType).replace("_", " ")}
                      </span>
                      <small>{(String(o.orderStatus ?? o.status) === "SENDING" ? o.lotSizeStore ?? o.lotSize : o.lotSize ?? o.volume) ?? "—"} lots{sending?' requested':''}</small>
                    </td>
                    <td data-label="Entry price">
                      {formatPrice(
                        sending ? undefined : orderEntry(o),
                        o.symbol,
                      )}
                    </td>
                    <td data-label={tab === "history" ? "Exit price" : "Current price"}>
                      {formatPrice(tab === "history" ? exitPrice : currentPrice(o), o.symbol)}
                    </td>
                    <td data-label="Stop loss / Take profit">
                      {formatPrice(
                        Number(o.sl ?? o.stopLoss) || undefined,
                        o.symbol,
                      )}
                      <small>
                        {formatPrice(
                          Number(o.tp ?? o.takeProfit) || undefined,
                          o.symbol,
                        )}
                      </small>
                    </td>
                    <td data-label={`P&L${currency ? ` · ${currency}` : ""}`}
                      className={`num ${tab === "pending" ? "" : pnl > 0 ? "positive" : pnl < 0 ? "negative" : ""}`}
                    >
                      {tab === "pending" ? "—" : money(pnl, true)}
                    </td>
                    <td data-label={tab === "history" ? "Result" : "Manage"}>
                      {tab === "history" ? (
                        <div className="row-manage"><span className="status-text">{o.closeReason ?? (o.exitRowId && ["OPEN", "PARTIALLY_COMPLETED"].includes(o.orderStatus ?? "") ? "Partial close" : o.orderStatus ?? o.status ?? "—")}</span><button className="icon-button" aria-label={`Details for order ${o.id}`} onClick={() => inspectTrade(o)}><Info /></button></div>
                      ) : sending ? <span className="row-working" role="status"><LoaderCircle className="spin"/>Awaiting fill</span> : (
                        <div className="row-manage">
                          <button className="icon-button" aria-label={`Details for order ${o.id}`} title="Order details" onClick={() => inspectTrade(o)}><Info /></button>
                          <button
                            className="icon-button"
                            aria-label={`Edit order ${o.id}`}
                            title="Edit stop loss / take profit"
                            disabled={!canManage || busy || requestInFlight || !!progress || !["OPEN", "PENDING"].includes(String(o.orderStatus ?? o.status))}
                            onClick={() => {
                              setError("");
                              openTradeManagement(o,"edit",practice);
                            }}
                          >
                            <SlidersHorizontal />{(standalone || docked) && <span>Modify</span>}
                          </button>
                          {(standalone || docked) && <button className="icon-button row-chart" aria-label={`Chart for order ${o.id}`} onClick={() => viewInstrument(o.symbol, String(o.id))}><ChartCandlestick /><span>Chart</span></button>}
                          {quick.enabled&&tab==='positions'&&<button className="icon-button row-reduce" title="Partial close" aria-label={`Reduce position ${o.id}`} disabled={!canManage||busy||requestInFlight||!!progress} onClick={()=>openTradeManagement(o,'close',practice)}><Minimize2/><span>Reduce</span></button>}
                          <button
                            className="icon-button row-close"
                            aria-label={`${tab === "pending" ? "Cancel" : "Close"} order ${o.id}`}
                            title={quick.enabled?(tab==='pending'?'Cancel immediately':'Close full position immediately'):(tab === "pending" ? "Cancel order" : "Close or reduce position")}
                            disabled={!canManage || busy || requestInFlight || !!progress || !["OPEN", "PENDING"].includes(String(o.orderStatus ?? o.status))}
                            onClick={() => {
                              const type = tab === "pending" ? "cancel" : "close";

                              setError("");
                              void quick.exit(o,type);
                            }}
                          >
                            {progress?(managementResults[String(o.id)]?.status==='unconfirmed'?<Clock3/>:<LoaderCircle className="spin"/>):<X />}{(standalone || docked) && <span>{progress||(tab === "pending" ? "Cancel" : "Close")}</span>}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              {tab !== "pending" && (
                <tfoot>
                  <tr>
                    <td colSpan={5}>{tab === "history" ? `Realized P&L · ${records.length} record${records.length === 1 ? "" : "s"}${period === "all" ? "" : ` · ${PERIODS[period].toLowerCase()}`}` : `Floating · ${records.filter(o=>!awaitingMarketFill(o)).length} filled positions`}</td>
                    <td className={`num ${totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : ""}`}>{money(totalPnl, true)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
      </div>
      {inspectedOrder && <TradeDetails order={inspectedOrder} onClose={()=>setDetail(null)}
        onChart={()=>{setDetail(null);viewInstrument(inspectedOrder.symbol,inspectable?String(inspectedOrder.id):undefined);}}
        onTrade={tab === 'history' ? () => {setDetail(null);composeOrder(inspectedOrder.symbol, String(inspectedOrder.orderType).startsWith('SELL') ? 'SELL' : 'BUY');} : undefined}
        onEdit={inspectable && canManage && !busy ? ()=>{setDetail(null);setError('');openTradeManagement(inspectedOrder,'edit',practice);} : undefined}
        onExit={inspectable && canManage && !busy ? ()=>{setDetail(null);setError('');openTradeManagement(inspectedOrder,tab==='pending'?'cancel':'close',practice);} : undefined}/>}
      {action&&<Dialog title={bulkLabel(action.which)} onClose={()=>{if(!busy)setAction(null);}}>
        <p className="muted">{action.which==='pending'?'Cancel matching pending orders':'Close matching positions'}{symbolOnly?` on ${u.activeSymbol}`:''}. {practice?'Practice account only.':'Each order is sent as a separate request.'}</p>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <button className="button button-danger full-width" disabled={busy||!canManage} onClick={confirm}>{busy?'Submitting…':bulkLabel(action.which)}</button>
      </Dialog>}
    </section>
  );
}
