// Run the real RTK middleware and mutation lifecycle against a mock engine/read API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configureStore } from '@reduxjs/toolkit';
import ts from 'typescript';
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const source=path=>ts.transpileModule(readFileSync(new URL('../src/'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
let sequence=0;
async function setup() {
  const nonce=`\n// ${++sequence}`;
  const fixtures=uri(`export const state={generation:1,activeId:'a',accounts:[{id:'a',tradingAccountId:77}]};
    export const observed=[];
    export const useAccountStore={getState:()=>state};
    export const tradingToken=()=>'fixture-token';
    export const useUIStore={getState:()=>({isAuthenticated:false})};
    export const useAccountValuation={getState:()=>({observe:(...args)=>observed.push(args)})};`+nonce);
  const toolkit=uri(`import {createRequire} from 'node:module';
    const require=createRequire(${JSON.stringify(import.meta.url)});
    export const {createApi,fetchBaseQuery}=require('@reduxjs/toolkit/query/react');`);
  const imports={
    '@/store/useUIStore':fixtures,'@/store/useAccountStore':fixtures,'@/store/useAccountValuation':fixtures,
    '@/lib/contracts':uri(source('lib/contracts.ts')),'@/lib/executionRefresh':uri(source('lib/executionRefresh.ts')),
    '@reduxjs/toolkit/query/react':toolkit,
  };
  let code=source('store/api/tradingApi.ts');
  for(const [key,value] of Object.entries(imports))code=code.replaceAll(`'${key}'`,JSON.stringify(value)).replaceAll(`"${key}"`,JSON.stringify(value));
  const {tradingApi:api,refreshTradingState}=await import(uri(code+nonce));
  const store=configureStore({reducer:{[api.reducerPath]:api.reducer},middleware:getDefault=>getDefault().concat(api.middleware)});
  return {api,store,refreshTradingState,...await import(fixtures)};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const waitFor=async(predicate)=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}assert.ok(predicate(),'condition did not become true');};
const NativeRequest=globalThis.Request, originalFetch=globalThis.fetch;
test.beforeEach(()=>{
  globalThis.Request=class extends NativeRequest {
    constructor(input,init){super(typeof input==='string'&&input.startsWith('/')?'https://terminal.test'+input:input,init);}
  };
});
test.afterEach(()=>{globalThis.Request=NativeRequest;globalThis.fetch=originalFetch;});
const order={symbol:'XAUUSD',orderType:'BUY',executionType:'MARKET',lotSize:0.01};

test('accepted mutation refreshes positions despite an unrelated pending chart, then gets past a pre-order snapshot',async()=>{
  const {api,store,state,observed}=await setup();const chart=deferred(),oldOrders=deferred();
  let posts=0,reads=0,accountReads=0;
  globalThis.fetch=async request=>{
    if(request.url.includes('/chart/history'))return chart.promise;
    if(request.url.endsWith('/place-order')){posts++;return Response.json({orderId:42},{status:202});}
    if(request.url.endsWith('/trading/account')){accountReads++;return Response.json({id:77,balance:1000});}
    if(request.url.endsWith('/orders')){
      reads++;return reads===1?oldOrders.promise:Response.json({openOrders:[{id:42,tradingAccountId:77,orderStatus:'OPEN',symbol:'XAUUSD',lotSize:'.01',orderDetails:{entryPrice:'4000'}}],pendingOrders:[]});
    }
    throw new Error('Unexpected request '+request.url);
  };
  const slowChart=store.dispatch(api.endpoints.getHistoricalChart.initiate({symbol:'XAUUSD',tf:'M1'}));
  const old=store.dispatch(api.endpoints.getOpenOrders.initiate());
  try {
    await waitFor(()=>reads===1);
    const result=await store.dispatch(api.endpoints.placeOrder.initiate({order,idempotencyKey:'one-intent-only'})).unwrap();
    assert.equal(result.accepted,true);
    await waitFor(()=>accountReads>0); // No wait for the chart's cache invalidation queue.
    assert.equal(api.endpoints.getHistoricalChart.select({symbol:'XAUUSD',tf:'M1'})(store.getState()).status,'pending');
    assert.equal(api.endpoints.getOpenOrders.select()(store.getState()).data,undefined); // 202 is not a fill.
    oldOrders.resolve(Response.json({openOrders:[],pendingOrders:[]}));
    await old;
    await waitFor(()=>api.endpoints.getOpenOrders.select()(store.getState()).data?.openOrders?.[0]?.id===42);
    assert.equal(reads,2);assert.equal(posts,1);assert.equal(observed.at(-1)[0].openOrders[0].id,42);
  } finally {
    state.generation++;chart.resolve(Response.json({candles:[]}));await slowChart;
    old.unsubscribe();slowChart.unsubscribe();store.dispatch(api.util.resetApiState());
  }
});

test('a late execution response after account switch cannot refresh or publish into the new account',async()=>{
  const {api,store,state,observed}=await setup();const execution=deferred();let reads=0,posts=0;
  globalThis.fetch=async request=>{
    if(request.url.endsWith('/place-order')){posts++;return execution.promise;}
    reads++;return Response.json({openOrders:[],pendingOrders:[]});
  };
  const task=store.dispatch(api.endpoints.placeOrder.initiate({order,idempotencyKey:'previous-account'}));
  await waitFor(()=>posts===1);state.generation++;
  execution.resolve(Response.json({orderId:42},{status:202}));
  const result=await task;
  assert.equal(result.error.status,'CUSTOM_ERROR');assert.equal(reads,0);assert.equal(observed.length,0);
  store.dispatch(api.util.resetApiState());
});

test('socket and HTTP acknowledgement share one reader; read failures never replay the mutation',async()=>{
  const {api,store,state,refreshTradingState}=await setup();const orders=deferred(),account=deferred();
  let orderReads=0,accountReads=0,posts=0;
  globalThis.fetch=async request=>{
    if(request.url.endsWith('/place-order')){posts++;return Response.json({message:'outcome unknown'},{status:504});}
    if(request.url.endsWith('/orders')){orderReads++;return orders.promise;}
    if(request.url.endsWith('/trading/account')){accountReads++;return account.promise;}
    throw new Error('Unexpected request');
  };
  try {
    await store.dispatch(api.endpoints.placeOrder.initiate({order,idempotencyKey:'never-replay'}));
    await waitFor(()=>orderReads===1&&accountReads===1);
    store.dispatch(refreshTradingState());store.dispatch(refreshTradingState());
    await new Promise(r=>setTimeout(r,25));
    assert.equal(orderReads,1);assert.equal(accountReads,1);assert.equal(posts,1);
  } finally {
    state.generation++;
    orders.resolve(Response.json({message:'unavailable'},{status:503}));account.resolve(Response.json({message:'unavailable'},{status:503}));
    await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
    store.dispatch(api.util.resetApiState());
  }
});
