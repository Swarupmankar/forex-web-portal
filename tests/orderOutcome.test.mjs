import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const transpile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {classifyFailure,findSubmittedOrder}=await import('data:text/javascript;base64,'+Buffer.from(transpile('../src/lib/orderOutcome.ts')).toString('base64'));
test('timeouts and lost responses are unknown; validation, auth and gates are rejections',()=>{
 assert.equal(classifyFailure({status:504,data:{outcome:'unknown'}}),'unknown');
 assert.equal(classifyFailure({status:502}),'unknown');
 assert.equal(classifyFailure({status:500}),'unknown');
 assert.equal(classifyFailure({status:422,data:{outcome:'not_sent'}}),'rejected');
 assert.equal(classifyFailure({status:400,data:{outcome:'rejected'}}),'rejected');
 assert.equal(classifyFailure({status:'FETCH_ERROR'}),'unknown');
 assert.equal(classifyFailure({status:'TIMEOUT_ERROR'}),'unknown');
 assert.equal(classifyFailure({status:503,data:{outcome:'not_sent'}}),'rejected');
 assert.equal(classifyFailure({status:422,data:{message:'bad'}}),'rejected');
 assert.equal(classifyFailure({status:401}),'rejected');
 assert.equal(classifyFailure({status:504,data:{outcome:'rejected'}}),'rejected');
 assert.equal(classifyFailure(undefined),'rejected');
});
test('reconciliation matches only one new order with the same execution intent',()=>{
 const req={symbol:'EURUSD',orderType:'BUY',executionType:'MARKET',lotSize:0.5};
 const started=Date.parse('2026-09-26T10:00:00Z');
 const orders=[
  {id:1,symbol:'EURUSD',orderType:'BUY',executionType:'MARKET',lotSize:0.5,createdAt:'2026-09-26T09:59:59Z'},
  {id:2,symbol:'EURUSD',orderType:'SELL',executionType:'MARKET',lotSize:0.5,createdAt:'2026-09-26T10:00:01Z'},
  {id:3,symbol:'GBPUSD',orderType:'BUY',executionType:'MARKET',lotSize:0.5,createdAt:'2026-09-26T10:00:01Z'},
  {id:4,symbol:'EURUSD',orderType:'BUY',executionType:'MARKET',lotSize:'0.25',createdAt:'2026-09-26T10:00:01Z'},
  {id:5,symbol:'EURUSD',orderType:'BUY_LIMIT',lotSize:'0.50',createdAt:'2026-09-26T10:00:02Z'},
  {id:6,symbol:'EURUSD',orderType:'BUY',lotSize:'0',lotSizeStore:'0.50',orderDetails:{entryExecutionType:'MARKET'},createdAt:'2026-09-26T10:00:02Z'},
 ];
 assert.equal(findSubmittedOrder(req,['1'],orders,started)?.id,6);
 assert.equal(findSubmittedOrder(req,['1','6'],orders,started),undefined);
 const match=orders[5];
 for(const change of [{createdAt:undefined},{createdAt:'2026-09-25T10:00:00Z'},{lotSizeStore:undefined,lotSize:undefined},{orderDetails:undefined},{sl:'1.05'}]) {
  assert.equal(findSubmittedOrder(req,[],[{...match,...change}],started),undefined);
 }
 assert.equal(findSubmittedOrder(req,[],[match,{...match,id:7}],started),undefined);
 assert.equal(findSubmittedOrder(req,[],[match,match],started)?.id,6);
});
test('pending reconciliation requires entry price, type and protection levels to match',()=>{
 const req={symbol:'EURUSD',orderType:'BUY',executionType:'LIMIT',limitPrice:1.09,lotSize:.01,sl:1.08,tp:1.12};
 const started=Date.parse('2026-09-26T10:00:00Z');
 const match={id:11,symbol:'EURUSD',orderType:'BUY',lotSize:'.01',createdAt:'2026-09-26T10:00:01Z',sl:'1.08',tp:'1.12',orderDetails:{entryExecutionType:'LIMIT',entrylimit:'1.09'}};
 assert.equal(findSubmittedOrder(req,[],[match],started)?.id,11);
 for(const change of [{orderDetails:{entryExecutionType:'STOP',entrylimit:'1.09'}},{orderDetails:{entryExecutionType:'LIMIT',entrylimit:'1.085'}},{sl:1.07},{tp:undefined}]) {
  assert.equal(findSubmittedOrder(req,[],[{...match,...change}],started),undefined);
 }
});
