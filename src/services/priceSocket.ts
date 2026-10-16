// Broker price feed: wss://<pricefeed>/ws/prices?token=<trading token>, binary protobuf frames
// (MOBILE-PRICEFEED-INTEGRATION.md). The client is generated from proto/pricefeed.proto; never
// hand-edit pricefeed.pb.js. Prices are sint64 integers scaled by 1e8.
import * as protobuf from "protobufjs/minimal";
import Long from "long";
import { pricefeed } from "./pricefeed/pricefeed.pb";
import { usePriceStore, type RawTick } from "@/store/usePriceStore";
import { tradingToken } from "@/store/useAccountStore";
import { PREVIEW_FEED } from "@/lib/market";
import { fromScaled } from "@/lib/contracts";

// sint64 only decodes exactly with a Long implementation wired in.
protobuf.util.Long = Long as any;
protobuf.configure();

const FEED_URL = process.env.NEXT_PUBLIC_PRICEFEED_URL?.trim().replace(/\/+$/, "") ?? "";
const MAX_SYMBOLS = 256;
const State = pricefeed.SymbolStatus.State;

let socket: WebSocket | null = null;
let attempt = 0;
let retry: ReturnType<typeof setTimeout> | null = null;
let keepFresh: ReturnType<typeof setInterval> | null = null;
let feedDown = false;
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

function send(message: pricefeed.IClientMessage) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  socket.send(pricefeed.ClientMessage.encode(message).finish());
}
const subscribe = (symbols: string[]) => symbols.length && send({ subscribe: { symbols, wantDepth: false } });

function handle(message: pricefeed.ServerMessage) {
  const receivedAt = Date.now();
  for (const q of message.quotes) {
    if (!q.symbol) continue;
    // ts is when the gateway received the book, not when it was sent, and the current book is
    // re-sent on every subscribe: it is not a measure of lag, so the arrival time is used.
    const tick: RawTick = { symbol: q.symbol, bid: fromScaled(String(q.bid)), ask: fromScaled(String(q.ask)), receivedAt };
    rawListeners.forEach((listener) => listener(tick));
    pending.set(q.symbol, tick);
    scheduleFlush();
  }
  // Any quote, or any status other than FEED_DOWN, means the broker's session is up again.
  if (feedDown && (message.quotes.length || message.statuses.some((s) => s.state !== State.FEED_DOWN))) {
    feedDown = false;
    usePriceStore.getState().setConnection("connected");
  }
  // Every status means "no price now" (awaiting first book, unusable book, feed down, unknown):
  // the symbol is blanked, never left showing its last (no longer true) price.
  const blank: string[] = [];
  for (const s of message.statuses) {
    if (!s.symbol) continue;
    if (s.state === State.UNKNOWN_SYMBOL) console.warn(`Price feed: ${s.symbol} is not quoted by this broker.`);
    if (s.state === State.FEED_DOWN && !feedDown) {
      feedDown = true;
      usePriceStore.getState().setConnection("disconnected");
    }
    pending.delete(s.symbol);
    blank.push(s.symbol);
  }
  if (blank.length) usePriceStore.getState().clearPrices(blank);
}

function open() {
  const token = tradingToken();
  if (!token || !FEED_URL || socket) return;
  usePriceStore.getState().setConnection("connecting");
  const ws = new WebSocket(`${FEED_URL.replace(/^http/i, "ws")}/ws/prices?token=${encodeURIComponent(token)}`);
  ws.binaryType = "arraybuffer";
  socket = ws;
  ws.onopen = () => {
    attempt = 0;
    feedDown = false;
    usePriceStore.getState().setConnection("connected");
    // Subscriptions are per connection; the current book for each arrives immediately.
    subscribe([...subscriptions.keys()]);
    // Unchanged prices are never re-sent: a still market is silent and its last quote is still
    // the price. While the socket is open (the server pings it and drops a dead one) and no
    // status has blanked it, a held quote stays current, so it is re-stamped instead of going stale.
    // shortcut: a connection that dies without a close event looks live until the browser notices.
    keepFresh = setInterval(() => !feedDown && usePriceStore.getState().touch(Date.now()), 1000);
  };
  ws.onmessage = (event) => {
    if (socket !== ws) return;
    // A text frame is an error string from the server, never a price.
    if (typeof event.data === "string") return console.warn("Price feed:", event.data);
    try {
      handle(pricefeed.ServerMessage.decode(new Uint8Array(event.data as ArrayBuffer)));
    } catch (error) {
      console.warn("Price feed: undecodable frame", error);
    }
  };
  ws.onclose = (event) => {
    if (socket !== ws) return;
    socket = null;
    if (keepFresh) clearInterval(keepFresh);
    keepFresh = null;
    // Held prices are not actionable across a reconnect: blank them until the new books arrive.
    pending.clear();
    usePriceStore.getState().clearPrices(Object.keys(usePriceStore.getState().prices));
    // A refused token (HTTP 401 at the upgrade) is not visible to browser code; it surfaces as a
    // close before open and is retried with backoff, while the account API reports the expiry.
    // 1001 is a deliberate server shutdown (a deploy): a short, quiet backoff.
    const delay = event.code === 1001 ? 1500 : Math.min(1000 * 2 ** attempt++, 15000) * (0.5 + Math.random() / 2);
    usePriceStore.getState().setConnection("connecting");
    retry = setTimeout(() => {
      retry = null;
      open();
    }, delay);
  };
}

// Network back: the old socket may have died silently, so replace it. Tab visible again:
// re-subscribing makes the server resend every current book (a cheap resync).
const onOnline = () => {
  if (!socket) return;
  socket.close(1000); // onclose blanks prices and reconnects
};
const onVisible = () => document.visibilityState === "visible" && subscribe([...subscriptions.keys()]);

export const initPriceSocket = () => {
  if (PREVIEW_FEED) return;
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  open();
};
export const stopPriceSocket = () => {
  if (typeof window !== "undefined") {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
  }
  pending.clear();
  if (retry) clearTimeout(retry);
  if (keepFresh) clearInterval(keepFresh);
  retry = keepFresh = null;
  const ws = socket;
  socket = null;
  feedDown = false;
  ws?.close(1000);
  usePriceStore.getState().setConnection("disconnected");
};
export const subscribeSymbol = (symbol: string) => {
  const count = subscriptions.get(symbol) || 0;
  if (!count && subscriptions.size >= MAX_SYMBOLS) return console.warn(`Price feed: ${MAX_SYMBOLS}-symbol limit reached; ${symbol} not subscribed.`);
  subscriptions.set(symbol, count + 1);
  if (!count) subscribe([symbol]);
};
export const unsubscribeSymbol = (symbol: string) => {
  const count = subscriptions.get(symbol) || 0;
  if (!count) return;
  if (count > 1) subscriptions.set(symbol, count - 1);
  else {
    subscriptions.delete(symbol);
    send({ unsubscribe: { symbols: [symbol] } });
  }
};
