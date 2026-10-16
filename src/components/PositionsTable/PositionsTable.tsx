"use client";
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
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { usePriceStore } from "@/store/usePriceStore";
import {
  useGetOpenOrdersQuery,
  useGetOrderHistoryQuery,
  useExitOrderMutation,
  useModifyOrderMutation,
} from "@/store/api/tradingApi";
import { formatPrice, errorMessage } from "@/lib/market";
import { classifyFailure } from "@/lib/orderOutcome";
import { useExecutionPolicy } from "@/hooks/useExecutionPolicy";
import { executableQuote } from "@/hooks/useExecutableQuote";
import { Dialog } from "@/components/terminal/Dialog";
import type { Order } from "@/types/trading";
import { usePracticeStore } from "@/store/usePracticeStore";
import { practicePnl, type BulkClose } from "@/lib/practice";
import { useOneClick } from "@/components/OrderEntry/useOneClick";
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
const pnlOf = (o: Order) => Number(o.pnl ?? o.profit);
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
type Action = { order: Order; type: "close" | "cancel" | "edit" } | { type: "bulk"; which: BulkClose };
export function PositionsTable() {
  const practice=usePracticeStore(s=>s.mode === "practice");
  const demo=usePracticeStore(s=>s.account);
  const quotes=usePracticeStore(s=>s.quotes);
  const livePrices = usePriceStore((s) => s.prices);
  const u = useUIStore(),
    w = useWorkspaceStore();
  const oneClick = useOneClick();
  // Polling is owned by the page; this subscription only reads the shared cache.
  const orders = useGetOpenOrdersQuery(undefined, {
      skip: practice || !u.isAuthenticated,
    }),
    history = useGetOrderHistoryQuery(undefined, {
      skip: practice || !u.isAuthenticated || u.bottomTab !== "history",
    });
  const [exit, { isLoading: exiting }] = useExitOrderMutation(),
    [modify, { isLoading: modifying }] = useModifyOrderMutation();
  const [action, setAction] = useState<Action | null>(null),
    [error, setError] = useState(""),
    [sl, setSl] = useState(""),
    [tp, setTp] = useState(""),
    [closeLots, setCloseLots] = useState(""),
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
  // Close-only mode still allows closing, cancelling and editing exits.
  const canManage = policy.canManage;
  const tab = u.bottomTab;
  const demoRecords: Order[] = demo.orders.filter(o=>tab === 'positions' ? o.status === 'OPEN' : tab === 'pending' ? o.status === 'PENDING' : !['OPEN','PENDING'].includes(o.status)).map(o=>({...o,orderType:o.status === "PENDING" ? `${o.orderType} ${o.executionType}` : o.orderType,pnl:practicePnl(o,quotes[o.symbol]),orderStatus:o.reason || o.status,closedAt:o.closedAt}));
  const allRecords: Order[] = practice ? demoRecords :
    tab === "positions"
      ? orders.data?.openOrders || []
      : tab === "pending"
        ? orders.data?.pendingOrders || []
        : (
            (history.data?.completedOrders ||
              history.data?.fullyCompletedOrders ||
              []) as Order[]
          ).concat(
            (history.data?.partiallyCompletedOrders || []) as Order[],
            (history.data?.cancelledOrders || []) as Order[],
          );
  const records = allRecords.filter(o => (!symbolOnly || o.symbol === u.activeSymbol) && (tab !== "history" || inPeriod(o.closedAt ?? o.createdAt, period)));
  const fetching = tab === "history" ? history : orders;
  const busy = exiting || modifying || bulkBusy;
  const activeAlerts = w.alerts.filter(a => (a.mode || "connected") === (practice ? "practice" : "connected"));
  const totalPnl = records.reduce((n, o) => n + (Number.isFinite(pnlOf(o)) ? pnlOf(o) : 0), 0);
  const currency = practice ? "USD" : "";
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
      ["Order ID", "Instrument", "Side", "Lots", "Entry", "Exit", "PnL", "Status", "Opened", "Closed"],
      ...records.map((o) => [
        o.id,
        o.symbol,
        o.orderType,
        o.lotSize ?? o.volume,
        o.orderDetails?.entryPrice ?? o.openPrice,
        o.orderDetails?.exitPrice ?? (o as Order & { exitPrice?: number }).exitPrice,
        o.pnl ?? o.profit,
        o.orderStatus ?? o.status,
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
    if (practice) {
      const id = String(order.id);
      if (type === "cancel") usePracticeStore.getState().manage(id, "cancel");
      else if (lots !== undefined && lots < lotsOf(order)) usePracticeStore.getState().closeVolume(id, lots);
      else usePracticeStore.getState().manage(id, "close");
      w.notify(type === "cancel" ? `Order #${id} cancelled.` : lots !== undefined && lots < lotsOf(order) ? `Closed ${lots} of ${lotsOf(order)} lots · #${id}.` : `Position #${id} closed. Virtual balance updated.`);
      return;
    }
    const idempotencyKey = crypto.randomUUID();
    try {
      if (type === "close") {
        const volume = lots ?? lotsOf(order);
        if (!Number.isFinite(volume) || volume <= 0)
          throw new Error("The open volume could not be verified. Refresh before closing.");
        await exit({ orderId: order.id, exitLotSize: volume, idempotencyKey }).unwrap();
      } else await modify({ orderId: order.id, cancelOrder: true, idempotencyKey }).unwrap();
    } catch (e) {
      if (classifyFailure(e) === "unknown") {
        void orders.refetch();
        throw new Error(`We couldn't confirm the ${type === "close" ? "close" : "cancellation"} of #${order.id}. Check Positions before trying again.`);
      }
      throw e;
    }
    if (!quiet) w.notify("Request accepted. Refreshing the order status.", "info");
  }
  async function quickClose(order: Order, type: "close" | "cancel") {
    if (busy) return;
    try { await closeOrder(order, type); }
    catch (e) { w.notify(errorMessage(e, "The request failed. Please refresh and try again."), "error"); }
  }
  async function runBulk(which: BulkClose) {
    const symbol = symbolOnly ? u.activeSymbol : undefined;
    if (practice) {
      const r = usePracticeStore.getState().closeMany(which, symbol);
      w.notify(r.done ? `${which === "pending" ? "Cancelled" : "Closed"} ${r.done} order${r.done === 1 ? "" : "s"}${r.skipped ? ` · ${r.skipped} waiting for a quote` : ""}.` : "Nothing matched.", r.done ? "success" : "info");
      return;
    }
    // The backend has no batch endpoint: send up to 4 at a time and report every failure with its reason.
    const targets = records.filter(o => which === "pending" || which === "all" || (which === "profitable" ? pnlOf(o) > 0 : pnlOf(o) < 0));
    const failures: string[] = [];
    let ok = 0, next = 0;
    const worker = async () => {
      while (next < targets.length) {
        const o = targets[next++];
        try { await closeOrder(o, which === "pending" ? "cancel" : "close", undefined, true); ok++; }
        catch (e) { failures.push(`#${o.id} ${o.symbol}: ${errorMessage(e, "failed")}`); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker));
    w.notify(`${ok} of ${targets.length} request${targets.length === 1 ? "" : "s"} accepted.${failures.length ? ` Not done — ${failures.join("; ")}` : ""}`, failures.length ? "error" : "info");
  }
  async function confirm() {
    if (!canManage || !action || busy) return;
    setError("");
    try {
      if (action.type === "bulk") {
        setBulkBusy(true);
        await runBulk(action.which);
      } else if (action.type === "edit") {
        if ((sl && (!Number.isFinite(Number(sl)) || Number(sl) <= 0)) || (tp && (!Number.isFinite(Number(tp)) || Number(tp) <= 0)))
          throw new Error("Exit levels must be positive prices.");
        if (practice) {
          usePracticeStore.getState().manage(String(action.order.id), "edit", { sl: sl ? Number(sl) : undefined, tp: tp ? Number(tp) : undefined });
          w.notify("Exit levels updated.");
        } else {
          await modify({ orderId: action.order.id, cancelOrder: false, sl: sl ? Number(sl) : 0, tp: tp ? Number(tp) : 0, idempotencyKey: crypto.randomUUID() }).unwrap();
          w.notify("Request accepted. Refreshing the order status.", "info");
        }
      } else {
        const lots = action.type === "close" && closeLots ? Number(closeLots) : undefined;
        if (lots !== undefined && (!Number.isFinite(lots) || lots <= 0 || lots > lotsOf(action.order)))
          throw new Error(`Enter a volume between 0.01 and ${lotsOf(action.order)} lots.`);
        await closeOrder(action.order, action.type, lots);
      }
      setAction(null);
    } catch (e) {
      setError(errorMessage(e, "The request failed. Please refresh and try again."));
    } finally {
      setBulkBusy(false);
    }
  }
  const openCount = practice ? demo.orders.filter(o=>o.status==='OPEN').length : orders.data?.openOrders?.length || 0;
  const pendingCount = practice ? demo.orders.filter(o=>o.status==='PENDING').length : orders.data?.pendingOrders?.length || 0;
  const bulkOptions: [BulkClose, string][] = tab === "pending" ? [["pending", "Cancel all pending"]] : [["all", "Close all positions"], ["profitable", "Close profitable"], ["losing", "Close losing"]];
  const bulkLabel = (which: BulkClose) => bulkOptions.find(b => b[0] === which)?.[1] ?? "";
  return (
    <section className="activity-panel panel">
      <div className="activity-heading">
        <div
          className="activity-tabs"
          role="tablist"
          aria-label="Trading activity"
        >
          {(["positions", "pending", "history", "alerts"] as const).map(
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
          <button className="icon-button activity-expand" aria-label={w.activityExpanded?"Collapse activity":"Expand activity"} aria-expanded={w.activityExpanded} onClick={()=>w.setActivityExpanded(!w.activityExpanded)}>{w.activityExpanded?<ChevronDown/>:<ChevronUp/>}</button>
        </div>
      </div>
      <div
        className="activity-content"
        role="tabpanel"
        aria-label={tab}
      >
        {tab === "alerts" ? (
          activeAlerts.length ? (
            <div className="alert-list">
              {activeAlerts.map((a) => (
                <div className="alert-row" key={a.id}>
                  <Bell />
                  <div>
                    <strong>{a.symbol}</strong>
                    <span>
                      {a.direction === "above" ? "Above" : "Below"}{" "}
                      {formatPrice(a.target, a.symbol)}
                    </span>
                  </div>
                  <span className="alert-status">
                    {a.triggeredAt ? "Triggered" : "Watching"}
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
        ) : !practice && fetching.isError ? (
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
                {tab === "history"
                  ? allRecords.length ? "No trades match these filters" : "No trade history yet"
                  : tab === "pending"
                    ? "No pending orders"
                    : "No open positions"}
              </strong>
              <p>
                {tab === "history" && allRecords.length ? "Try a longer period or show all instruments." : `Your ${tab === "history" ? "completed trades" : "orders"} will appear here.`}
              </p>
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
                {records.map((o, i) => {
                  const pnl = pnlOf(o);
                  const exitPrice = Number(o.orderDetails?.exitPrice ?? (o as Order & { exitPrice?: number }).exitPrice) || undefined;
                  return (
                  <tr key={`${o.id}-${i}`} className={w.selectedTradeId===String(o.id)?"selected-trade-row":""}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => {
                          u.setActiveSymbol(o.symbol);
                          w.selectTrade(String(o.id));
                          w.setPanel("chart");
                        }}
                      >
                        <InstrumentIcon symbol={o.symbol}/>{o.symbol}
                      </button>
                      <small>#{o.id} · {when(tab === "history" ? o.closedAt ?? o.createdAt : o.createdAt)}</small>
                    </td>
                    <td>
                      <span
                        className={`side-tag ${String(o.orderType).includes("BUY") ? "positive" : "negative"}`}
                      >
                        {String(o.orderType).replace("_", " ")}
                      </span>
                      <small>{(Number(o.lotSize) > 0 ? o.lotSize : o.lotSizeStore ?? o.lotSize) ?? o.volume} lots</small>
                    </td>
                    <td data-label="Entry price">
                      {formatPrice(
                        Number(
                          o.orderDetails?.entryPrice ??
                            o.openPrice ??
                            o.targetPrice,
                        ) || undefined,
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
                        <span className="status-text">{o.orderStatus ?? o.status ?? "—"}</span>
                      ) : (
                        <div className="row-manage">
                          <button
                            className="icon-button"
                            aria-label={`Edit order ${o.id}`}
                            title="Edit stop loss / take profit"
                            disabled={!canManage || busy}
                            onClick={() => {
                              setSl(String(o.sl ?? o.stopLoss ?? ""));
                              setTp(String(o.tp ?? o.takeProfit ?? ""));
                              setError("");
                              setAction({ order: o, type: "edit" });
                            }}
                          >
                            <SlidersHorizontal />
                          </button>
                          <button
                            className="icon-button row-close"
                            aria-label={`${tab === "pending" ? "Cancel" : "Close"} order ${o.id}`}
                            title={oneClick.on ? `${tab === "pending" ? "Cancel" : "Close"} now (one-click)` : tab === "pending" ? "Cancel order" : "Close position"}
                            disabled={!canManage || busy}
                            onClick={() => {
                              const type = tab === "pending" ? "cancel" : "close";
                              if (oneClick.on) { void quickClose(o, type); return; }
                              setError("");
                              setCloseLots(String(o.lotSize ?? o.volume ?? ""));
                              setAction({ order: o, type });
                            }}
                          >
                            <X />
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
                    <td colSpan={5}>{tab === "history" ? `Realized · ${records.length} trade${records.length === 1 ? "" : "s"}${period === "all" ? "" : ` · ${PERIODS[period].toLowerCase()}`}` : `Floating · ${records.length} position${records.length === 1 ? "" : "s"}`}</td>
                    <td className={`num ${totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : ""}`}>{money(totalPnl, true)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
      {oneClick.dialog}
      {action && (
        <Dialog
          restoreFocus={() => document.querySelector<HTMLElement>(".orders-table .row-close:not(:disabled)") ?? document.querySelector<HTMLElement>('.activity-tabs [aria-selected="true"]')}
          title={action.type === "bulk" ? bulkLabel(action.which) : `${action.type === "edit" ? "Edit exit levels" : action.type === "cancel" ? "Cancel pending order" : "Close position"} · ${action.order.symbol}`}
          onClose={() => {
            if (!busy) setAction(null);
          }}
        >
          {action.type === "bulk" ? (
            <p className="muted">
              {action.which === "pending" ? "Cancels" : "Closes"} {action.which === "profitable" ? "every position currently in profit" : action.which === "losing" ? "every position currently at a loss" : action.which === "pending" ? "every pending order" : "every open position"}{symbolOnly ? ` on ${u.activeSymbol}` : ""} at the available price. {practice ? "Practice account only." : "Each order is sent as a separate request."}
            </p>
          ) : (
            <p className="muted">
              Order #{action.order.id} · {action.order.orderType} ·{" "}
              {action.order.lotSize ?? action.order.volume} lots
              {action.type === "close" && Number.isFinite(pnlOf(action.order)) && <> · <span className={pnlOf(action.order) >= 0 ? "positive" : "negative"}>{money(pnlOf(action.order), true)}</span></>}
            </p>
          )}
          {action.type === "edit" ? (
            <div className="form-row">
              <label>
                Stop loss
                <input
                  type="number"
                  step="any"
                  value={sl}
                  onChange={(e) => setSl(e.target.value)}
                />
              </label>
              <label>
                Take profit
                <input
                  type="number"
                  step="any"
                  value={tp}
                  onChange={(e) => setTp(e.target.value)}
                />
              </label>
            </div>
          ) : action.type === "close" ? (
            <>
              <label className="close-volume">
                Volume to close <span>of {lotsOf(action.order)} lots</span>
                <input type="number" step="0.01" min="0.01" max={lotsOf(action.order)} inputMode="decimal" value={closeLots} onChange={e => setCloseLots(e.target.value)} />
              </label>
              <div className="volume-presets">
                {[0.25, 0.5, 1].map(f => {
                  const v = Math.max(0.01, Math.floor(lotsOf(action.order) * f * 100) / 100);
                  return <button key={f} aria-pressed={Number(closeLots) === v} onClick={() => setCloseLots(String(v))}>{f === 1 ? "All" : `${f * 100}%`}</button>;
                })}
              </div>
            </>
          ) : action.type === "cancel" ? (
            <p className="notice-note">
              {practice ? "This updates your virtual practice account only." : "This submits a request to cancel this pending order."}
            </p>
          ) : null}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className={`button full-width ${action.type === "edit" ? "button-primary" : "button-danger"}`}
            disabled={busy || !canManage}
            onClick={confirm}
          >
            {busy ? "Submitting…" : action.type === "edit" ? "Save exit levels" : action.type === "cancel" ? "Cancel order" : action.type === "bulk" ? bulkLabel(action.which) : Number(closeLots) && Number(closeLots) < lotsOf(action.order) ? `Close ${closeLots} lots` : "Close position"}
          </button>
        </Dialog>
      )}
    </section>
  );
}
