import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const transpile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const contract=uri(transpile('../src/lib/contracts.ts'));
const engine=transpile('../src/lib/practice.ts').replace('"./contracts"',JSON.stringify(contract)).replace("'./contracts'",JSON.stringify(contract));
const {newPracticeAccount,placePractice,managePractice,settlePractice,practiceMetrics,practicePnl}=await import(uri(engine));
const now=100000;
const quotes=(bid=1.1,ask=1.1002)=>({EURUSD:{symbol:'EURUSD',bid,ask,timestamp:now}});
const buy={symbol:'EURUSD',orderType:'BUY',executionType:'MARKET',lotSize:0.1};
test('market fills at ask/bid, close realizes spread and cannot execute twice',()=>{
 const a=placePractice(newPracticeAccount(),buy,quotes(),now);
 assert.equal(a.orders[0].openPrice,1.1002);
 assert.equal(practiceMetrics(a,quotes()).equity,9998);
 const closed=managePractice(a,'P1','close',quotes(1.102,1.1022),{},now);
 assert.equal(closed.balance,10018);
 assert.equal(closed.orders[0].status,'CLOSED');
 assert.throws(()=>managePractice(closed,'P1','close',quotes(),{},now));
 const sell=placePractice(newPracticeAccount(),{...buy,orderType:'SELL'},quotes(),now);
 assert.equal(sell.orders[0].openPrice,1.1);
 assert.equal(practicePnl(sell.orders[0],quotes().EURUSD),-2);
});
test('pending trigger, take profit and cancellation are isolated and idempotent',()=>{
 let a=placePractice(newPracticeAccount(),{...buy,executionType:'LIMIT',limitPrice:1.09,tp:1.1},quotes(),now);
 assert.equal(settlePractice(a,quotes(),now).orders[0].status,'PENDING');
 a=settlePractice(a,quotes(1.0898,1.09),now);
 assert.equal(a.orders[0].status,'OPEN');
 a=settlePractice(a,quotes(1.101,1.1012),now);
 assert.equal(a.orders[0].reason,'Take profit');
 assert.equal(a.balance,10110);
 assert.equal(settlePractice(a,quotes(),now).balance,10110);
 const pending=placePractice(a,{...buy,executionType:'STOP',limitPrice:1.2},quotes(),now);
 assert.equal(managePractice(pending,'P2','cancel',quotes(),{},now).orders[0].status,'CANCELLED');
});
test('invalid volume, levels, quote age, symbol and excessive margin cannot alter balance',()=>{
 const a=newPracticeAccount();
 for(const r of [{...buy,lotSize:NaN},{...buy,lotSize:0.001},{...buy,sl:2},{...buy,symbol:'UNKNOWN'},{...buy,lotSize:100}]) assert.throws(()=>placePractice(a,r,quotes(),now));
 assert.throws(()=>placePractice(a,buy,quotes(),now+20000));
 assert.equal(a.balance,10000);assert.equal(a.orders.length,0);
});
test('USDJPY P&L is converted to USD; edits and stop loss obey direction',()=>{
 const q={USDJPY:{symbol:'USDJPY',bid:150,ask:150.02,timestamp:now}};
 let a=placePractice(newPracticeAccount(),{...buy,symbol:'USDJPY'},q,now);
 assert.equal(a.orders[0].margin,100);
 assert.equal(practicePnl(a.orders[0],{...q.USDJPY,bid:151,ask:151.02}),64.9);
 assert.throws(()=>managePractice(a,'P1','edit',q,{sl:160},now));
 a=managePractice(a,'P1','edit',q,{sl:149},now);
 a=settlePractice(a,{USDJPY:{...q.USDJPY,bid:148.98,ask:149}},now);
 assert.equal(a.orders[0].reason,'Stop loss');
});
test('insufficient margin at pending activation rejects once without creating exposure',()=>{
 let a=placePractice(newPracticeAccount(),{...buy,lotSize:5,executionType:'STOP',limitPrice:1.2},quotes(),now);
 a=placePractice(a,{...buy,lotSize:5,executionType:'STOP',limitPrice:1.2},quotes(),now);
 a=settlePractice(a,quotes(1.2,1.2002),now);
 assert.equal(a.orders.filter(o=>o.status==='OPEN').length,1);
 assert.equal(a.orders.filter(o=>o.status==='REJECTED').length,1);
});

test('chart SL/TP edits preserve the opposite level and reject invalid drops',async()=>{
 const {movePracticeLevel}=await import(uri(engine));
 let a=placePractice(newPracticeAccount(),{...buy,sl:1.08,tp:1.2},quotes(),now);
 a=movePracticeLevel(a,'P1','sl',1.09,quotes(),now);
 assert.equal(a.orders[0].sl,1.09);assert.equal(a.orders[0].tp,1.2);
 assert.throws(()=>movePracticeLevel(a,'P1','sl',1.3,quotes(),now));
 assert.equal(a.orders[0].sl,1.09);
 a=movePracticeLevel(a,'P1','tp',undefined,quotes(),now);
 assert.equal(a.orders[0].tp,undefined);assert.equal(a.orders[0].sl,1.09);
 assert.throws(()=>movePracticeLevel(a,'P1','entry',1.0,quotes(),now));
});
test('pending chart entry can move only while pending and must retain valid type and exit levels',async()=>{
 const {movePracticeLevel,pendingAtPrice}=await import(uri(engine));
 assert.equal(pendingAtPrice('BUY',1,1.1),'LIMIT');assert.equal(pendingAtPrice('BUY',1.2,1.1),'STOP');assert.equal(pendingAtPrice('SELL',1.2,1.1),'LIMIT');assert.equal(pendingAtPrice('SELL',1,1.1),'STOP');
 let a=placePractice(newPracticeAccount(),{...buy,executionType:'LIMIT',limitPrice:1.09,sl:1.07,tp:1.15},quotes(),now);
 a=movePracticeLevel(a,'P1','entry',1.08,quotes(),now);assert.equal(a.orders[0].openPrice,1.08);assert.equal(a.orders[0].limitPrice,1.08);
 assert.throws(()=>movePracticeLevel(a,'P1','entry',1.2,quotes(),now));
 assert.throws(()=>movePracticeLevel(a,'P1','entry',1.06,quotes(),now));
 a=settlePractice(a,quotes(1.0798,1.08),now);assert.equal(a.orders[0].status,'OPEN');
 assert.throws(()=>movePracticeLevel(a,'P1','entry',1.09,quotes(),now));
});
test('partial close realizes only the closed volume and keeps the remainder open',async()=>{
 const {closePracticeVolume}=await import(uri(engine));
 let a=placePractice(newPracticeAccount(),{...buy,lotSize:0.3,sl:1.05},quotes(),now);
 const margin=a.orders[0].margin;
 a=closePracticeVolume(a,'P1',0.1,quotes(1.102,1.1022),now);
 const [record,rest]=a.orders;
 assert.equal(record.status,'CLOSED');assert.equal(record.lotSize,0.1);assert.equal(record.pnl,18);assert.equal(record.id,'P2');
 assert.equal(rest.id,'P1');assert.equal(rest.status,'OPEN');assert.equal(rest.lotSize,0.2);assert.equal(rest.sl,1.05);
 assert.equal(Math.round((record.margin+rest.margin)*100)/100,margin);
 assert.equal(a.balance,10018);
 assert.throws(()=>closePracticeVolume(a,'P1',0.5,quotes(),now));
 assert.throws(()=>closePracticeVolume(a,'P1',0.005,quotes(),now));
 a=closePracticeVolume(a,'P1',0.2,quotes(),now);
 assert.equal(a.orders.find(o=>o.id==='P1').status,'CLOSED');
 assert.equal(a.orders.filter(o=>o.status==='OPEN').length,0);
});
test('bulk close filters by result and symbol, and cancels pending orders',async()=>{
 const {closePracticeMany}=await import(uri(engine));
 const q={EURUSD:{symbol:'EURUSD',bid:1.1,ask:1.1002,timestamp:now},USDJPY:{symbol:'USDJPY',bid:150,ask:150.02,timestamp:now}};
 let a=placePractice(newPracticeAccount(),buy,q,now);
 a=placePractice(a,{...buy,orderType:'SELL'},q,now);
 a=placePractice(a,{...buy,symbol:'USDJPY'},q,now);
 a=placePractice(a,{...buy,executionType:'LIMIT',limitPrice:1.09},q,now);
 const up={...q,EURUSD:{...q.EURUSD,bid:1.102,ask:1.1022}};
 let r=closePracticeMany(a,'profitable',up,'EURUSD',now);
 assert.equal(r.done,1);assert.equal(r.account.orders.find(o=>o.id==='P1').status,'CLOSED');assert.equal(r.account.orders.find(o=>o.id==='P2').status,'OPEN');
 r=closePracticeMany(r.account,'losing',up,undefined,now);
 assert.equal(r.done,2);
 r=closePracticeMany(r.account,'pending',up,undefined,now);
 assert.equal(r.done,1);assert.equal(r.account.orders.find(o=>o.id==='P4').status,'CANCELLED');
 assert.equal(r.account.orders.filter(o=>o.status==='OPEN'||o.status==='PENDING').length,0);
 const stale=closePracticeMany(a,'all',{},undefined,now);
 assert.equal(stale.done,0);assert.equal(stale.skipped,3);assert.equal(stale.account,a);
});
test('stop-out closes the largest loser first and stops once margin level recovers',async()=>{
 const q=(e,x)=>({EURUSD:{symbol:'EURUSD',bid:e,ask:e+0.0002,timestamp:now},XAUUSD:{symbol:'XAUUSD',bid:x,ask:x+0.2,timestamp:now}});
 let a=placePractice(newPracticeAccount(),{symbol:'EURUSD',orderType:'BUY',executionType:'MARKET',lotSize:7},q(1.1,2600),now);
 a=placePractice(a,{symbol:'XAUUSD',orderType:'BUY',executionType:'MARKET',lotSize:0.5},q(1.1,2600),now);
 // EURUSD drops 100 pips (-7,140 on 7 lots), gold is flat: equity 2,850 is under 50% of 9,001 margin.
 const after=settlePractice(a,q(1.09,2600),now);
 const eur=after.orders.find(o=>o.symbol==='EURUSD'),xau=after.orders.find(o=>o.symbol==='XAUUSD');
 assert.equal(eur.status,'CLOSED');assert.equal(eur.reason,'Practice margin stop-out');
 assert.equal(xau.status,'OPEN');
 assert.ok(after.balance>=0);
});
test('balance is floored at zero and history is capped without touching open orders',async()=>{
 const {trimHistory}=await import(uri(engine));
 const q=e=>({EURUSD:{symbol:'EURUSD',bid:e,ask:e+0.0002,timestamp:now}});
 let a=placePractice(newPracticeAccount(),{symbol:'EURUSD',orderType:'BUY',executionType:'MARKET',lotSize:8},q(1.1),now);
 a=settlePractice(a,q(0.95),now);
 assert.equal(a.balance,0);assert.match(a.orders[0].reason,/balance protected/);
 const many={...newPracticeAccount(),orders:[{id:'O',status:'OPEN'},...Array.from({length:5},(_,i)=>({id:'C'+i,status:'CLOSED'})),{id:'Pd',status:'PENDING'}]};
 const t=trimHistory(many,2);
 assert.deepEqual(t.orders.map(o=>o.id),['O','C0','C1','Pd']);
 assert.equal(trimHistory(t,2),t);
});
