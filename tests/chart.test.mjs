import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const code = ts.transpileModule(readFileSync(new URL('../src/lib/chart.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  applyTick, mergeTick, reconcileBars, bucketStart, feedTimeMs, barTimeLeft, formatCountdown,
  staleLabel, isChartQuoteStale, clockChipTop, axisLabelHeight, MAX_BARS, CHART_STALE_MS,
} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

const bar = (time, open, high = open, low = open, close = open) => ({ time, open, high, low, close });
const liveFrom = bars => ({ bars: bars.map(b => ({ ...b })), newest: -Infinity });
const utc = iso => Date.parse(iso) / 1000;

test('a burst of ticks inside one bar keeps the true high, low and last close', () => {
  const live = liveFrom([bar(600, 10)]);
  const prices = [10.4, 9.7, 10.9, 9.2, 10.1];
  // All within one animation frame: every tick must count, not just the last one.
  prices.forEach((p, i) => assert.equal(applyTick(live, p, 601 + i * 0.01, 60), 600));
  assert.deepEqual(live.bars, [bar(600, 10, 10.9, 9.2, 10.1)]);
});

test('a tick in a new bucket opens a bar whose open is that first tick', () => {
  const live = liveFrom([bar(600, 10)]);
  assert.equal(applyTick(live, 11, 675, 60), 660);
  assert.deepEqual(live.bars.at(-1), bar(660, 11));
  applyTick(live, 11.5, 690, 60);
  applyTick(live, 10.5, 700, 60);
  assert.deepEqual(live.bars.at(-1), bar(660, 11, 11.5, 10.5, 10.5));
  // A gap (no ticks for a few bars) opens the bar the tick belongs to, not the next one in sequence.
  assert.equal(applyTick(live, 12, 905, 60), 900);
  assert.deepEqual(live.bars.map(b => b.time), [600, 660, 900]);
});

test('bars are replaced, never mutated, so earlier references stay valid', () => {
  const history = [bar(600, 10)];
  const live = { bars: history.slice(), newest: -Infinity };
  const before = live.bars[0];
  applyTick(live, 12, 610, 60);
  assert.deepEqual(before, bar(600, 10));
  assert.deepEqual(history[0], bar(600, 10));
  assert.notEqual(live.bars[0], before);
});

test('a tick late by less than one bar joins the last bar instead of being dropped', () => {
  const live = liveFrom([bar(540, 10), bar(600, 10)]);
  assert.equal(applyTick(live, 12, 559, 60), 600); // 41 s before the last bar opened
  assert.deepEqual(live.bars.at(-1), bar(600, 10, 12, 10, 12));
  assert.deepEqual(live.bars[0], bar(540, 10), 'the earlier bar is left alone');
});

test('a tick a full bar or more older than the last bar is ignored', () => {
  const live = liveFrom([bar(600, 10)]);
  assert.equal(applyTick(live, 99, 540, 60), undefined);
  assert.equal(applyTick(live, 99, 500, 60), undefined);
  assert.deepEqual(live.bars, [bar(600, 10)]);
  for (const [price, time] of [[NaN, 610], [0, 610], [-1, 610], [10, NaN]])
    assert.equal(applyTick(live, price, time, 60), undefined);
  assert.deepEqual(live.bars, [bar(600, 10)]);
});

test('an out-of-order tick widens the bar but does not move its close', () => {
  const live = liveFrom([bar(600, 10)]);
  applyTick(live, 11, 630, 60);
  applyTick(live, 8, 620, 60); // arrived after the 630 tick
  assert.deepEqual(live.bars.at(-1), bar(600, 10, 11, 8, 11));
});

test('a skewed local clock no longer freezes the chart', () => {
  // Server history ends with the 12:05 bar; this computer's clock is five minutes slow.
  const serverBar = utc('2026-09-26T12:05:00Z');
  const skew = -300000;
  const serverTick = (serverSec) => ({ sourceTs: serverSec * 1000, receivedAt: serverSec * 1000 + skew });
  const tick = serverTick(serverBar + 20);
  // Bucketing by raw local arrival time drops the tick (it looks five bars old) ...
  assert.equal(applyTick(liveFrom([bar(serverBar, 1.1)]), 1.2, tick.receivedAt / 1000, 60), undefined);
  // ... while the feed's own timestamp lands it in the forming bar.
  const live = liveFrom([bar(serverBar, 1.1)]);
  assert.equal(applyTick(live, 1.2, feedTimeMs(tick.sourceTs, tick.receivedAt, 0) / 1000, 60), serverBar);
  // Without a feed timestamp, the estimated clock offset puts it in the same bar.
  assert.equal(feedTimeMs(undefined, tick.receivedAt, -skew), tick.sourceTs);
  assert.equal(applyTick(live, 1.25, feedTimeMs(undefined, tick.receivedAt, -skew) / 1000, 60), serverBar);
  assert.deepEqual(live.bars, [bar(serverBar, 1.1, 1.25, 1.1, 1.25)]);
  // A small uncorrected skew (20 s slow, no offset known yet) still merges instead of freezing,
  // and the next bar opens normally once the local clock reaches it.
  const slow = liveFrom([bar(serverBar, 1.1)]);
  assert.equal(applyTick(slow, 1.3, serverBar - 20, 60), serverBar);
  assert.equal(applyTick(slow, 1.4, serverBar + 61, 60), serverBar + 60);
  assert.deepEqual(slow.bars.map(b => [b.time, b.close]), [[serverBar, 1.3], [serverBar + 60, 1.4]]);
  assert.equal(feedTimeMs(NaN, 5000, 10), 5010);
});

test('live bars are capped at 3000, dropping the oldest', () => {
  assert.equal(MAX_BARS, 3000);
  const live = liveFrom(Array.from({ length: 3000 }, (_, i) => bar(i * 60, 1)));
  assert.equal(applyTick(live, 2, 3000 * 60 + 5, 60), 3000 * 60);
  assert.equal(live.bars.length, 3000);
  assert.equal(live.bars[0].time, 60);
  assert.deepEqual(live.bars.at(-1), bar(180000, 2));
  // A small cap for callers that need one, and history is trimmed the same way on reconcile.
  const small = liveFrom([bar(0, 1), bar(60, 1)]);
  applyTick(small, 1, 125, 60, 2);
  assert.deepEqual(small.bars.map(b => b.time), [60, 120]);
  assert.equal(reconcileBars(Array.from({ length: 3005 }, (_, i) => bar(i * 60, 1)), []).length, 3000);
});

test('mergeTick keeps its immutable contract on top of applyTick', () => {
  const c = [bar(600, 10, 11, 9, 10)];
  const next = mergeTick(c, 13, 650, 60);
  assert.notEqual(next, c);
  assert.deepEqual(c, [bar(600, 10, 11, 9, 10)]);
  assert.deepEqual(next, [bar(600, 10, 13, 9, 13)]);
  assert.equal(mergeTick(next, 99, 500, 60), next);
});

test('refetched history is authoritative for closed bars and keeps newer live bars', () => {
  const history = [bar(540, 1, 1.5, 0.9, 1.2), bar(600, 1.2, 1.3, 1.1, 1.25)];
  const live = [bar(540, 9), bar(600, 1.2, 1.4, 1.15, 1.3), bar(660, 1.3, 1.35, 1.28, 1.33)];
  assert.deepEqual(reconcileBars(history, live), [
    bar(540, 1, 1.5, 0.9, 1.2), // closed bar: history wins
    bar(600, 1.2, 1.4, 1.1, 1.3), // forming bar: widest range, live close
    bar(660, 1.3, 1.35, 1.28, 1.33), // newer than history: appended
  ]);
  assert.deepEqual(reconcileBars(history, []), history);
  assert.deepEqual(reconcileBars([], live), live);
});

test('bucket boundaries follow UTC for 1m, 5m, 1h, 4h and 1D', () => {
  const t = utc('2026-09-26T13:47:29Z');
  assert.equal(bucketStart(t, 60), utc('2026-09-26T13:47:00Z'));
  assert.equal(bucketStart(t, 300), utc('2026-09-26T13:45:00Z'));
  assert.equal(bucketStart(t, 3600), utc('2026-09-26T13:00:00Z'));
  assert.equal(bucketStart(t, 14400), utc('2026-09-26T12:00:00Z'));
  assert.equal(bucketStart(t, 86400), utc('2026-09-26T00:00:00Z'));
  // Exactly on a boundary belongs to the bar that opens there; a millisecond earlier does not.
  const four = utc('2026-09-26T16:00:00Z');
  assert.equal(bucketStart(four, 14400), four);
  assert.equal(bucketStart(four - 0.001, 14400), utc('2026-09-26T12:00:00Z'));
  assert.equal(bucketStart(utc('2026-09-26T23:59:59Z'), 86400), utc('2026-09-26T00:00:00Z'));
  assert.equal(bucketStart(utc('2026-09-27T00:00:00Z'), 86400), utc('2026-09-27T00:00:00Z'));
});

test('time left in the bar counts down to the next UTC boundary', () => {
  const now = Date.parse('2026-09-26T13:47:29.250Z');
  assert.equal(barTimeLeft(now, 60), 30750);
  assert.equal(barTimeLeft(now, 300), 150750);
  assert.equal(barTimeLeft(now, 3600), 750750);
  assert.equal(barTimeLeft(now, 14400), Date.parse('2026-09-26T16:00:00Z') - now);
  assert.equal(barTimeLeft(now, 86400), Date.parse('2026-09-27T00:00:00Z') - now);
  assert.equal(barTimeLeft(Date.parse('2026-09-26T13:48:00Z'), 60), 60000);
});

test('countdown formats as mm:ss below an hour and hh:mm:ss from an hour up', () => {
  assert.equal(formatCountdown(30750, 60), '00:31');
  assert.equal(formatCountdown(60000, 60), '01:00');
  assert.equal(formatCountdown(150750, 300), '02:31');
  assert.equal(formatCountdown(900000, 900), '15:00');
  assert.equal(formatCountdown(750750, 3600), '00:12:31');
  assert.equal(formatCountdown(8551000, 14400), '02:22:31');
  assert.equal(formatCountdown(86400000, 86400), '24:00:00');
  assert.equal(formatCountdown(1, 60), '00:01');
  assert.equal(formatCountdown(0, 60), '00:00');
  assert.equal(formatCountdown(-500, 3600), '00:00:00');
});

test('stale label and threshold', () => {
  assert.equal(CHART_STALE_MS, 10000);
  assert.equal(isChartQuoteStale(10000), false);
  assert.equal(isChartQuoteStale(10001), true);
  assert.equal(isChartQuoteStale(Infinity), true);
  assert.equal(staleLabel(42900), 'Stale 42s');
  assert.equal(staleLabel(59999), 'Stale 59s');
  assert.equal(staleLabel(185000), 'Stale 3m');
  assert.equal(staleLabel(7300000), 'Stale 2h');
  assert.equal(staleLabel(Infinity), 'Stale');
});

test('countdown chip sits under the anchor label and follows it when the ask label pushes it down', () => {
  const label = axisLabelHeight(11), chip = 16;
  assert.ok(Math.abs(label - 15.583) < 0.001);
  // Upper half: the ask label moves up, the bid label stays; the chip is right under the bid label.
  assert.equal(clockChipTop(100, 99, 400, label, chip), 100 + label / 2);
  // Lower half with overlapping labels: the bid label is pushed below the ask label.
  assert.equal(clockChipTop(300, 298, 400, label, chip), 298 + label + label / 2);
  // Lower half, far enough apart: nothing moves.
  assert.equal(clockChipTop(330, 300, 400, label, chip), 330 + label / 2);
  // Without an ask line (series last price) and kept inside the pane.
  assert.equal(clockChipTop(120, null, 400, label, chip), 120 + label / 2);
  assert.equal(clockChipTop(395, null, 400, label, chip), 400 - chip);
  assert.equal(clockChipTop(-80, null, 400, label, chip), 0);
});
