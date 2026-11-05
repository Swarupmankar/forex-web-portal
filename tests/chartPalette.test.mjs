import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/lib/chartPalette.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { readChartPalette, FALLBACK_CHART_PALETTE } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('server rendering uses a valid fallback palette', () => {
  assert.deepEqual(readChartPalette('light'), FALLBACK_CHART_PALETTE.light);
});

function browserFixture(t, values, pixels) {
  let fill = '', clears = 0, draws = 0;
  const ctx = {
    set fillStyle(value) { if (pixels[value]) fill = value; },
    // A browser can serialize modern CSS this way; it must never reach the chart.
    get fillStyle() { return 'color(srgb 0.4 0.5 0.6)'; },
    clearRect() { clears++; },
    fillRect() { draws++; },
    getImageData() { return { data: new Uint8ClampedArray(pixels[fill]) }; },
  };
  const previousDocument = globalThis.document, previousStyles = globalThis.getComputedStyle;
  const canvas = { getContext: () => ctx };
  globalThis.document = { documentElement: {}, createElement: () => canvas };
  globalThis.getComputedStyle = () => ({ getPropertyValue: name => values[name] ?? '' });
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousStyles === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = previousStyles;
  });
  return { canvas, counts: () => ({ clears, draws }) };
}

test('portal HSL and mixed colours become chart-compatible RGBA for every chart role', t => {
  const fixture = browserFixture(t, {
    '--mm-pos': 'hsl(146 67% 30%)', '--mm-neg': 'hsl(0 64% 52%)',
    '--mm-ink-2': 'hsl(215 9% 45%)', '--chart-bg': 'hsl(0 0% 100%)',
    '--mm-line-soft': 'color-mix(in srgb, #e2e6ee 55%, white)',
  }, {
    'hsl(146 67% 30%)': [25,128,70,255], 'hsl(0 64% 52%)': [211,54,54,255],
    'hsl(215 9% 45%)': [104,113,125,255], 'hsl(0 0% 100%)': [255,255,255,255],
    'color-mix(in srgb, #e2e6ee 55%, white)': [239,241,246,255],
  });
  assert.deepEqual(readChartPalette('light'), {
    up:'rgba(25, 128, 70, 1)', down:'rgba(211, 54, 54, 1)', muted:'rgba(104, 113, 125, 1)',
    background:'rgba(255, 255, 255, 1)', grid:'rgba(239, 241, 246, 1)',
  });
  assert.deepEqual(fixture.counts(), { clears:5, draws:5 });
  assert.equal(fixture.canvas.width, 1);
  assert.equal(fixture.canvas.height, 1);
});

test('invalid CSS retains the fallback and missing tokens retain their theme values', t => {
  browserFixture(t, { '--mm-pos':'invalid-colour' }, { '#6fe08f':[111,224,143,255] });
  assert.deepEqual(readChartPalette('dark'), { ...FALLBACK_CHART_PALETTE.dark, up:'rgba(111, 224, 143, 1)' });
});
