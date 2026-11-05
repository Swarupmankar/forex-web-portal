import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/positionPnl.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {runningPnl,conversionSymbols,accountFigures,ownOrders,withInstrument,orderMargin}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('live profit accepts the same entry field variants as mobile and uses closing bid/ask',()=>{
 const base={id:1,symbol:'XAUUSD',orderType:'BUY',lotSize:'.02',contractSize:'100'};
 const quotes={XAUUSD:{bid:4001,ask:4001.3}};
 for(const field of [{orderDetails:{entryPrice:'4000'}},{entryPrice:'4000'},{openPrice:4000},{orderDetails:{price:'4000'}}]) {
  near(runningPnl({...base,...field},quotes),2);
  near(runningPnl({...base,...field,orderType:'SELL'},quotes),-2.6);
 }
 assert.ok(Number.isNaN(runningPnl(base,quotes)));
});
test('broker-suffixed symbols use supplied currencies and missing conversion remains unknown',()=>{
 const order={id:1,symbol:'EURJPY.pro',orderType:'BUY',lotSize:'.02',contractSize:'100000',entryPrice:171,currency_base:'EUR',currency_quote:'JPY'};
 const quotes={'EURJPY.pro':{bid:171.1,ask:171.12},USDJPY:{bid:158,ask:158.02}};
 near(runningPnl(order,quotes),200/158.01);
 assert.deepEqual(conversionSymbols([order]),['JPYUSD','USDJPY']);
 assert.ok(Number.isNaN(runningPnl(order,{'EURJPY.pro':quotes['EURJPY.pro']})));
 assert.ok(Number.isNaN(runningPnl({...order,currency_base:undefined,currency_quote:undefined},quotes)));
});
test('chart valuation can ignore unrelated quotes while retaining live USD conversion legs',()=>{
 const orders=[
  {symbol:'XAUUSD',entryPrice:4000},
  {symbol:'USDJPY',entryPrice:150},
  {symbol:'EURJPY.pro',entryPrice:160,currencyBase:'EUR',currencyQuote:'JPY'},
  {symbol:'GBPCHF',entryPrice:1.1},
 ].map(order=>({...order,id:1,orderType:'BUY',lotSize:'.01',contractSize:'100000'}));
 const prices={XAUUSD:{bid:4001,ask:4001.3},USDJPY:{bid:151,ask:151.02},'EURJPY.pro':{bid:161,ask:161.02},GBPCHF:{bid:1.11,ask:1.12},CHFUSD:{bid:1.1,ask:1.2},BTCUSD:{bid:90000,ask:90010}};
 for(const order of orders){
  const needed=[order.symbol,...conversionSymbols([order])];
  const selected=Object.fromEntries(needed.map(symbol=>[symbol,prices[symbol]]));
  near(runningPnl(order,selected),runningPnl(order,prices));
  assert.equal('BTCUSD' in selected,false);
 }
 const cross=orders[2];
 const before=runningPnl(cross,prices);
 const next={...prices,USDJPY:{bid:155,ask:155.02}};
 const selected=Object.fromEntries([cross.symbol,...conversionSymbols([cross])].map(symbol=>[symbol,next[symbol]]));
 assert.notEqual(runningPnl(cross,selected),before);
 near(runningPnl(cross,selected),runningPnl(cross,next));
});
test('partial-close account figures release the corresponding margin and retain floating profit',()=>{
 const order={id:1,symbol:'XAUUSD',orderType:'BUY',lotSize:'.01',lotSizeStore:'.02',contractSize:'100',entryPrice:4000,marginRequired:'40',marginInUse:'20'};
 const figures=accountFigures({openOrders:[order]},980,{XAUUSD:{bid:4001,ask:4001.3}});
 assert.deepEqual(figures,{balance:1000,margin:20,equity:1001,freeMargin:981,marginLevel:5005});
});

test('current margin is used once, not rescaled from the original lot size',()=>{
 const o={marginInUse:'8',marginRequired:'100',lotSize:'.01',lotSizeStore:'.05'};
 assert.equal(orderMargin(o),8);
 assert.equal(orderMargin({...o,marginInUse:0}),0);
 for(const marginInUse of [undefined,null,'',-1,'bad']) assert.ok(Number.isNaN(orderMargin({...o,marginInUse})));
});
test('valuation filters foreign accounts, retains endpoint-scoped rows, and ignores aggregate margin',()=>{
 const o={id:1,tradingAccountId:7,symbol:'XAUUSD',orderType:'BUY',lotSize:'.01',contractSize:100,entryPrice:4000,marginInUse:20};
 const other={...o,id:2,tradingAccountId:8,marginInUse:500};
 assert.equal(ownOrders([o,other,{...o,tradingAccountId:undefined}],7).length,2);
 assert.equal(ownOrders([{accountId:8},{accountId:7}],7).length,1);
 const figures=accountFigures({openOrders:[o,other],marginUsed:520},980,{XAUUSD:{bid:4001,ask:4002}},7);
 assert.deepEqual(figures,{balance:1000,margin:20,equity:1001,freeMargin:981,marginLevel:5005});
});
test('unknown data stays unknown; a loaded flat account has zero margin and no margin percentage',()=>{
 const empty=accountFigures({openOrders:[]},1000,{});
 assert.deepEqual(empty,{balance:1000,margin:0,equity:1000,freeMargin:1000,marginLevel:undefined});
 assert.ok(Number.isNaN(accountFigures(undefined,undefined,{}).margin));
 assert.ok(Number.isNaN(accountFigures({openOrders:[{marginRequired:20}]},980,{}).balance));
 const noQuote=accountFigures({openOrders:[{marginInUse:20}]},980,{});
 assert.equal(noQuote.balance,1000); assert.ok(Number.isNaN(noQuote.equity));
});
test('catalogue currency metadata values broker suffixes consistently across account and positions',()=>{
 const o=withInstrument({symbol:'EURJPY.raw',currencyQuote:'USD',entryPrice:170,contractSize:100000,lotSize:0.01,orderType:'BUY'},{baseCurrency:'EUR',quoteCurrency:'JPY'});
 near(runningPnl(o,{'EURJPY.raw':{bid:171,ask:171.02},USDJPY:{bid:150,ask:150}}),1000/150);
 assert.deepEqual(conversionSymbols([o]),['JPYUSD','USDJPY']);
});
