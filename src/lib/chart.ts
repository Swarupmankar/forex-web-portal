export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
export function normalizeCandles(response: unknown): Candle[] {
  const r = response as any;
  const rows = Array.isArray(r)
    ? r
    : r?.quotes ||
      r?.data?.quotes ||
      r?.candles ||
      r?.data?.candles ||
      r?.data ||
      r?.result ||
      [];
  if (!Array.isArray(rows)) return [];
  const byTime = new Map<number, Candle>();
  for (const row of rows) {
    let raw = row.time ?? row.timestamp ?? row.date ?? row.t;
    if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}$/.test(raw))
      raw = raw.slice(0, 10) + "T" + raw.slice(11) + ":00Z";
    let time =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && /^\d+$/.test(raw)
          ? Number(raw)
          : Date.parse(
              typeof raw === "string" &&
                /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(raw)
                ? raw.replace(" ", "T") + "Z"
                : raw,
            ) / 1000;
    if (time > 1e12) time /= 1000;
    time = Math.floor(time);
    const open = Number(row.open ?? row.o),
      high = Number(row.high ?? row.h),
      low = Number(row.low ?? row.l),
      close = Number(row.close ?? row.c);
    if (
      [time, open, high, low, close].every(Number.isFinite) &&
      time > 0 &&
      open > 0 &&
      low > 0 &&
      high >= Math.max(open, close) &&
      low <= Math.min(open, close)
    )
      byTime.set(time, { time, open, high, low, close });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
// Deterministic illustrative data is restricted to the clearly-labelled preview workspace.
// `now` (ms) should be feed time, so preview bars line up with live practice ticks.
export function previewCandles(
  base: number,
  seconds: number,
  now = Date.now(),
): Candle[] {
  const end = Math.floor(now / 1000);
  const offset = ((139 / 139 - 0.55) * base * 0.008) + (Math.sin(139 * 0.23) + Math.sin(139 * 0.071) * 1.8) * base * 0.0012 + Math.sin(139 * 1.31) * base * 0.0007;
  return Array.from({ length: 140 }, (_, i) => {
    const drift = (i / 139 - 0.55) * base * 0.008;
    const wave =
      (Math.sin(i * 0.23) + Math.sin(i * 0.071) * 1.8) * base * 0.0012;
    const open = base + drift + wave - offset,
      close = open + Math.sin(i * 1.31) * base * 0.0007;
    return {
      time: Math.floor(end / seconds) * seconds - (139 - i) * seconds,
      open,
      close,
      high:
        Math.max(open, close) +
        base * (0.00015 + Math.abs(Math.sin(i)) * 0.0003),
      low:
        Math.min(open, close) -
        base * (0.00015 + Math.abs(Math.cos(i)) * 0.0003),
    };
  });
}
export function movingAverage(candles: Candle[], period = 20) {
  return candles.flatMap((c, i) =>
    i < period - 1
      ? []
      : [
          {
            time: c.time,
            value:
              candles
                .slice(i - period + 1, i + 1)
                .reduce((a, b) => a + b.close, 0) / period,
          },
        ],
  );
}
// Most bars the live chart keeps; the oldest drop off as new bars open.
export const MAX_BARS = 3000;
// The chart greys out its countdown and bid/ask lines when the quote is older than this.
export const CHART_STALE_MS = 10000;

// Open time (seconds) of the UTC bar containing `time`; daily bars open at 00:00 UTC.
export function bucketStart(time: number, seconds: number) {
  return Math.floor(time / seconds) * seconds;
}

// A tick's time on the feed's clock (ms): the feed's own timestamp when it sent one, otherwise
// the local arrival time corrected by the estimated clock offset, so a wrong local clock
// cannot push ticks into the wrong bar.
export function feedTimeMs(
  sourceTs: number | undefined,
  receivedAt: number,
  offsetMs: number,
) {
  return sourceTs !== undefined && Number.isFinite(sourceTs)
    ? sourceTs
    : receivedAt + offsetMs;
}

// Mutable live-bar state owned by one chart (never shared with React state).
export interface LiveCandles {
  bars: Candle[];
  // Feed time (seconds) of the newest tick applied. An older tick may widen a bar, never move its close.
  newest: number;
}

// Folds one tick into the live bars in place: widens and closes the last bar, or opens a new
// one. A tick late by less than one bar (clock skew, a delayed message) joins the last bar
// instead of being dropped; anything older is ignored. Bar objects are replaced, not mutated,
// so references handed out earlier stay unchanged. Returns the open time of the bar that
// changed, or undefined when the tick was ignored.
export function applyTick(
  live: LiveCandles,
  price: number,
  time: number,
  seconds: number,
  cap = MAX_BARS,
): number | undefined {
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(time) || !(seconds > 0))
    return undefined;
  const bars = live.bars;
  const bucket = bucketStart(time, seconds);
  const last = bars[bars.length - 1];
  if (!last || bucket > last.time) {
    bars.push({ time: bucket, open: price, high: price, low: price, close: price });
    if (bars.length > cap) bars.splice(0, bars.length - cap);
    live.newest = Math.max(live.newest, time);
    return bucket;
  }
  if (last.time - time >= seconds) return undefined;
  const newest = time >= live.newest;
  bars[bars.length - 1] = {
    time: last.time,
    open: last.open,
    high: Math.max(last.high, price),
    low: Math.min(last.low, price),
    close: newest ? price : last.close,
  };
  if (newest) live.newest = time;
  return last.time;
}

// Immutable form of applyTick for one-off use; the live chart aggregates in place instead.
export function mergeTick(
  candles: Candle[],
  price: number,
  time: number,
  seconds: number,
): Candle[] {
  const live = { bars: candles.slice(), newest: -Infinity };
  return applyTick(live, price, time, seconds) === undefined ? candles : live.bars;
}

// Refreshed history is authoritative for every bar before its last one. Live bars fill in
// what it doesn't have yet: the forming bar keeps the widest range seen and the live close,
// and newer live bars are appended.
export function reconcileBars(
  history: Candle[],
  live: Candle[],
  cap = MAX_BARS,
): Candle[] {
  const bars = history.slice(-cap);
  const lastTime = bars[bars.length - 1]?.time ?? -Infinity;
  for (const bar of live) {
    if (bar.time < lastTime) continue;
    if (bar.time === lastTime) {
      const h = bars[bars.length - 1];
      bars[bars.length - 1] = {
        time: h.time,
        open: h.open,
        high: Math.max(h.high, bar.high),
        low: Math.min(h.low, bar.low),
        close: bar.close,
      };
    } else bars.push(bar);
  }
  return bars.length > cap ? bars.slice(-cap) : bars;
}

// Milliseconds until the bar open at `nowMs` (feed time) closes.
export function barTimeLeft(nowMs: number, seconds: number) {
  return (bucketStart(nowMs / 1000, seconds) + seconds) * 1000 - nowMs;
}

// Bar-close countdown: mm:ss, or hh:mm:ss for bars of an hour or longer. Rounds up, so the
// display reaches 00:00 only as the bar closes.
export function formatCountdown(ms: number, seconds: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(total / 3600),
    m = Math.floor((total % 3600) / 60),
    s = total % 60;
  return seconds >= 3600
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(h * 60 + m)}:${pad(s)}`;
}

export const isChartQuoteStale = (ageMs: number) => ageMs > CHART_STALE_MS;

// "Stale 42s", "Stale 3m", "Stale 2h"; plain "Stale" when there has been no quote at all.
export function staleLabel(ageMs: number) {
  if (!Number.isFinite(ageMs)) return "Stale";
  const s = Math.floor(Math.max(0, ageMs) / 1000);
  return `Stale ${s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`}`;
}

// Height of a lightweight-charts v4 price-axis label: the font plus 2.5/12 of it above and below.
export const axisLabelHeight = (fontSize: number) => fontSize * (1 + 5 / 12);

// Top of the countdown chip, just under the axis label at `anchorY` (the bid, or the last
// close). The chart moves overlapping labels in the lower half of the axis downwards, so
// when the ask label sits there and overlaps the bid label, the bid label (and the chip)
// shift down by one label. The chip is kept inside the pane.
export function clockChipTop(
  anchorY: number,
  askY: number | null,
  paneHeight: number,
  labelHeight: number,
  chipHeight: number,
) {
  let labelY = anchorY;
  if (askY !== null && askY > paneHeight / 2 && anchorY < askY + labelHeight)
    labelY = askY + labelHeight;
  const top = labelY + labelHeight / 2;
  return Math.min(Math.max(top, 0), Math.max(0, paneHeight - chipHeight));
}

// Aggregate returned samples to the selected UTC interval, including irregular server timestamps.
export function bucketCandles(candles: Candle[], seconds: number): Candle[] {
  const buckets = new Map<number, Candle>();
  for (const candle of candles) {
    const time = Math.floor(candle.time / seconds) * seconds;
    const existing = buckets.get(time);
    buckets.set(
      time,
      existing
        ? {
            ...existing,
            high: Math.max(existing.high, candle.high),
            low: Math.min(existing.low, candle.low),
            close: candle.close,
          }
        : { ...candle, time },
    );
  }
  return [...buckets.values()];
}
