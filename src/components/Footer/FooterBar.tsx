"use client";
import { useEffect, useState } from "react";
import { usePriceStore } from "@/store/usePriceStore";
import { DEVELOPMENT_FEED, PREVIEW_FEED } from "@/lib/market";
import { QUOTE_STALE_MS } from "@/lib/freshness";
import { usePracticeStore } from "@/store/usePracticeStore";
import { useAccountStore } from '@/store/useAccountStore';
export function FooterBar({
  balance,
  equity,
  margin,
  freeMargin,
  marginLevel,
}: {
  balance?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
  marginLevel?: number | null;
}) {
  const practice=usePracticeStore(s=>s.mode === "practice");
  const currency = useAccountStore(s => s.accounts.find(a => a.id === s.activeId)?.currency);
  return (
    <footer className="terminal-footer">
      <div className="account-metrics">
        {[
          ["Balance", balance],
          ["Equity", equity],
          ["Used margin", margin],
          ["Free margin", freeMargin],
          ["Margin level", marginLevel],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>
              {typeof value === "number"
                ? value.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) + (label === "Margin level" ? "%" : practice ? " USD" : currency ? ` ${currency}` : '')
                : "—"}
            </strong>
          </div>
        ))}
      </div>
      <FeedStatus />
    </footer>
  );
}

function FeedStatus() {
  const practice = usePracticeStore(s => s.mode === "practice");
  const connection = usePriceStore((s) => s.connection),
    last = usePriceStore((s) => s.lastReceivedAt);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(t);
  }, []);
  const stale = !!last && now - last > QUOTE_STALE_MS;
  return (
      <div className="feed-status">
        <span
          className={`status-dot ${(practice || connection === "connected" && !stale) ? "connected" : ""}`}
        />
        <span>
          {practice ? "Practice · simulated prices" : PREVIEW_FEED
            ? "Preview"
            : connection === "connected"
              ? stale
                ? "Waiting for quotes"
                : DEVELOPMENT_FEED
                  ? "Development feed"
                  : "Connected"
              : connection === "connecting"
                ? last ? "Reconnecting…" : "Connecting…"
                : "Feed disconnected"}
        </span>
        <time>
          {now ? new Date(now).toISOString().slice(11, 19) : "--:--:--"} UTC
        </time>
      </div>
  );
}
