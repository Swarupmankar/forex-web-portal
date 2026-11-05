import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root=new URL('../src/',import.meta.url),cache=new Map();
function local(file){
  if(cache.has(file))return cache.get(file);
  const source=ts.transpileModule(readFileSync(new URL(file,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const code=source.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,name)=>'from '+JSON.stringify(local(name.startsWith('@/')?name.slice(2)+'.ts':path.posix.join(path.posix.dirname(file),name)+'.ts')));
  const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(file,url);return url;
}
const {activityBuckets,awaitingMarketFill,quickMarketRequest,managementProgressLabel}=await import(local('lib/tradeExperience.ts'));
const {normalizeOrderlist,validateTrade}=await import(local('lib/contracts.ts'));
const {receiptDestination,confirmReceipt}=await import(local('lib/orderReceipt.ts'));
const {validateVolume,PRACTICE_VOLUME}=await import(local('lib/volume.ts'));
const {newPracticeAccount,placePractice,practiceMetrics,closePracticeVolume}=await import(local('lib/practice.ts'));

const now=Date.now(),request={symbol:'XAUUSD',orderType:'BUY',executionType:'MARKET',lotSize:.02};
const receipt={key:'market-1',startedAt:now,knownIds:[],request,status:'submitted',practice:false,awaitingFill:true};
const sending={id:8,...request,orderStatus:'SENDING',lotSize:'0',lotSizeStore:'0.02',createdAt:new Date(now).toISOString()};
const filled={...sending,orderStatus:'OPEN',lotSize:'0.02',orderDetails:{entryExecutionType:'MARKET',entryPrice:4000.3}};

test('market requests stay in Positions through sending, slow confirmation and a fill',()=>{
  for(const status of ['sending','submitted','checking','unconfirmed','open'])assert.equal(receiptDestination({...receipt,status}),'positions');
  const normalized=normalizeOrderlist({openOrders:[sending],pendingOrders:[]});
  assert.equal(normalized.openOrders.length,0,'unfilled requests must not enter account valuation');
  const activity=activityBuckets(normalized.openOrders,normalized.pendingOrders);
  assert.deepEqual(activity.positions,[sending]);assert.deepEqual(activity.pending,[]);
  assert.equal(confirmReceipt(receipt,[sending]).status,'submitted','showing the row must not imply a fill');
  const next=confirmReceipt(receipt,[filled]);
  assert.equal(next.status,'open');assert.equal(next.fillPrice,4000.3);
  assert.equal(receiptDestination(next),'positions');
  assert.deepEqual(activityBuckets([filled],[]).positions,[filled]);
});

test('Limit and Stop requests remain Pending until filled, including legacy order-type shapes',()=>{
  const rows=['BUY_LIMIT','SELL_LIMIT','BUY_STOP','SELL_STOP'].map((orderType,i)=>({...sending,id:20+i,executionType:undefined,orderType}));
  rows.push({...sending,id:24,orderDetails:{entryExecutionType:'LIMIT'}},{...sending,id:25,executionType:'STOP'});
  const original=structuredClone(rows);
  assert.deepEqual(activityBuckets([filled],rows),{positions:[filled],pending:rows});
  assert.deepEqual(rows,original);
  for(const executionType of ['LIMIT','STOP']){
    const pending={...receipt,request:{...request,executionType},status:'pending'};
    assert.equal(receiptDestination(pending),'pending');
    assert.equal(receiptDestination({...pending,status:'open'}),'positions');
  }
  assert.equal(awaitingMarketFill({...filled,orderStatus:'PENDING'}),false);
});

test('quick quote actions submit only market side and volume, with no hidden ticket protection or entry',()=>{
  for(const side of ['BUY','SELL']){
    assert.deepEqual(quickMarketRequest('EURUSD',side,'0.07'),{symbol:'EURUSD',orderType:side,executionType:'MARKET',lotSize:.07});
  }
  for(const input of ['','0','-1','0.015','not a number'])assert.ok(validateVolume(quickMarketRequest('XAUUSD','BUY',input).lotSize,PRACTICE_VOLUME));
});

test('quick market order, partial close and full close preserve fills, balance and margin in the local engine',()=>{
  const quotes={XAUUSD:{symbol:'XAUUSD',bid:4000,ask:4000.3,timestamp:now}};
  const deal=quickMarketRequest('XAUUSD','BUY','0.02');
  assert.equal(validateTrade(deal,quotes.XAUUSD),null);
  const initial=newPracticeAccount(),opened=placePractice(initial,deal,quotes,now),position=opened.orders[0];
  assert.equal(position.status,'OPEN');assert.equal(position.openPrice,4000.3);assert.equal(position.lotSize,.02);
  assert.equal(opened.balance,initial.balance);assert.ok(practiceMetrics(opened,quotes).margin>0);
  const reduced=closePracticeVolume(opened,position.id,.01,quotes,now+1);
  assert.equal(reduced.orders.find(o=>o.id===position.id).lotSize,.01);
  const closed=closePracticeVolume(reduced,position.id,.01,quotes,now+2);
  assert.equal(closed.orders.filter(o=>o.status==='OPEN').length,0);
  assert.equal(practiceMetrics(closed,quotes).margin,0);
  assert.ok(Math.abs(closed.balance-(initial.balance-.6))<1e-6);
  assert.equal(initial.orders.length,0,'execution must not mutate the previous account snapshot');
});

test('close progress distinguishes active checks from a timed-out unknown outcome',()=>{
  const result={command:{action:'close'},status:'sending'};
  assert.equal(managementProgressLabel(result),'Closing…');
  assert.equal(managementProgressLabel({...result,command:{action:'cancel'},status:'submitted'}),'Cancelling…');
  assert.equal(managementProgressLabel({...result,command:{action:'edit'}}),'Updating…');
  assert.equal(managementProgressLabel({...result,status:'checking'}),'Checking status…');
  assert.equal(managementProgressLabel({...result,status:'unconfirmed'}),'Status unconfirmed');
  for(const status of ['complete','rejected','changed'])assert.equal(managementProgressLabel({...result,status}),'');
});
