import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/indicators.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {sma,ema,bollinger,rsi,normalizeStudies}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const candles=values=>values.map((close,i)=>({time:1000+i*60,close,open:close,high:close,low:close}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('SMA and SMA-seeded EMA produce expected warm-up and closing-price values',()=>{
 const rows=candles([1,2,3,4,6]);
 assert.deepEqual(sma(rows,3).map(p=>p.value),[2,3,13/3]);
 assert.deepEqual(ema(rows,3).map(p=>p.value),[2,3,4.5]);
 assert.equal(sma(rows,20).length,0);assert.equal(ema(rows,0).length,0);
});
test('Bollinger uses population standard deviation and configurable multiplier',()=>{
 const bands=bollinger(candles([1,2,3,4]),3,2);
 near(bands.middle[0].value,2);near(bands.upper[0].value,2+2*Math.sqrt(2/3));near(bands.lower[0].value,2-2*Math.sqrt(2/3));
 const flat=bollinger(candles([4,4,4]),3);assert.equal(flat.upper[0].value,4);assert.equal(flat.lower[0].value,4);
});
test('Wilder RSI handles flat, monotonic and mixed price series without NaN',()=>{
 assert.equal(rsi(candles([1,2,3,4,5]),3)[0].value,100);
 assert.equal(rsi(candles([5,4,3,2,1]),3)[0].value,0);
 assert.equal(rsi(candles([4,4,4,4,4]),3)[0].value,50);
 const values=rsi(candles([1,2,1,3,2]),3);near(values[0].value,75);near(values[1].value,100-100/(1+(2/3)/(5/9)));
});
test('persisted study parameters are validated and do not leak unknown studies',()=>{
 const s=normalizeStudies({sma:{enabled:true,period:NaN},rsi:{enabled:true,period:1},bollinger:{enabled:true,period:10,deviation:99},unexpected:true});
 assert.equal(s.sma.period,20);assert.equal(s.rsi.period,14);assert.equal(s.bollinger.deviation,2);assert.equal(s.sma.enabled,true);assert.equal(Object.keys(s).length,4);
});
