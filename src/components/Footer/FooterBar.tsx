"use client";
import { useEffect, useState } from "react";
import { usePriceStore } from "@/store/usePriceStore";
import { DEVELOPMENT_FEED, PREVIEW_FEED } from "@/lib/market";
import { QUOTE_STALE_MS } from "@/lib/freshness";
import { usePracticeStore } from "@/store/usePracticeStore";
export function FooterBar() {
  return <footer className="terminal-footer desktop-footer">
    <span>Movement Markets · Web terminal</span><FeedStatus />
  </footer>;
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
