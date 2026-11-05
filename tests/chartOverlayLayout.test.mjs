import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const code = ts.transpileModule(readFileSync(new URL('../src/lib/chartOverlayLayout.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { layoutChartOverlays, managementPreviewLevels } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const anchor = (id, y, kind = 'entry', selected = false) => ({ id, y, kind, selected });
const visibleIds = layout => layout.labels.flatMap(label => label.members.map(member => member.id)).sort();

test('symbols without trades or an edit preview render without preview lines', () => {
  assert.deepEqual(managementPreviewLevels(undefined, undefined), []);
  assert.deepEqual(managementPreviewLevels(undefined, 'position-1'), []);
  const preview = { id: 'position-1', changes: { sl: 3900 } };
  assert.deepEqual(managementPreviewLevels(preview, undefined), []);
  assert.deepEqual(managementPreviewLevels(preview, 'other-symbol-position'), []);
});

test('switching between a traded symbol and an empty symbol isolates edit previews', () => {
  const preview = { id: 'position-1', changes: { sl: 3900, tp: 4100, limitPrice: 4000 } };
  const levels = managementPreviewLevels(preview, 'position-1');
  assert.deepEqual(levels.map(l => [l.id, l.price, l.title]), [
    ['preview-sl', 3900, 'Preview SL'], ['preview-tp', 4100, 'Preview TP'], ['preview-limitPrice', 4000, 'Preview entry'],
  ]);
  assert.deepEqual(managementPreviewLevels(preview, undefined), []);
  assert.deepEqual(managementPreviewLevels(preview, 'position-1'), levels);
  assert.deepEqual(managementPreviewLevels(undefined, undefined), []);
});

test('cleared or invalid protection values do not produce price lines', () => {
  assert.deepEqual(managementPreviewLevels({ id: 'p', changes: { sl: 0, tp: NaN, limitPrice: -1 } }, 'p'), []);
});

test('selected entry and both exits stay visible before background trades', () => {
  const result = layoutChartOverlays([
    anchor('other-a', 40), anchor('other-b', 90), anchor('other-c', 150),
    anchor('entry', 80, 'entry', true), anchor('stop', 120, 'sl', true), anchor('target', 10, 'tp', true),
  ], 120);
  assert.equal(result.capacity, 3);
  assert.deepEqual(visibleIds(result), ['entry', 'stop', 'target']);
  assert.equal(result.overflowCount, 3);
  assert.ok(result.labels.every(label => label.members.length === 1));
});

test('nearby background entries group without absorbing selected levels or chaining distant prices', () => {
  const result = layoutChartOverlays([
    anchor('a', 100), anchor('b', 110), anchor('c', 120),
    anchor('selected', 105, 'entry', true), anchor('stop', 108, 'sl', true),
  ], 400);
  assert.deepEqual(result.labels.find(label => label.members.length > 1)?.members.map(member => member.id), ['a', 'b']);
  assert.ok(result.labels.some(label => label.id === 'c'));
  assert.ok(result.labels.some(label => label.id === 'selected'));
  assert.ok(result.labels.some(label => label.id === 'stop'));
  assert.equal(result.overflowCount, 0);
});

test('coincident selected levels are distributed around their price with exact anchors preserved', () => {
  const result = layoutChartOverlays([
    anchor('entry', 100, 'entry', true), anchor('stop', 100, 'sl', true), anchor('target', 100, 'tp', true),
  ], 300);
  assert.deepEqual(result.labels.map(label => label.labelY), [68, 100, 132]);
  assert.ok(result.labels.every(label => label.anchorY === 100));
});

test('off-screen prices remain exact while their labels are clamped into the chart', () => {
  const result = layoutChartOverlays([
    anchor('target', -800, 'tp', true), anchor('entry', 100, 'entry', true), anchor('stop', 900, 'sl', true),
  ], 240);
  assert.deepEqual(result.labels.map(label => [label.id, label.anchorY, label.labelY, label.offscreen]), [
    ['target', -800, 24, 'above'], ['entry', 100, 100, null], ['stop', 900, 210, 'below'],
  ]);
});

test('short charts never squeeze labels together and count grouped overflow as original levels', () => {
  const input = [anchor('a', 50), anchor('b', 52), anchor('entry', 55, 'entry', true), anchor('stop', 70, 'sl', true)];
  const result = layoutChartOverlays(input, 80);
  assert.equal(result.labels.length, 1);
  assert.equal(result.labels[0].id, 'entry');
  assert.equal(result.overflowCount, 3);
  assert.deepEqual(result.overflowAnchors.map(row => row.id).sort(), ['a', 'b', 'stop']);
  assert.equal(layoutChartOverlays(input, 30).labels.length, 0);
  assert.equal(layoutChartOverlays(input, 30).overflowCount, 4);
});

test('dense layouts preserve ordering, separation and chart bounds independent of input order', () => {
  const input = Array.from({ length: 12 }, (_, i) => anchor(`p${i}`, 100 + i * 18));
  input.push(anchor('entry', 190, 'entry', true), anchor('stop', 195, 'sl', true), anchor('target', 185, 'tp', true));
  const result = layoutChartOverlays(input, 250);
  assert.deepEqual(result, layoutChartOverlays([...input].reverse(), 250));
  assert.equal(result.labels[0].labelY >= result.minY, true);
  assert.equal(result.labels.at(-1).labelY <= result.maxY, true);
  for (let i = 1; i < result.labels.length; i++) {
    assert.ok(result.labels[i].labelY - result.labels[i - 1].labelY >= 32);
    assert.ok(result.labels[i].anchorY >= result.labels[i - 1].anchorY);
  }
});

test('unavailable geometry is safe and input objects are not mutated', () => {
  const input = Object.freeze([Object.freeze(anchor('entry', 100, 'entry', true)), Object.freeze(anchor('invalid', NaN))]);
  assert.equal(layoutChartOverlays(input, 0).overflowCount, 1);
  assert.equal(layoutChartOverlays(input, NaN).labels.length, 0);
  assert.equal(layoutChartOverlays(input, 300).labels.length, 1);
  assert.equal(input[0].y, 100);
});


test('nearby pending orders and opposite directions never merge into a position label',()=>{
  const result=layoutChartOverlays([
    {...anchor('open-a',100),group:'OPEN:BUY:MARKET'},
    {...anchor('open-b',102),group:'OPEN:BUY:MARKET'},
    {...anchor('pending',104),group:'PENDING:BUY:LIMIT'},
    {...anchor('sell',106),group:'OPEN:SELL:MARKET'},
  ],300);
  assert.deepEqual(result.labels.find(label=>label.members.length>1).members.map(member=>member.id),['open-a','open-b']);
  assert.ok(result.labels.some(label=>label.id==='pending'));
  assert.ok(result.labels.some(label=>label.id==='sell'));
  assert.equal(result.overflowCount,0);
});
