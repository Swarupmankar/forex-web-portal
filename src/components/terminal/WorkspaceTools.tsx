"use client";
import { useEffect, useState } from "react";
import {
  Bell,
  CircleAlert,
  Info,
  Check,
  X,
  LayoutGrid,
  ChartNoAxesCombined,
  List,
  ArrowLeftRight,
} from "lucide-react";
import { Dialog } from "./Dialog";
import { ToastStack } from "./ToastStack";
import { isQuoteStale } from "@/lib/freshness";
import { useWorkspaceStore, WorkspacePanel } from "@/store/useWorkspaceStore";
import {useChartSettings} from "@/store/useChartSettings";
import { useUIStore } from "@/store/useUIStore";
import { usePriceStore } from "@/store/usePriceStore";
import { formatPrice, PREVIEW_FEED, instrument } from "@/lib/market";
import { usePracticeStore } from "@/store/usePracticeStore";
export function WorkspaceTools() {
  const mode=usePracticeStore(s=>s.mode);
  const demoQuotes=usePracticeStore(s=>s.quotes);
  const w = useWorkspaceStore();
  const chart = useChartSettings();
  const symbol = useUIStore((s) => s.activeSymbol),
    setSidebar = useUIStore((s) => s.setSidebarTab);
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const livePrices = usePriceStore((s) => s.prices);
  const prices = mode === "practice" ? demoQuotes : livePrices;
  const [error, setError] = useState("");
  useEffect(() => {
    if (mode !== "practice" && PREVIEW_FEED) return;
    w.alerts
      .filter((a) => !a.triggeredAt && (a.mode || "connected") === mode)
      .forEach((a) => {
        const q = prices[a.symbol];
        if (!q || isQuoteStale(q)) return;
        if (a.direction === "above" ? q.bid >= a.target : q.bid <= a.target) {
          w.triggerAlert(a.id);
          w.notify(
            `${a.symbol} reached ${formatPrice(q.bid, a.symbol)}. Your ${a.direction} alert was triggered.`,
            "info",
          );
        }
      });
  }, [prices, mode, w.alerts, w.triggerAlert, w.notify]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        /INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName) ||
        document.querySelector('[role="dialog"]')
      )
        return;
      if (e.key === "/") {
        e.preventDefault();
        setSidebar("add-symbols");
        w.setPanel("markets");
        w.setFocus(false);
        requestAnimationFrame(() =>
          document.getElementById("market-search")?.focus(),
        );
      }
      if (e.key === "?") w.setHelpOpen(true);
      if (e.key.toLowerCase() === "a") w.setAlertOpen(true);
      if (e.key === "Escape") w.setFocus(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setSidebar, w.setPanel, w.setFocus, w.setHelpOpen, w.setAlertOpen]);
  const panels: [WorkspacePanel, string, typeof Bell][] = [
    ["markets", "Markets", LayoutGrid],
    ["chart", "Chart", ChartNoAxesCombined],
    ["trade", "Trade", ArrowLeftRight],
    ["activity", "Activity", List],
  ];
  return (
    <>
      <nav className="mobile-workspace-nav" aria-label="Terminal workspace">
        {panels.map(([id, label, Icon]) => (
          <button
            key={id}
            aria-current={w.panel === id ? "page" : undefined}
            onClick={() => {
              w.setFocus(false);
              w.setPanel(id);
            }}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
      <ToastStack />
      {w.helpOpen && (
        <Dialog title="Keyboard shortcuts" onClose={() => w.setHelpOpen(false)}>
          <p className="muted">
            Move around your workspace without leaving the keyboard.
          </p>
          <dl className="detail-list">
            <div>
              <dt>Find an instrument</dt>
              <dd>
                <kbd>/</kbd>
              </dd>
            </div>
            <div>
              <dt>Create a price alert</dt>
              <dd>
                <kbd>A</kbd>
              </dd>
            </div>
            <div>
              <dt>Show shortcuts</dt>
              <dd>
                <kbd>?</kbd>
              </dd>
            </div>
            <div>
              <dt>Close a dialog / leave chart focus</dt>
              <dd>
                <kbd>Esc</kbd>
              </dd>
            </div>
          </dl>
          <p className="helper">Keyboard shortcuts never submit trades.</p>
        </Dialog>
      )}
      {w.settingsOpen && (
        <Dialog
          title="Terminal preferences"
          onClose={() => w.setSettingsOpen(false)}
        >
          <p className="muted">
            With one-click on, Buy, Sell and Close act immediately in Practice. Connected accounts ask for separate consent each session.
          </p>
          {[
            ["One-click practice trading", w.oneClickPractice, w.setOneClickPractice],
            ["Chart grid", w.showGrid, w.setGrid],
            ["Bid and ask lines", chart.showBidAsk, chart.setShowBidAsk],
            ["Bar close countdown", chart.showCountdown, chart.setShowCountdown],
            ["Trade confirmation sounds", w.tradeSounds, w.setTradeSounds],

            ["Open trades on chart", w.showTrades, w.setTrades],
          ].map(([label, value, change]) => (
            <label className="preference-row" key={String(label)}>
              <span>{String(label)}</span>
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) =>
                  (change as (b: boolean) => void)(e.target.checked)
                }
              />
            </label>
          ))}
          <button
            className="button button-outline full-width"
            onClick={() => {
              w.setGrid(true);
              useChartSettings.getState().reset();
              w.setTrades(true);
              w.setFocus(false);
            }}
          >
            Reset chart preferences
          </button>
        </Dialog>
      )}
      {w.alertOpen && (
        <Dialog
          title={`Price alert · ${symbol}`}
          onClose={() => {
            w.setAlertOpen(false);
            setError("");
          }}
        >
          <p className="muted">
            Notify me when {instrument(symbol).name} reaches:
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(target);
              if (!Number.isFinite(n) || n <= 0) {
                setError("Enter a price greater than zero.");
                return;
              }
              w.addAlert({ symbol, target: n, direction, mode });
              w.setAlertOpen(false);
              setTarget("");
              setError("");
              w.notify("Price alert saved in this browser.");
            }}
          >
            <div className="form-row">
              <label>
                Condition
                <select
                  value={direction}
                  onChange={(e) =>
                    setDirection(e.target.value as "above" | "below")
                  }
                >
                  <option value="above">Price rises above</option>
                  <option value="below">Price falls below</option>
                </select>
              </label>
              <label>
                Target price
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="Enter price"
                  required
                />
              </label>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <p className="notice-note">
              {mode === "practice" ? "Practice alerts use simulated prices and run while practice mode is open." : "Alerts use the connected feed and run while connected mode is open."} Alerts are saved only in this browser.
            </p>
            <button className="button button-primary full-width" type="submit">
              <Bell />
              Create alert
            </button>
          </form>
        </Dialog>
      )}
    </>
  );
}
