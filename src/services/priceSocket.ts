import { io, Socket } from "socket.io-client";
import { usePriceStore, type RawTick } from "@/store/usePriceStore";
import { PREVIEW_FEED } from "@/lib/market";
import { parseFeedTime, recordServerTime, clockOffsetMs } from "@/lib/serverClock";
let socket: Socket | null = null;
const subscriptions = new Map<string, number>();
// Ticks are buffered (latest per symbol) and flushed once per frame, or every 250 ms while the
// tab is hidden and frames are paused, so a burst of messages costs one store update.
const pending = new Map<string, RawTick>();
// Unbatched listeners see every tick synchronously (the chart needs every intrabar high/low).
const rawListeners = new Set<(tick: RawTick) => void>();
export function onRawTick(listener: (tick: RawTick) => void) {
  rawListeners.add(listener);
  return () => { rawListeners.delete(listener); };
}
let flushScheduled = false;
function flush() {
  flushScheduled = false;
  if (!pending.size) return;
  const batch = [...pending.values()];
  pending.clear();
  usePriceStore.getState().applyTicks(batch);
}
function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  if (typeof document !== "undefined" && document.visibilityState === "visible") requestAnimationFrame(flush);
  else setTimeout(flush, 250);
}
export const initPriceSocket = () => {
  if (socket || PREVIEW_FEED) return socket;
  usePriceStore.getState().setConnection("connecting");
  socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
    transports: ["websocket"],
    reconnection: true,
    // Exponential backoff with jitter, so a feed restart isn't hit by every client at once.
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
    randomizationFactor: 0.5,
  });
  socket.io.on("reconnect_attempt", () => usePriceStore.getState().setConnection("connecting"));
  socket.on("connect", () => {
    usePriceStore.getState().setConnection("connected");
    subscriptions.forEach((_, symbol) =>
      socket?.emit("subscribeSymbol", symbol),
    );
  });
  socket.on("disconnect", () =>
    usePriceStore.getState().setConnection("disconnected"),
  );
  socket.on("connect_error", () =>
    usePriceStore.getState().setConnection("disconnected"),
  );
  socket.on("price", (msg: unknown) => {
    if (typeof msg !== "string") return;
    const [symbol, bid, ask, mid, time] = msg.trim().split(/\s+/);
    if (!symbol) return;
    const receivedAt = Date.now();
    const sourceTs = parseFeedTime(time, receivedAt);
    if (sourceTs !== undefined) recordServerTime(sourceTs, receivedAt);
    const tick: RawTick = {
      symbol,
      bid: Number(bid),
      ask: Number(ask),
      mid: Number(mid),
      receivedAt,
      sourceTs,
      // How much later than usual this quote arrived, once the steady clock offset is removed.
      lagMs: sourceTs === undefined ? undefined : Math.max(0, receivedAt + clockOffsetMs() - sourceTs),
    };
    rawListeners.forEach((listener) => listener(tick));
    pending.set(symbol, tick);
    scheduleFlush();
  });
  return socket;
};
export const stopPriceSocket = () => {
  pending.clear();
  socket?.disconnect();
  socket = null;
  usePriceStore.getState().setConnection("disconnected");
};
export const subscribeSymbol = (symbol: string) => {
  const count = subscriptions.get(symbol) || 0;
  subscriptions.set(symbol, count + 1);
  if (!count && socket?.connected) socket.emit("subscribeSymbol", symbol);
};
export const unsubscribeSymbol = (symbol: string) => {
  const count = subscriptions.get(symbol) || 0;
  if (count > 1) subscriptions.set(symbol, count - 1);
  else {
    subscriptions.delete(symbol);
    socket?.emit("unsubscribeSymbol", symbol);
  }
};
