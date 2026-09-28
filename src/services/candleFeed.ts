import { onRawTick } from "@/services/priceSocket";
import { usePracticeStore } from "@/store/usePracticeStore";
import { usePriceStore } from "@/store/usePriceStore";
import { clockOffsetMs } from "@/lib/serverClock";
import { feedTimeMs } from "@/lib/chart";

export type CandleSource = "practice" | "connected" | "preview";

// Every tick for one symbol, unbatched, as (bid, feed time in ms). Connected prices come from
// the socket's raw listener rather than the store, because the store keeps only the latest tick
// per frame and would lose intrabar highs and lows. The preview workspace has no feed.
export function subscribeCandleTicks(
  symbol: string,
  source: CandleSource,
  onTick: (bid: number, timeMs: number) => void,
): () => void {
  if (source === "practice")
    return usePracticeStore.subscribe((state, previous) => {
      const quote = state.quotes[symbol];
      if (!quote || quote === previous.quotes[symbol]) return;
      const arrived = Number(quote.timestamp);
      onTick(quote.bid, feedTimeMs(quote.sourceTs, Number.isFinite(arrived) ? arrived : Date.now(), clockOffsetMs()));
    });
  if (source === "connected")
    return onRawTick((tick) => {
      // Same validity rule the price store applies.
      if (tick.symbol !== symbol || !(tick.bid > 0) || !(tick.ask >= tick.bid)) return;
      onTick(tick.bid, feedTimeMs(tick.sourceTs, tick.receivedAt, clockOffsetMs()));
    });
  return () => {};
}

// Calls back each time the price socket (re)connects, so gaps in chart history can be refilled.
export function onFeedConnected(callback: () => void): () => void {
  return usePriceStore.subscribe((state, previous) => {
    if (state.connection === "connected" && previous.connection !== "connected") callback();
  });
}
