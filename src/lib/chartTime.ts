/* Candle periods of the price-feed chart history
   (MOBILE-HISTORY-INTEGRATION.md §4). Up to H1 a candle follows the clock.
   H2 and above follow the FX trading day, which starts at 17:00 New York
   and moves with US daylight saving. All times are UTC milliseconds. */

export const CHART_TIMEFRAMES = ['M1', 'M5', 'M10', 'M15', 'M30', 'H1', 'H2', 'H4', 'D1', 'W1', 'MN1'] as const;
export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];

const TF_LABELS: Record<string, string> = {
  M1: '1m', M5: '5m', M10: '10m', M15: '15m', M30: '30m', H1: '1H', H2: '2H', H4: '4H', D1: '1D', W1: '1W', MN1: '1M',
};
const TF_UNITS: Record<string, string> = { M: 'minute', H: 'hour', D: 'day', W: 'week', MN: 'month' };
/** The short name on the top bar, the chart and the timeframe menu: 15m, 1H, 1D, 1M (month). */
export const timeframeLabel = (tf: string): string => TF_LABELS[tf] ?? tf;
/** The full name, for screen readers and captions: "15 minutes", "1 month". */
export function timeframeName(tf: string): string {
  const m = /^(MN|M|H|D|W)(\d+)$/.exec(tf);
  if (!m) return tf;
  const n = Number(m[2]);
  return `${n} ${TF_UNITS[m[1] ?? ''] ?? ''}${n === 1 ? '' : 's'}`;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const CLOCK_MS: Record<string, number> = {
  M1: MINUTE, M5: 5 * MINUTE, M10: 10 * MINUTE, M15: 15 * MINUTE, M30: 30 * MINUTE, H1: HOUR,
};
const TRADING_DAY_MS: Record<string, number> = { H2: 2 * HOUR, H4: 4 * HOUR };

/** Daily, weekly and monthly candles are labelled by trading day, not time. */
export const isIntradayTimeframe = (tf: string): boolean => tf !== 'D1' && tf !== 'W1' && tf !== 'MN1';

/** Midnight UTC of the n-th Sunday of a month (month0: 0 = January). */
function nthSunday(year: number, month0: number, n: number): number {
  const first = Date.UTC(year, month0, 1);
  return first + (((7 - new Date(first).getUTCDay()) % 7) + (n - 1) * 7) * DAY;
}

/** New York's offset from UTC at `ms`: EDT (−4 h) from the second Sunday of
 *  March 02:00 EST to the first Sunday of November 02:00 EDT, else EST (−5 h). */
export function newYorkOffsetMs(ms: number): number {
  const year = new Date(ms).getUTCFullYear();
  const start = nthSunday(year, 2, 2) + 7 * HOUR;
  const end = nthSunday(year, 10, 1) + 6 * HOUR;
  return ms >= start && ms < end ? -4 * HOUR : -5 * HOUR;
}

/** New York wall-clock time, written as if it were UTC. */
const toWall = (ms: number) => ms + newYorkOffsetMs(ms);
/** The UTC instant of a New York wall-clock time. */
function fromWall(wall: number): number {
  const guess = wall + 5 * HOUR;
  return wall - newYorkOffsetMs(wall - newYorkOffsetMs(guess));
}

/** Wall-clock midnight of the trading day containing `ms` (17:00 New York
 *  plus 7 h is the next midnight, so Sunday 18:00 belongs to Monday). */
const tradingDayWall = (ms: number) => Math.floor((toWall(ms) + 7 * HOUR) / DAY) * DAY;
/** UTC instant of 17:00 New York the evening before trading day `dayWall`. */
const openOf = (dayWall: number) => fromWall(dayWall - 7 * HOUR);

/** The trading day of `ms` as YYYY-MM-DD: the label of daily, weekly and
 *  monthly candles. */
export function tradingDate(ms: number): string {
  return new Date(tradingDayWall(ms)).toISOString().slice(0, 10);
}

/** Start of the candle that contains `ms`. */
export function candleStart(tf: string, ms: number): number {
  const clock = CLOCK_MS[tf];
  if (clock) return Math.floor(ms / clock) * clock;
  const day = tradingDayWall(ms);
  const dayOpen = openOf(day);
  const step = TRADING_DAY_MS[tf];
  if (step) return dayOpen + Math.floor((ms - dayOpen) / step) * step;
  if (tf === 'W1') return openOf(day - ((new Date(day).getUTCDay() + 6) % 7) * DAY);
  if (tf === 'MN1') {
    const d = new Date(day);
    return openOf(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  return dayOpen; // D1
}

/** Start of the candle after the one that contains `ms`. */
export function candleEnd(tf: string, ms: number): number {
  const start = candleStart(tf, ms);
  const clock = CLOCK_MS[tf] ?? TRADING_DAY_MS[tf];
  if (clock) return start + clock;
  if (tf === 'W1') return candleStart(tf, start + 8 * DAY);
  if (tf === 'MN1') return candleStart(tf, start + 32 * DAY);
  return candleStart(tf, start + 30 * HOUR); // D1
}

/** The chart's x value for a candle starting at `start`: local-time seconds
 *  for intraday (the axis shows device time, like TradingView), the trading
 *  day for D1/W1/MN1. */
export function chartTime(tf: string, start: number): number | string {
  if (!isIntradayTimeframe(tf)) return tradingDate(start);
  return Math.floor(start / 1000) - new Date(start).getTimezoneOffset() * 60;
}

/** Desktop labels map to the same server periods as XpertTrader. */
export const FEED_TIMEFRAMES: Record<string, ChartTimeframe> = {
  '1m': 'M1', '5m': 'M5', '10m': 'M10', '15m': 'M15', '30m': 'M30',
  '1h': 'H1', '2h': 'H2', '4h': 'H4', '1D': 'D1', '1W': 'W1', '1M': 'MN1',
};
