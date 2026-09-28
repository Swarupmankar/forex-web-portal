// Estimates the offset between the feed's clock and this computer's clock, so candle
// buckets and "today" filters follow server time even when the local clock is wrong.
const samples: number[] = [];
let offset = 0;
// Accepts epoch seconds, epoch milliseconds or an ISO string; rejects anything more than a day away.
export function parseFeedTime(raw: unknown, now = Date.now()): number | undefined {
    if (raw === undefined || raw === null || raw === "")
        return undefined;
    const n = Number(raw);
    const ms = Number.isFinite(n) ? (n < 1e11 ? n * 1000 : n) : Date.parse(String(raw));
    return Number.isFinite(ms) && Math.abs(ms - now) < 86400000 ? ms : undefined;
}
export function recordServerTime(sourceTs: number, receivedAt = Date.now()) {
    samples.push(sourceTs - receivedAt);
    if (samples.length > 64)
        samples.shift();
    const sorted = [...samples].sort((a, b) => a - b);
    offset = sorted[Math.floor(sorted.length / 2)];
}
export const clockOffsetMs = () => offset;
export const serverNow = () => Date.now() + offset;
export function resetServerClock() {
    samples.length = 0;
    offset = 0;
}
