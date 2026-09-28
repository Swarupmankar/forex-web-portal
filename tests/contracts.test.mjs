import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
async function source(path) {
  const text = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return import(
    "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
  );
}
const { normalizeCandles, mergeTick, movingAverage, bucketCandles } =
  await source("../src/lib/chart.ts");
const { validateTrade, CHART_INTERVALS, normalizeInstruments } = await source(
  "../src/lib/contracts.ts",
);
test("chart normalizes actual backend date format, seconds, milliseconds, sorting and duplicates", () => {
  const r = normalizeCandles({
    data: {
      quotes: [
        { date: "2026-09-18-22:13", open: "10", high: 12, low: 9, close: 11 },
        { time: 1000, open: 2, high: 3, low: 1, close: 2 },
        { time: 1000, open: 3, high: 4, low: 2, close: 3 },
        { time: 1790000000000, open: 5, high: 6, low: 4, close: 5 },
        { date: "invalid", open: 1, high: 2, low: 0, close: 1 },
      ],
    },
  });
  assert.equal(r.length, 3);
  assert.equal(r[0].close, 3);
  assert.equal(r[1].time, Date.parse("2026-09-18T22:13:00Z") / 1000);
  assert.equal(r[2].time, 1790000000);
});
test("live ticks aggregate into timeframe OHLC, ignore older ticks and reject malformed candles", () => {
  let c = [{ time: 600, open: 10, high: 11, low: 9, close: 10 }];
  c = mergeTick(c, 13, 650, 60);
  assert.deepEqual(c[0], { time: 600, open: 10, high: 13, low: 9, close: 13 });
  assert.deepEqual(mergeTick(c, 99, 500, 60), c);
  assert.equal(mergeTick(c, 14, 661, 60)[1].time, 660);
  assert.deepEqual(
    normalizeCandles([{ time: 10, open: 10, high: 1, low: 3, close: 10 }]),
    [],
  );
  assert.equal(
    movingAverage(
      [
        { time: 1, close: 2 },
        { time: 2, close: 4 },
      ],
      2,
    )[0].value,
    3,
  );
});
test("timeframes and payload match the mobile app contract", () => {
  assert.deepEqual(CHART_INTERVALS["15m"], { interval: "minute", period: 15 });
  assert.deepEqual(CHART_INTERVALS["4h"], { interval: "hourly", period: 4 });
  const order = {
    symbol: "EURUSD",
    orderType: "BUY",
    executionType: "MARKET",
    lotSize: 0.1,
    sl: 1,
    tp: 1.2,
  };
  assert.equal(validateTrade(order, 1.1), null);
  assert.ok(validateTrade({ ...order, sl: 1.3 }, 1.1));
  assert.ok(validateTrade({ ...order, lotSize: NaN }, 1.1));
  assert.ok(
    validateTrade({ ...order, executionType: "LIMIT", limitPrice: 1.2 }, 1.1),
  );
  assert.equal(
    validateTrade({ ...order, executionType: "LIMIT", limitPrice: 1.05 }, 1.1),
    null,
  );
  assert.ok(validateTrade({ ...order, tp: NaN }, 1.1));
});
test("mobile instrument metadata remains available in the web adapter", () => {
  const [s] = normalizeInstruments([
    {
      symbol: "EURUSD",
      currency_group: "Forex",
      currency_base: "EUR",
      currency_quote: "USD",
      pip_size: 0.0001,
      contract_size: 100000,
    },
  ]);
  assert.equal(s.category, "Forex");
  assert.equal(s.contractSize, 100000);
  assert.equal(s.pipSize, 0.0001);
  assert.equal(s.id, "EURUSD");
});

test("irregular historical timestamps form one coherent selected-interval candle", () => {
  const rows = [
    { time: 601, open: 10, high: 12, low: 9, close: 11 },
    { time: 659, open: 11, high: 14, low: 10, close: 13 },
    { time: 660, open: 13, high: 14, low: 12, close: 14 },
  ];
  assert.deepEqual(bucketCandles(rows, 60), [
    { time: 600, open: 10, high: 14, low: 9, close: 13 },
    { time: 660, open: 13, high: 14, low: 12, close: 14 },
  ]);
});
