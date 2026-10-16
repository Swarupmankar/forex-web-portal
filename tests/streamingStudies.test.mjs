import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function load(file) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const full = await load('../src/lib/indicators.ts');
const { createStudyCache } = await load('../src/lib/streamingStudies.ts');
const rows = (count, offset = 0) => Array.from({ length: count }, (_, i) => {
  const close = 2670 + Math.sin((i + offset) * .9) * 11 + Math.cos((i + offset) * .3) * 2;
  return { time: 1000 + (i + offset) * 60, open: close, high: close + 1, low: close - 1, close };
});
const reference = (key, bars, period, deviation = 2) => key === 'bollinger'
  ? full.bollinger(bars, period, deviation) : { [key]: full[key](bars, period) };
function compare(actual, expected, since = -Infinity) {
  for (const [line, points] of Object.entries(expected)) {
    const tail = points.filter(p => p.time >= since), received = actual[line] || [];
    assert.equal(received.length, tail.length, `${line} length`);
    received.forEach((p, i) => {
      assert.equal(p.time, tail[i].time);
      assert.ok(Math.abs(p.value - tail[i].value) < 1e-7, `${line}: ${p.value} vs ${tail[i].value}`);
    });
  }
}
for (const key of ['sma', 'ema', 'bollinger', 'rsi']) {
  test(`${key}: repeated open-candle ticks, a new bar and backfilled corrections match full history`, () => {
    const cache = createStudyCache(), bars = rows(300), study = { enabled: true, period: 20, deviation: 2 };
    compare(cache.values(key, bars, study), reference(key, bars, 20));
    for (let i = 0; i < 20; i++) {
      bars.at(-1).close = 2660 + i * .3;
      compare(cache.values(key, bars, study, bars.at(-1).time), reference(key, bars, 20), bars.at(-1).time);
    }
    bars.push(...rows(3, 300));
    compare(cache.values(key, bars, study, bars[300].time), reference(key, bars, 20), bars[300].time);
    bars[297].close += 5;
    compare(cache.values(key, bars, study, bars[297].time), reference(key, bars, 20), bars[297].time);
  });
  test(`${key}: warm-up, history replacement, trimming and parameter changes reset safely`, () => {
    const cache = createStudyCache();
    let bars = rows(2), study = { enabled: true, period: 4, deviation: 2 };
    compare(cache.values(key, bars, study), reference(key, bars, 4));
    for (let i = 2; i < 8; i++) {
      bars.push(...rows(1, i));
      compare(cache.values(key, bars, study, bars.at(-1).time), reference(key, bars, 4), bars.at(-1).time);
    }
    bars = rows(80, 500);
    compare(cache.values(key, bars, study), reference(key, bars, 4));
    bars = bars.slice(10);
    compare(cache.values(key, bars, study, bars.at(-1).time), reference(key, bars, 4));
    study = { enabled: true, period: 30, deviation: 3 };
    compare(cache.values(key, bars, study, bars.at(-1).time), reference(key, bars, 30, 3));
  });
}
test('steady-state indicator work stays bounded as history grows', () => {
  const cache = createStudyCache();
  let reads = 0;
  const bars = rows(10000).map(row => ({ ...row, get close() { reads++; return row.close; } }));
  for (const key of ['sma', 'ema', 'bollinger', 'rsi']) {
    cache.values(key, bars, { enabled: true, period: 20 });
    reads = 0;
    cache.values(key, bars, { enabled: true, period: 20 }, bars.at(-1).time);
    assert.ok(reads <= 42, `${key} read ${reads} closing prices for one tick`);
  }
});
