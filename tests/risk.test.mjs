import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const transpile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {moneyAt,orderRisk,lotsForRisk}=await import('data:text/javascript;base64,'+Buffer.from(transpile('../src/lib/risk.ts')).toString('base64'));
test('money at price follows side and converts USD-based quotes',()=>{
 assert.equal(moneyAt('EURUSD','BUY',0.1,100000,1.1,1.101),10);
 assert.equal(moneyAt('EURUSD','SELL',0.1,100000,1.1,1.101),-10);
 assert.equal(moneyAt('USDJPY','BUY',1,100000,150,151),662.25);
 assert.equal(moneyAt('EURGBP','BUY',1,100000,0.85,0.86),undefined);
 assert.equal(moneyAt('EURUSD','BUY',0,100000,1.1,1.2),undefined);
});
test('order risk reports loss at stop, gain at target, reward:risk and margin',()=>{
 const r=orderRisk({symbol:'XAUUSD',orderType:'BUY',executionType:'MARKET',lotSize:0.1,sl:2660,tp:2700},2670,100,100);
 assert.equal(r.atStop,-100);assert.equal(r.atTarget,300);assert.equal(r.rewardRisk,3);assert.equal(r.margin,267);
 const pending=orderRisk({symbol:'EURUSD',orderType:'SELL',executionType:'LIMIT',limitPrice:1.12,lotSize:1},1.1,100000,100);
 assert.equal(pending.entry,1.12);assert.equal(pending.atStop,undefined);assert.equal(pending.margin,1120);
 assert.deepEqual(orderRisk({symbol:'EURUSD',orderType:'BUY',executionType:'MARKET',lotSize:1},undefined,100000),{entry:undefined});
});
test('position sizing floors to the lot step and refuses a stop on the wrong side',()=>{
 assert.equal(lotsForRisk('EURUSD','BUY',100,100000,1.1,1.095),0.2);
 assert.equal(lotsForRisk('EURUSD','BUY',99,100000,1.1,1.095),0.19);
 assert.equal(lotsForRisk('EURUSD','BUY',100,100000,1.1,1.105),undefined);
 assert.equal(lotsForRisk('EURUSD','BUY',1,100000,1.1,1.095),undefined);
});
