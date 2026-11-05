import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const url = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const source = path => ts.transpileModule(readFileSync(new URL('../src/' + path, import.meta.url),'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const contractsUrl = url(source('lib/contracts.ts'));
const { validateTrade } = await import(contractsUrl);
const { chartOrders, validateOrderChanges, historyRows, totalProfit, orderEntry } = await import(url(source('lib/connectedOrders.ts').replace('"./contracts"', JSON.stringify(contractsUrl)).replace("'./contracts'", JSON.stringify(contractsUrl))));
const { normalizeCandles, applyTick, reconcileBars } = await import(url(source('lib/chart.ts')));
const { candleStart, candleEnd, FEED_TIMEFRAMES } = await import(url(source('lib/chartTime.ts')));
const { bindingFromAccount, trustedService, resolveSessionServices, cacheAccountServices } = await import(url(source('lib/server/sessionServices.ts')));
const env = { NEXT_PUBLIC_ENGINE_URL: 'https://engine.example/broker/a/real', NEXT_PUBLIC_PRICEFEED_URL: 'https://feed.example/broker/a/real' };
const config = { backend: new URL('https://api.example/platform/'), engine: env.NEXT_PUBLIC_ENGINE_URL };
const direct = (id, path = '/broker/a/real') => ({ id, tradingUsername: String(id), accountType: 'REAL', serverUrl: 'https://engine.example' + path, priceFeedUrl: 'https://feed.example' + path });

test('bid candle tuples match mobile, are not scaled again, and reject malformed OHLC', () => {
  assert.deepEqual(normalizeCandles({ candles: [[1793264400000, 4000, 4002, 3999, 4001, 4000.3, 4002.3, 3999.3, 4001.3, 10], [1793264460000, 4000, 3998, 4001, 4002]] }), [{ time: 1793264400, open: 4000, high: 4002, low: 3999, close: 4001 }]);
  assert.deepEqual(normalizeCandles({candles: []}), []);
});
test('all 11 periods follow mobile NY-close calendar across DST, week and month', () => {
  assert.equal(Object.keys(FEED_TIMEFRAMES).length, 11);
  const iso = (tf, at) => new Date(candleStart(tf, Date.parse(at))).toISOString();
  assert.equal(iso('D1','2026-10-29T12:00:00Z'), '2026-10-28T21:00:00.000Z');
  assert.equal(iso('H4','2026-10-29T12:00:00Z'), '2026-10-29T09:00:00.000Z');
  assert.equal(iso('D1','2026-11-03T12:00:00Z'), '2026-11-02T22:00:00.000Z');
  assert.equal(iso('W1','2026-10-29T12:00:00Z'), '2026-10-25T21:00:00.000Z');
  assert.equal(iso('MN1','2026-10-29T12:00:00Z'), '2026-09-30T21:00:00.000Z');
  for (const tf of Object.values(FEED_TIMEFRAMES)) {
    for (const at of ['2026-03-08T08:00:00Z','2026-11-01T07:00:00Z','2026-10-31T23:00:00Z']) {
      const t=Date.parse(at); assert.ok(candleStart(tf,t)<=t); assert.ok(candleEnd(tf,t)>t);
    }
  }
});
test('live H4 and recovered candles stay in the same server candle', () => {
  const t=Date.parse('2026-10-29T12:00:00Z')/1000, start=candleStart('H4',t*1000)/1000;
  const history=[{time:start,open:4000,high:4002,low:3999,close:4001}];
  const live={bars:history.slice(),newest:-Infinity};
  applyTick(live,4003,t,14400,20000,time=>candleStart('H4',time*1000)/1000);
  assert.equal(live.bars.length,1); assert.equal(live.bars[0].high,4003);
  assert.equal(reconcileBars(history,live.bars)[0].close,4003);
  assert.equal(applyTick(live,3990,start - 1,14400,20000,time=>candleStart('H4',time*1000)/1000),undefined);
  assert.equal(live.bars[0].low,3999);
});
test('market SL is validated against liquidation bid/ask; pending entry follows execution side', () => {
  const order={symbol:'XAUUSD',orderType:'BUY',executionType:'MARKET',lotSize:.01,sl:4000.2};
  const q={bid:4000,ask:4000.3};
  assert.match(validateTrade(order,q), /below/);
  assert.equal(validateTrade({...order,sl:3999},q),null);
  assert.match(validateTrade({...order,orderType:'SELL',sl:4000.2},q), /above/);
  assert.equal(validateTrade({...order,executionType:'LIMIT',limitPrice:3998,sl:3997},q),null);
  assert.match(validateTrade({...order,executionType:'LIMIT',limitPrice:4001,sl:3997},q), /wrong side/);
});
test('connected chart recognizes the actual pending entry contract and blocks SENDING edits', () => {
  const order={id:42,symbol:'XAUUSD',orderType:'BUY',orderStatus:'PENDING',lotSize:'0.01',sl:'3990',tp:'4020',orderDetails:{entrylimit:'3998',entryExecutionType:'LIMIT'}};
  const view=chartOrders([order,{...order,id:43,orderStatus:'SENDING'}]);
  assert.equal(view.length,1); assert.equal(view[0].openPrice,3998); assert.equal(view[0].executionType,'LIMIT');
  assert.equal(validateOrderChanges(order,{limitPrice:3997},{bid:4000,ask:4000.3}),null);
  assert.match(validateOrderChanges(order,{limitPrice:4001},{bid:4000,ask:4000.3}),/wrong side/);
  assert.match(validateOrderChanges(order,{sl:0},{bid:4000,ask:4000.3}),/greater than zero/);
  assert.match(validateOrderChanges({...order,orderStatus:'SENDING'},{sl:3991},{bid:4000,ask:4000.3}),/no longer/);
  assert.match(validateOrderChanges({...order,orderStatus:'OPEN'},{limitPrice:3997},{bid:4000,ask:4000.3}),/Only a pending/);
});
test('full and partial history use each exit and deduplicate overlapping backend arrays', () => {
  const order={id:1006011,symbol:'XAUUSD',orderType:'SELL',lotSize:'0',lotSizeStore:'0.02',createdAt:'2026-10-29T09:52:16Z',pnl:-3,orderDetails:{entryPrice:'4026.24',orderExitEntries:[
    {id:1,exitPrice:'4028.28',exitLotSize:'0.01',pnl:'-2.04',createdAt:'2026-10-29T09:54:00Z'},
    {id:2,exitPrice:'4027.20',exitLotSize:'0.01',pnl:'-0.96',createdAt:'2026-10-29T09:55:00Z'}
  ]}};
  const rows=historyRows({fullyCompletedOrders:[order],completedOrders:[order],partiallyCompletedOrders:[order]});
  assert.equal(rows.length,2); assert.equal(rows[0].exitRowId,'1006011:2');
  assert.equal(rows[1].orderDetails.exitPrice,'4028.28'); assert.equal(rows[1].closedAt,'2026-10-29T09:54:00Z'); assert.equal(rows[1].lotSize,'0.01'); assert.equal(rows[1].pnl,'-2.04');
});
test('routing requires authoritative complete account services and approved origins', () => {
  assert.equal(bindingFromAccount(direct(1),config,env).engineBase,env.NEXT_PUBLIC_ENGINE_URL);
  assert.equal(bindingFromAccount(direct(2,'/broker/b/demo'),config,env).pricefeedBase,'https://feed.example/broker/b/demo');
  assert.equal(bindingFromAccount({...direct(1),priceFeedUrl:null},config,env),null);
  assert.equal(bindingFromAccount({brokerId:1,serverId:1,accountType:'REAL'},config,env),null);
  assert.equal(trustedService('https://evil.example/token',env),null);
  assert.equal(trustedService('https://user:password@engine.example',env),null);
  assert.equal(trustedService('http://engine.example',env),null);
  assert.equal(trustedService('https://engine.example/path?token=x',env),null);
  assert.equal(bindingFromAccount({brokerId:2,serverId:3,accountType:'REAL',Server:{id:4,accountType:'REAL',url:env.NEXT_PUBLIC_ENGINE_URL,priceFeedUrl:env.NEXT_PUBLIC_PRICEFEED_URL}},config,env),null);
});
test('server routing caches by session, never by last selected broker or browser input', async () => {
  const original=globalThis.fetch; const calls=[];
  globalThis.fetch=async (url,init)=>{calls.push({url:String(url),auth:init.headers.Authorization}); return new Response(JSON.stringify(direct(init.headers.Authorization.endsWith('A')?1:2,init.headers.Authorization.endsWith('A')?'/broker/a/real':'/broker/b/real')));};
  try {
    const a=await resolveSessionServices('Bearer isolated-A',config,env), b=await resolveSessionServices('Bearer isolated-B',config,env);
    assert.notEqual(a.engineBase,b.engineBase);
    assert.equal((await resolveSessionServices('Bearer isolated-A',config,env)).engineBase,a.engineBase);
    assert.equal(calls.length,2); assert.ok(calls.every(c=>c.url==='https://api.example/platform/v1/users/trading/account'));
    await assert.rejects(resolveSessionServices(null,config,env));
  } finally {globalThis.fetch=original;}
});

test('account reads warm routing, remain session/config scoped, and retain the 60 second expiry', async () => {
  const original=globalThis.fetch, now=Date.now; let reads=0, time=now();
  globalThis.fetch=async()=>{reads++;return Response.json(direct(7));};
  Date.now=()=>time;
  try {
    cacheAccountServices('Bearer warm',direct(6),config,env);
    assert.equal((await resolveSessionServices('Bearer warm',config,env)).accountId,'6');
    assert.equal(reads,0);
    await resolveSessionServices('Bearer different-session',config,env);
    await resolveSessionServices('Bearer warm',{...config,backend:new URL('https://second.example/platform/')},env);
    assert.equal(reads,2);
    time+=60001;
    assert.equal((await resolveSessionServices('Bearer warm',config,env)).accountId,'7');
    assert.equal(reads,3);
  } finally {globalThis.fetch=original;Date.now=now;}
});

test('routing coalesces concurrent discovery and cannot overwrite a newer authoritative account read', async () => {
  const original=globalThis.fetch; let release, reads=0;
  globalThis.fetch=()=>{reads++;return new Promise(resolve=>{release=()=>resolve(Response.json(direct(1)));});};
  try {
    const a=resolveSessionServices('Bearer concurrent',config,env);
    const b=resolveSessionServices('Bearer concurrent',config,env);
    assert.equal(reads,1);
    cacheAccountServices('Bearer concurrent',direct(2,'/broker/b/demo'),config,env);
    release();
    assert.equal((await a).accountId,'2');assert.equal((await b).accountId,'2');
    assert.equal((await resolveSessionServices('Bearer concurrent',config,env)).accountId,'2');
    const old=resolveSessionServices('Bearer invalidated',config,env);
    cacheAccountServices('Bearer invalidated',{...direct(1),serverUrl:'https://untrusted.example'},config,env);
    release();await assert.rejects(old,/not configured/);
  } finally {globalThis.fetch=original;}
});

test('invalid account snapshots and changed trust configuration cannot reuse a cached route; failed discovery can recover', async () => {
  const original=globalThis.fetch; let reads=0;
  globalThis.fetch=async()=>{reads++;return Response.json(direct(1));};
  try {
    cacheAccountServices('Bearer revoked',direct(1),config,env);
    cacheAccountServices('Bearer revoked',null,config,env);
    await resolveSessionServices('Bearer revoked',config,env);
    assert.equal(reads,1);
    await assert.rejects(resolveSessionServices('Bearer revoked',config,{}),/not configured/);
    globalThis.fetch=async()=>new Response(null,{status:503});
    await assert.rejects(resolveSessionServices('Bearer recover',config,env),/Unable to verify/);
    globalThis.fetch=async()=>Response.json(direct(3));
    assert.equal((await resolveSessionServices('Bearer recover',config,env)).accountId,'3');
  } finally {globalThis.fetch=original;}
});

test('pending entry shifts preserve SL/TP distances for all four order types', async () => {
  const {shiftPendingEntry}=await import(contractsUrl);
  const q={bid:4000,ask:4000.3};
  for(const [side,kind,entry,next] of [['BUY','LIMIT',3990,3980],['BUY','STOP',4010,4020],['SELL','LIMIT',4010,4020],['SELL','STOP',3990,3980]]) {
    const sign=side==='BUY'?1:-1;
    const raw={id:5,symbol:'XAUUSD',orderType:side,executionType:kind,orderStatus:'PENDING',lotSize:0.02,limitPrice:entry,sl:entry-sign*5,tp:entry+sign*10};
    const changes=shiftPendingEntry(entry,next,raw,2);
    assert.deepEqual(changes,{limitPrice:next,sl:next-sign*5,tp:next+sign*10});
    assert.equal(validateOrderChanges(raw,changes,q),null);
    assert.equal(raw.limitPrice,entry);
    assert.match(validateOrderChanges({...raw,orderStatus:'OPEN'},changes,q),/Only a pending/);
  }
  assert.deepEqual(shiftPendingEntry(31.6241,31.6242,{sl:31.62},4),{limitPrice:31.6242,sl:31.6201});
  assert.deepEqual(shiftPendingEntry(31.6241,31.6242,{},4),{limitPrice:31.6242});
});

test('missing per-exit profit and volume cannot duplicate an order aggregate',()=>{
 const order={id:1,lotSize:0,lotSizeStore:'.02',orderStatus:'COMPLETED',pnl:12,orderDetails:{orderExitEntries:[{id:1,pnl:5,exitLotSize:'.01'},{id:2}]}};
 const rows=historyRows({fullyCompletedOrders:[order]});
 const missing=rows.find(r=>r.exitRowId==='1:2');
 assert.equal(missing.pnl,null); assert.equal(missing.lotSize,undefined);
 assert.ok(Number.isNaN(totalProfit(rows)));
 assert.equal(totalProfit([{pnl:5},{pnl:999,orderStatus:'CANCELLED'}]),5);
});
test('authoritative completed exit wins over a duplicate partial record, retaining swap and reason',()=>{
 const order={id:1,orderStatus:'COMPLETED',orderDetails:{orderExitEntries:[{id:3,pnl:12,swap:-.2,closeReason:'TP',exitLotSize:'.01',createdAt:'2026-11-03T10:00:00Z'}]}};
 const stale={...order,orderStatus:'OPEN',orderDetails:{orderExitEntries:[{id:3,pnl:9}]}};
 const [row]=historyRows({fullyCompletedOrders:[order],partiallyCompletedOrders:[stale]});
 assert.equal(row.pnl,12); assert.equal(row.swap,-.2); assert.equal(row.closeReason,'TP');
 assert.equal(row.closedAt,'2026-11-03T10:00:00Z'); assert.equal(row.orderStatus,'COMPLETED');
});
test('object-shaped single exits and legacy rows remain readable; cancelled entry is not a fill',()=>{
 const rows=historyRows({fullyCompletedOrders:[{id:1,orderStatus:'COMPLETED',pnl:3,lotSizeStore:'.01',orderDetails:{orderExitEntries:{id:2,exitPrice:4002}}},{id:3,lotSizeStore:'.02',updatedAt:'2026-11-03T10:00:00Z',orderDetails:{exitPrice:4001}}],cancelledOrders:[{id:4,orderStatus:'CANCELLED',orderDetails:{entrylimit:3990}}]});
 assert.equal(rows.length,3);
 assert.equal(rows.find(r=>r.id===1).pnl,3);
 assert.equal(rows.find(r=>r.id===3).lotSize,'.02');
 assert.equal(orderEntry(rows.find(r=>r.id===4)),3990);
 assert.equal(rows.find(r=>r.id===4).orderDetails.exitPrice,undefined);
});
