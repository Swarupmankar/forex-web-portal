"use client";
import { useMarketDisplay } from '@/hooks/useMarketDisplay';
import { useEffect, useState } from "react";
import {
  Bell,
  CircleAlert,
  Info,
  Check,
  X,
} from "lucide-react";
import { Dialog } from "./Dialog";
import { ToastStack } from "./ToastStack";
import { isQuoteStale } from "@/lib/freshness";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {useChartSettings} from "@/store/useChartSettings";
import { useUIStore } from "@/store/useUIStore";
import { usePriceStore } from "@/store/usePriceStore";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";
import { showActivity } from "@/lib/tradingWorkflow";
import { playTradeSound, unlockTradeSound } from "@/lib/tradeSound";
import { usePracticeStore } from "@/store/usePracticeStore";
export function WorkspaceTools() {
  const { formatPrice, instrument } = useMarketDisplay();
  const mode=usePracticeStore(s=>s.mode);
  const demoQuotes=usePracticeStore(s=>s.quotes);
  const w = useWorkspaceStore();
  const chart = useChartSettings();
  const symbol = useUIStore((s) => s.activeSymbol);
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const livePrices = usePriceStore((s) => s.prices);
  const prices = mode === "practice" ? demoQuotes : livePrices;
  const [error, setError] = useState("");
  usePriceAlerts();
  const currentQuote=prices[symbol];
  const currentBid=currentQuote&&!isQuoteStale(currentQuote)?currentQuote.bid:undefined;
  useEffect(()=>{if(w.alertOpen){setTarget('');setError('');}},[w.alertOpen,symbol]);
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
        useWorkspaceStore.getState().setInstrumentPickerOpen(true);
      }
      if (e.key === "?") w.setHelpOpen(true);
      if (e.key.toLowerCase() === "a") w.setAlertOpen(true);
      if (e.key === "Escape") { w.setFocus(false); w.setActivityMaximized(false); useUIStore.getState().setPickingEntry(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [w.setPanel, w.setFocus, w.setHelpOpen, w.setAlertOpen, w.setActivityMaximized]);
  return (
    <>
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
            Enable one-tap trading beside the chart quotes. The lightning control above Positions separately enables immediate closing. Use the ticket for SL/TP, pending orders and partial closes.
          </p>
          <button className="button button-outline sound-preview" onClick={()=>{unlockTradeSound();void playTradeSound("filled");}}>Play test sound</button>
          <label className="preference-row density-preference"><span>Interface size</span><select aria-label="Interface size" value={w.density} onChange={e=>w.setDensity(e.target.value as 'compact'|'comfortable')}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
          {[
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
          <p className="alert-current-price">Current Bid <strong>{formatPrice(currentBid,symbol)}</strong>{currentBid==null&&<span>Waiting for the price feed</span>}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(target);
              if (!Number.isFinite(n) || n <= 0) {
                setError("Enter a price greater than zero.");
                return;
              }
              w.notify("Price alert saved. Watching the Bid price.", "info");
              w.addAlert({ symbol, target: n, direction, mode });
              w.setAlertOpen(false);
              setTarget("");
              setError("");
              showActivity("alerts");
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
                  <option value="above">Bid is at or above</option>
                  <option value="below">Bid is at or below</option>
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
            {currentBid!=null&&Number(target)>0&&(direction==="above"?currentBid>=Number(target):currentBid<=Number(target))&&<p className="helper">This price condition is already met. The alert will trigger immediately.</p>}
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
