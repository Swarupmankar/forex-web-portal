import type { PriceTick } from "../types/trading";
// A quote older than this cannot be traded on; the ticket and chart wait for a fresh one.
export const QUOTE_EXECUTABLE_MS = 5000;
// A quote older than this is shown as stale everywhere it is displayed.
export const QUOTE_STALE_MS = 15000;
// Orders are blocked while the feed itself delivers prices this late.
export const MAX_FEED_LAG_MS = 2000;
export function quoteAge(tick: PriceTick | undefined, now = Date.now()) {
    const at = Number(tick?.timestamp);
    return tick && Number.isFinite(at) ? Math.max(0, now - at) : Infinity;
}
export const isQuoteStale = (tick: PriceTick | undefined, now = Date.now()) => quoteAge(tick, now) > QUOTE_STALE_MS;
export function isQuoteExecutable(tick: PriceTick | undefined, now = Date.now()) {
    return !!tick && quoteAge(tick, now) <= QUOTE_EXECUTABLE_MS && !((tick.lagMs ?? 0) > MAX_FEED_LAG_MS);
}
