import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const url = code => 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const source = name => ts.transpileModule(readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const pnlUrl=url(source('positionPnl'));
const {nextSettlement,settledCash,settlementPending,SETTLE_MS}=await import(url(source('accountSettlement').replace("'./positionPnl'",JSON.stringify(pnlUrl))));
const {accountFigures}=await import(pnlUrl);
const order=(margin=20,id=1)=>({id,tradingAccountId:7,marginInUse:margin,symbol:'XAUUSD',orderType:'BUY',entryPrice:4000,contractSize:100,lotSize:.01});
const snapshot=(balance,openOrders=[])=>({balance,openOrders});
const figures=(s,list,now)=>accountFigures(list,settledCash(s,now),{XAUUSD:{bid:4000,ask:4000.3}},7);
test('open before cash settles reserves margin without inflating displayed balance',()=>{
 let list=snapshot(1000), s=nextSettlement(undefined,list,7,0);
 list=snapshot(1000,[order()]); s=nextSettlement(s,list,7,1000);
 assert.equal(settledCash(s,1000),980); assert.equal(settlementPending(s,1000),true);
 assert.equal(figures(s,list,1000).balance,1000); assert.equal(figures(s,list,1000).freeMargin,980);
 list=snapshot(980,[order()]); s=nextSettlement(s,list,7,25000);
 assert.equal(settlementPending(s,25000),false); assert.equal(figures(s,list,25000).balance,1000);
});
test('partial and full closes bridge released margin until authoritative cash arrives',()=>{
 let s=nextSettlement(undefined,snapshot(960,[order(40)]),7,0);
 let list=snapshot(960,[order(20)]); s=nextSettlement(s,list,7,1000);
 assert.equal(figures(s,list,1000).balance,1000);
 list=snapshot(960); s=nextSettlement(s,list,7,2000);
 assert.equal(figures(s,list,2000).balance,1000);
 s=nextSettlement(s,snapshot(1005),7,30000);
 assert.equal(settledCash(s,30000),1005); assert.equal(s.pending,0);
});
test('cash-first settlement does not add released margin twice',()=>{
 let s=nextSettlement(undefined,snapshot(980,[order()]),7,0);
 s=nextSettlement(s,snapshot(1003,[order()]),7,1000);
 s=nextSettlement(s,snapshot(1003),7,2000);
 assert.equal(settledCash(s,2000),1003); assert.equal(s.pending,0);
});
test('bridge expires, repeated reads do not extend it, and a new account starts clean',()=>{
 let s=nextSettlement(undefined,snapshot(1000),7,0);
 s=nextSettlement(s,snapshot(1000,[order()]),7,1000);
 s=nextSettlement(s,snapshot(1000,[order()]),7,10000);
 assert.equal(s.since,1000);
 assert.equal(settledCash(s,1000+SETTLE_MS),1000);
 assert.equal(settlementPending(s,1000+SETTLE_MS),false);
 const switched=nextSettlement(s,snapshot(500),8,11000);
 assert.equal(settledCash(switched,11000),500); assert.equal(switched.pending,0);
});
test('foreign rows cannot change this accounts bridge and missing margin is not released money',()=>{
 const foreign={...order(500,2),tradingAccountId:8};
 let s=nextSettlement(undefined,snapshot(980,[order(),foreign]),7,0);
 assert.deepEqual(s.margins,{'1':20});
 s=nextSettlement(s,snapshot(980,[order()]),7,1000);
 assert.equal(s.pending,0);
 assert.equal(nextSettlement(s,snapshot(980,[{...order(),marginInUse:undefined}]),7,2000),undefined);
 assert.equal(nextSettlement(s,snapshot(''),7,2000),undefined);
});

test('a later trade cannot revive an already expired adjustment',()=>{
 let s=nextSettlement(undefined,snapshot(1000),7,0);
 s=nextSettlement(s,snapshot(1000,[order(20)]),7,1000);
 s=nextSettlement(s,snapshot(1000,[order(20),order(10,2)]),7,60000);
 assert.equal(s.pending,-10); assert.equal(settledCash(s,60000),990);
});
