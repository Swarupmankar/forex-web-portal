import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const source = name => ts.transpileModule(readFileSync(new URL('../src/' + name, import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const precisionURL = uri(source('lib/pricePrecision.ts'));
const { priceDigits, decimalPlaces, rememberPriceDigits } = await import(precisionURL);
const { fromScaled, normalizeInstruments } = await import(uri(source('lib/contracts.ts')));
const { usePriceStore } = await import(uri(source('store/usePriceStore.ts')
  .replace(/(['"])zustand\1/,JSON.stringify(pathToFileURL(require.resolve('zustand')).href))
  .replace(/(['"])@\/lib\/pricePrecision\1/,JSON.stringify(precisionURL))));

test('catalogue and feed precision prevent silver, crypto and energy price truncation', () => {
  assert.equal(priceDigits('XAGUSD', {pipSize:0.0001}), 4);
  assert.equal(priceDigits('XRPUSD', {pipSize:0.0001}, 5), 5);
  assert.equal(priceDigits('BTCUSD', undefined, 3), 3);
  assert.equal(priceDigits('XNGUSD', {pipSize:0.001}), 3);
  assert.equal(priceDigits('EURUSD'), 5);
  assert.equal(priceDigits('USDJPY'), 3);
  assert.equal(priceDigits('US30'), 2);
  assert.equal(priceDigits('XAUUSD'), 2);
  assert.equal(priceDigits('CUSTOM', {digits:0}), 0);
  assert.equal(priceDigits('CUSTOM', {digits:6}, 2), 6);
});
test('scaled feed numbers retain all eight decimals without binary-float noise', () => {
  assert.equal(decimalPlaces(fromScaled('3162410000')), 4);
  assert.equal(decimalPlaces(fromScaled('8219681300000')), 3);
  assert.equal(decimalPlaces(fromScaled('5')), 8);
  assert.equal(decimalPlaces(0.1+0.2), 1);
  assert.equal(decimalPlaces(4000), 0);
  assert.equal(priceDigits('CUSTOM.TEST', {digits:NaN}, Infinity), 2);
  assert.equal(priceDigits('CUSTOM', {digits:100}, 100), 8);
});
test('precision survives trailing zero quotes and does not cause redundant updates', () => {
  const start = {};
  const observed = rememberPriceDigits(start,[{symbol:'xagusd',bid:31.6241,ask:31.6522}]);
  assert.deepEqual(start, {});
  assert.deepEqual(observed,{XAGUSD:4});
  assert.equal(rememberPriceDigits(observed,[{symbol:'XAGUSD',bid:31.62,ask:31.65}]),observed);
  assert.equal(rememberPriceDigits(observed,[{symbol:'BAD',bid:NaN,ask:1},{symbol:'BAD',bid:1,ask:0.12345678}]),observed);
});
test('the price store retains precision across quote blanking and reconnect updates', () => {
  usePriceStore.setState({prices:{},digits:{}});
  usePriceStore.getState().applyTicks([{symbol:'XAGUSD',bid:31.6241,ask:31.6522,receivedAt:1}]);
  const observed = usePriceStore.getState().digits;
  assert.equal(observed.XAGUSD,4);
  usePriceStore.getState().clearPrices(['XAGUSD']);
  assert.deepEqual(usePriceStore.getState().prices,{});
  assert.equal(usePriceStore.getState().digits, observed);
  usePriceStore.getState().applyTicks([{symbol:'XAGUSD',bid:31.62,ask:31.65,receivedAt:2}]);
  usePriceStore.getState().touch(3);
  assert.equal(usePriceStore.getState().digits, observed);
  assert.equal(priceDigits('XAGUSD',undefined,observed.XAGUSD),4);
});
test('catalogue digit strings are normalized and malformed precision is ignored', () => {
  const values=['4',0,null,'',-1,1.5,9,'bad'];
  const rows=normalizeInstruments(values.map((digits,i)=>({symbol:'S'+i,digits})));
  assert.deepEqual(rows.map(row=>row.digits),[4,0,undefined,undefined,undefined,undefined,undefined,undefined]);
});
