import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const uri=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const source=file=>ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const contractsURL=uri(source('lib/contracts.ts'));
const outcomeURL=uri(source('lib/orderOutcome.ts'));
const receiptURL=uri(source('lib/orderReceipt.ts').replace(/(['"])\.\/orderOutcome\1/,JSON.stringify(outcomeURL)));
const flowURL=uri(source('store/useOrderFlow.ts').replace(/(['"])@\/lib\/orderReceipt\1/,JSON.stringify(receiptURL)).replace(/(['"])zustand\1/,JSON.stringify(pathToFileURL(require.resolve('zustand')).href)));
const {useOrderFlow:flow}=await import(flowURL);
const {ticketRequest,pendingEntryRule,pendingPriceSuggestion}=await import(uri(source('lib/orderTicket.ts')));
const {validateTrade,engineOrder}=await import(contractsURL);
const {advanceReceipt,applyReceiptEvent,confirmReceipt,receiptCopy}=await import(receiptURL);
const draft={activeSymbol:'XAUUSD',orderMode:'MARKET',pendingOrderType:'LIMIT',volumeInput:'0.02',pendingEntry:'',enableTPSL:false,stopLoss:'',takeProfit:''};
const quote={symbol:'XAUUSD',bid:4000,ask:4000.3,timestamp:Date.now()};

test('market Buy and Sell use the same configured volume, with protection checked for each side',()=>{
  const buy=ticketRequest({...draft,enableTPSL:true,stopLoss:'3990',takeProfit:'4020'},'BUY');
  const sell={...buy,orderType:'SELL'};
  assert.equal(validateTrade(buy,quote),null);
  assert.match(validateTrade(sell,quote),/Stop loss must be above/);
  assert.deepEqual(engineOrder(buy),{symbol:'XAUUSD',orderType:'BUY',executionType:'MARKET',lotSize:'0.02',sl:'3990',tp:'4020'});
  assert.equal(ticketRequest(draft,'SELL').orderType,'SELL');
});

for(const [side,type,entry,invalid] of [['BUY','LIMIT','3990','4010'],['BUY','STOP','4010','3990'],['SELL','LIMIT','4010','3990'],['SELL','STOP','3990','4010']]) {
  test(`${side} ${type} remains explicit after chart edits or moving quotes`,()=>{
    const build=price=>ticketRequest({...draft,orderMode:'PENDING',pendingOrderType:type,pendingEntry:price},side);
    assert.equal(validateTrade(build(entry),quote),null);
    assert.match(validateTrade(build(invalid),quote),/wrong side/);
    assert.equal(build(invalid).executionType,type);
    const at=side==='BUY'?quote.ask:quote.bid;
    assert.match(validateTrade(build(String(at)),quote),/wrong side/);
    assert.equal(engineOrder(build(entry)).limitPrice,entry);
    assert.equal(pendingEntryRule(side,type).quoteName,side==='BUY'?'Ask':'Bid');
  });
}
test('blank and malformed fields cannot silently produce a valid order, and disabled protection is omitted',()=>{
  assert.match(validateTrade(ticketRequest({...draft,volumeInput:''},'BUY'),quote),/volume/);
  assert.match(validateTrade(ticketRequest({...draft,orderMode:'PENDING',pendingEntry:''},'BUY'),quote),/entry/);
  assert.match(validateTrade(ticketRequest({...draft,enableTPSL:true,stopLoss:'abc'},'BUY'),quote),/greater than zero/);
  assert.equal(ticketRequest({...draft,enableTPSL:false,stopLoss:'abc'},'BUY').sl,undefined);
});

const request=ticketRequest(draft,'BUY');
const receipt={request,practice:false,status:'submitted',accountId:77,key:'request-1',id:'100',knownIds:[],startedAt:Date.now()};
const filled={event:'ORDER_FILLED',tradingAccountId:77,ts:new Date().toISOString(),data:{orderId:100,entryPrice:'4000.35'}};
test('only the matching account and opening order event can resolve a receipt',()=>{
  for(const event of [{...filled,tradingAccountId:78},{...filled,data:{...filled.data,orderId:101}},{...filled,data:{...filled.data,closeReason:'MANUAL'}},{...filled,data:{...filled.data,exitPrice:'4001'}},{...filled,ts:'2000-01-01T00:00:00Z'}])assert.equal(applyReceiptEvent(receipt,event),receipt);
  assert.equal(applyReceiptEvent({...receipt,id:undefined},filled).status,'submitted');
  const open=applyReceiptEvent(receipt,filled);
  assert.equal(open.status,'open');assert.equal(open.fillPrice,4000.35);
  assert.equal(advanceReceipt(open,{...receipt,status:'submitted'}).status,'open');
  assert.equal(advanceReceipt(open,{...receipt,status:'checking'}).status,'open');
});
test('a fast rejection buffered before HTTP identification survives the later accepted response',()=>{
  flow.setState(flow.getInitialState(),true);
  flow.getState().set({receipt:{...receipt,id:undefined,status:'sending'},inFlight:true});
  flow.getState().receive({...filled,event:'ORDER_REJECTED',data:{orderId:100,reason:'Insufficient margin'}});
  assert.equal(flow.getState().receipt.status,'sending');
  flow.getState().set({receipt});
  assert.equal(flow.getState().receipt.status,'rejected');
  assert.equal(receiptCopy(flow.getState().receipt).message,'Insufficient margin');
  flow.getState().set({receipt:{...receipt,status:'checking'},verifying:{key:receipt.key}});
  assert.equal(flow.getState().receipt.status,'rejected');assert.equal(flow.getState().verifying,undefined);
  flow.getState().set({receipt:{...receipt,key:'next-request',id:undefined,status:'sending'}});
  assert.equal(flow.getState().events.length,0);assert.equal(flow.getState().receipt.status,'sending');
});
test('SENDING rows identify an order without claiming a fill; OPEN rows carry the actual fill price',()=>{
  const row={...request,id:100,orderStatus:'SENDING',createdAt:new Date(receipt.startedAt).toISOString()};
  const sending=confirmReceipt({...receipt,id:undefined},[row]);
  assert.equal(sending.id,'100');assert.equal(sending.status,'submitted');assert.equal(sending.fillPrice,undefined);
  const open=confirmReceipt(sending,[{...row,orderStatus:'OPEN',orderDetails:{entryPrice:'4000.4'}}]);
  assert.equal(open.status,'open');assert.equal(open.fillPrice,4000.4);
  const socketWithoutPrice={...receipt,status:'open'};
  const hydrated=confirmReceipt(socketWithoutPrice,[{...row,orderStatus:'OPEN',orderDetails:{entryPrice:'4000.4'}}]);
  assert.equal(advanceReceipt(socketWithoutPrice,hydrated).fillPrice,4000.4);
});

// Exercise the actual submit hook with deterministic account, quote and transport fixtures.
// No browser, network request or connected order is made by these tests.
const state={generation:1,accounts:[{id:'session',tradingAccountId:77}],activeId:'session'};
let remote=async()=>({accepted:true,orderId:100}),calls=[],policy={practice:false,canPlace:true,canPlaceSymbol:()=>true};
let tab='positions';
const selectFlow=selector=>selector(flow.getState());selectFlow.getState=flow.getState;
const selectAccount=selector=>selector(state);selectAccount.getState=()=>state;
const ws={setActivityExpanded(){},notify(){}};
const selectWs=selector=>selector({...ws,oneClickPractice:false});selectWs.getState=()=>ws;
const ui={isAuthenticated:true,oneClickTrading:false,setBottomTab:value=>{tab=value;}};
const selectUi=selector=>selector(ui);selectUi.getState=()=>ui;
globalThis.__orderTicketFixture={
  useState:v=>[v,()=>{}],useAccountStore:selectAccount,useWorkspaceStore:selectWs,useUIStore:selectUi,useOrderFlow:selectFlow,
  useGetAllStocksQuery:()=>({isSuccess:true,data:[{symbol:'XAUUSD',minLots:.01,maxLots:50,lotStep:.01}]}),
  usePlaceOrderMutation:()=>[(args)=>({unwrap:async()=>{calls.push(args);return remote(args);}})],
  tradingApi:{endpoints:{getAccountDetails:{select:()=>()=>({data:{id:77}})},getOpenOrders:{select:()=>()=>({data:{openOrders:[],pendingOrders:[]}})}}},
  store:{getState:()=>({})},usePracticeStore:{getState(){throw Error('Not used in connected fixture');}},
  useExecutionPolicy:()=>policy,executableQuote:()=>quote,mobileSocketService:{ensureConnected(){}},
  errorMessage:(e,fallback)=>e.data?.message??fallback,ownOrders:rows=>rows,
};
const fixture=(...names)=>uri(names.map(name=>`export const ${name}=globalThis.__orderTicketFixture.${name};`).join('\n'));
const modules={react:fixture('useState'),'@/store/useAccountStore':fixture('useAccountStore'),'@/store/useWorkspaceStore':fixture('useWorkspaceStore'),'@/store/useUIStore':fixture('useUIStore'),'@/store/useOrderFlow':fixture('useOrderFlow'),'@/store/usePracticeStore':fixture('usePracticeStore'),'@/store/api/tradingApi':fixture('useGetAllStocksQuery','usePlaceOrderMutation','tradingApi'),'@/store':fixture('store'),'@/hooks/useExecutionPolicy':fixture('useExecutionPolicy'),'@/hooks/useExecutableQuote':fixture('executableQuote'),'@/services/mobileSocket':fixture('mobileSocketService'),'@/lib/market':fixture('errorMessage'),'@/lib/positionPnl':fixture('ownOrders'),'@/lib/contracts':contractsURL,'@/lib/orderOutcome':outcomeURL,'@/lib/orderReceipt':receiptURL,'@/lib/freshness':uri(source('lib/freshness.ts')),'@/lib/volume':uri(source('lib/volume.ts'))};
modules['@/lib/tradeNotifications']=uri(source('lib/tradeNotifications.ts'));
const submitSource=source('components/OrderEntry/useOrderSubmit.ts').replace(/from\s+(['"])([^'"]+)\1/g,(whole,_quote,name)=>{assert.ok(modules[name],name);return 'from '+JSON.stringify(modules[name]);});
const {useOrderSubmit}=await import(uri(submitSource));
function resetSubmit(){flow.setState(flow.getInitialState(),true);calls=[];state.generation=1;quote.timestamp=Date.now();policy={practice:false,canPlace:true,canPlaceSymbol:()=>true};remote=async()=>({accepted:true,orderId:100});}

test('submit waits for account confirmation and carries one idempotency key per action',async()=>{
  resetSubmit();const result=await useOrderSubmit().submit(request);
  assert.equal(result.status,'SUBMITTED');assert.equal(flow.getState().receipt.status,'submitted');
  assert.equal(flow.getState().receipt.id,'100');assert.equal(flow.getState().receipt.accountId,77);
  assert.equal(calls.length,1);assert.ok(calls[0].idempotencyKey);assert.deepEqual(calls[0].order,request);
  assert.equal(tab,'positions');
  await useOrderSubmit().submit(request);assert.equal(calls.length,1);
});
test('a market request selects Positions immediately and a slow reply does not pull the user away from History',async()=>{
  resetSubmit();tab='pending';let resolve;remote=()=>new Promise(r=>{resolve=r;});
  const pending=useOrderSubmit().submit(request);
  assert.equal(tab,'positions');assert.equal(flow.getState().receipt.status,'sending');
  tab='history';resolve({accepted:true,orderId:100});await pending;
  assert.equal(tab,'history');
});
test('resting Limit and Stop submissions still select Pending',async()=>{
  for(const [executionType,limitPrice] of [['LIMIT',3990],['STOP',4010]]){
    resetSubmit();tab='positions';await useOrderSubmit().submit({...request,executionType,limitPrice});
    assert.equal(tab,'pending');assert.equal(calls.length,1);
  }
});
test('stale prices, broker lot limits, halted symbols and invalid protection never reach transport',async()=>{
  resetSubmit();quote.timestamp=Date.now()-10000;
  assert.match((await useOrderSubmit().submit(request)).error,/fresh quote/);
  quote.timestamp=Date.now();
  assert.match((await useOrderSubmit().submit({...request,lotSize:.015})).error,/steps/);
  assert.match((await useOrderSubmit().submit({...request,sl:4000.1})).error,/below/);
  policy={...policy,canPlaceSymbol:()=>false};
  assert.match((await useOrderSubmit().submit(request)).error,/paused/);
  assert.equal(calls.length,0);
});
test('concurrent panels cannot double-submit, and a fast execution cannot be downgraded by HTTP',async()=>{
  resetSubmit();let resolve;
  remote=()=>new Promise(r=>{resolve=r;});
  const first=useOrderSubmit().submit(request);
  assert.equal(flow.getState().receipt.status,'sending');
  await useOrderSubmit().submit({...request,orderType:'SELL'});assert.equal(calls.length,1);
  flow.getState().receive(filled);
  resolve({accepted:true,orderId:100});await first;
  assert.equal(flow.getState().receipt.status,'open');assert.equal(flow.getState().receipt.fillPrice,4000.35);
});
test('definite backend rejection is visible with its reason and leaves no pending verification',async()=>{
  resetSubmit();remote=async()=>{throw {status:400,data:{message:'Insufficient margin'}};};
  assert.equal((await useOrderSubmit().submit(request)).ok,false);
  assert.equal(flow.getState().receipt.status,'rejected');assert.equal(flow.getState().receipt.message,'Insufficient margin');
  assert.equal(flow.getState().inFlight,false);assert.equal(flow.getState().verifying,undefined);
});
test('switching accounts during submission cannot publish the old result into the new account',async()=>{
  resetSubmit();let resolve;remote=()=>new Promise(r=>{resolve=r;});
  const first=useOrderSubmit().submit(request);
  state.generation=2;flow.setState(flow.getInitialState(),true);
  resolve({accepted:true,orderId:100});
  assert.match((await first).error,/Account changed/);assert.equal(flow.getState().receipt,undefined);
});
test('lost response keeps the outcome unknown and blocks a retry while verification runs',async()=>{
  resetSubmit();remote=async()=>{throw {status:'TIMEOUT_ERROR'};};
  const result=await useOrderSubmit().submit(request);
  assert.equal(result.unknown,true);assert.equal(flow.getState().receipt.status,'checking');
  assert.match((await useOrderSubmit().submit(request)).error,/Still confirming/);assert.equal(calls.length,1);
  // Cancel this fixture's reconciliation as an account switch would do.
  flow.setState(flow.getInitialState(),true);
});

// Server-render isolated components with fixtures to verify controls and accessible status copy.
// This is a component check, not browser visual acceptance.
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function component(file,mocks){
  const js=ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  const icons=new Proxy({}, {get:()=>props=>React.createElement('svg',{'aria-hidden':true,...props})});
  new Function('require','module','exports',js)(name=>name==='lucide-react'?icons:mocks[name]??require(name),module,module.exports);
  return module.exports;
}
let renderDraft={...draft,selectedOrderSide:'BUY',setVolumeInput(){},setPendingEntry(){},isAuthenticated:true,orderDraftVersion:0};
const selectRender=selector=>selector?selector(renderDraft):renderDraft;
const marketDisplay={useMarketDisplay:()=>({formatPrice:n=>n==null?'—':Number(n).toFixed(2),instrument:()=>({name:'Gold / US dollar',digits:2,contractSize:100})})};
const workflowMocks={showActivity(){},viewInstrument(){}};
const mocks={
  '@/hooks/useMarketDisplay':marketDisplay,
  '@/lib/portalHandoff':{PORTAL_SIGN_IN:'/auth'},
  '@/store/useUIStore':{useUIStore:selectRender},
  '@/store/useWorkspaceStore':{useWorkspaceStore:selector=>selector?selector({ticketOpen:false}):{}},
  '@/store/usePriceStore':{usePriceStore:selector=>selector({connection:'connected'})},
  '@/store/api/tradingApi':{useGetAllStocksQuery:globalThis.__orderTicketFixture.useGetAllStocksQuery},
  '@/lib/contracts':{validateTrade},
  '@/lib/freshness':await import(modules['@/lib/freshness']),
  '@/lib/volume':await import(modules['@/lib/volume']),
  '@/hooks/useExecutableQuote':{useExecutableQuote:()=>quote},
  '@/lib/risk':await import(uri(source('lib/risk.ts'))),
  '@/components/terminal/OrderReview':{OrderReview:()=>null},
  '@/components/terminal/OrderResult':{OrderResult:()=>null},
  '@/lib/orderTicket':{ticketRequest,pendingEntryRule,pendingPriceSuggestion},
  '@/lib/orderReceipt':{receiptCopy},
  '@/components/terminal/InstrumentIcon':{InstrumentIcon:()=>null},
  '@/lib/practice':{PRACTICE_CONTRACTS:{XAUUSD:100}},
  '@/store/useAccountStore':{useAccountStore:selectAccount},
  '@/lib/accountSessions':{accountKindLabel:()=> 'Real'},
  './useOrderSubmit':{useOrderSubmit:()=>({submit(){throw Error('Render must never submit');},check:()=>null,submitting:false,canExecute:policy.canPlace,practice:false,policy,spec:()=>({min:.01,max:50,step:.01}),specReady:true})},
  '@/store/useOrderFlow':{useOrderFlow:selectFlow},
};
const {OrderEntry}=component('components/OrderEntry/OrderEntry.tsx',mocks);
const renderTicket=()=>renderToStaticMarkup(React.createElement(OrderEntry,{docked:true}));
test('rendered desktop ticket exposes Market, Limit and Stop with final Buy and Sell controls',()=>{
  resetSubmit();renderDraft={...renderDraft,...draft};
  const html=renderTicket();
  for(const value of ['MARKET','BUY_LIMIT','SELL_LIMIT','BUY_STOP','SELL_STOP']) assert.ok(html.includes(`value="${value}"`));
  assert.match(html,/aria-label="Order type"/);
  assert.match(html,/aria-label="Buy 0.02 lots XAUUSD"/);assert.match(html,/aria-label="Sell 0.02 lots XAUUSD"/);
  assert.doesNotMatch(html,/Review buy order|Review &amp; place|Turn on one-click/);
});
test('inline execution feedback keeps the ticket controls and distinguishes waiting, filled and failed',()=>{
  for(const status of ['sending','submitted','open','unconfirmed','rejected']){
    resetSubmit();renderDraft={...renderDraft,...draft};
    flow.getState().set({receipt:{...receipt,status},inFlight:status==='sending'});
    const html=renderTicket();
    assert.match(html,/aria-label="Buy 0.02 lots XAUUSD"/);assert.match(html,/aria-label="Sell 0.02 lots XAUUSD"/);
    assert.ok(html.includes(receiptCopy({...receipt,status}).title));
    if(status==='sending')assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Buy/);
    if(status==='unconfirmed'||status==='rejected')assert.match(html,/ticket-confirmed-inline is-uncertain/);
  }
  resetSubmit();
});

let oneTapEnabled=true;
const {ChartTradeControls}=component('components/Chart/ChartTradeControls.tsx',{
  ...mocks,
  '@/hooks/useExecutionPolicy':{useExecutionPolicy:()=>policy},
  '@/components/OrderEntry/useOneClick':{useOneClick:kind=>({on:kind!=='close'&&oneTapEnabled,set(){},dialog:null})},
  '@/components/OrderEntry/useOrderSubmit':mocks['./useOrderSubmit'],
  '@/lib/tradingWorkflow':{composeOrder(){},composePendingOrder(){}},
  '@/lib/tradeExperience':await import(uri(source('lib/tradeExperience.ts'))),
  '@/components/terminal/ToolbarMenu':{ToolbarMenu:({children})=>React.createElement('div',null,children)},
});
const renderQuotes=()=>renderToStaticMarkup(React.createElement(ChartTradeControls,{symbol:'XAUUSD',picking:false,onPickToggle(){},onClearPick(){}}));
test('chart quotes expose shared lots and direct order labels only while one-tap trading is on',()=>{
  resetSubmit();renderDraft={...renderDraft,...draft};oneTapEnabled=true;
  let html=renderQuotes();assert.match(html,/aria-label="One-tap lot size"/);
  assert.match(html,/aria-label="Place XAUUSD buy market 0.02 lots order"/);
  assert.match(html,/One-tap close Off/);
  oneTapEnabled=false;html=renderQuotes();assert.doesNotMatch(html,/aria-label="One-tap lot size"/);
  assert.match(html,/aria-label="Create XAUUSD buy order"/);
});
test('chart quote buttons remain disabled during any request and show sending on the submitted side',()=>{
  resetSubmit();oneTapEnabled=true;renderDraft={...renderDraft,...draft};
  flow.getState().set({inFlight:true,receipt:{...receipt,status:'sending'}});
  const html=renderQuotes();
  assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Place XAUUSD buy/);
  assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Place XAUUSD sell/);
  assert.match(html,/Sending/);resetSubmit();
});
test('rendered SL/TP disables the incompatible side and explains it; a symbol halt disables both',()=>{
  resetSubmit();renderDraft={...renderDraft,...draft,enableTPSL:true,stopLoss:'3990'};
  let html=renderTicket();
  assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Sell 0.02 lots XAUUSD"/);
  assert.doesNotMatch(html,/<button[^>]*disabled=""[^>]*aria-label="Buy 0.02 lots XAUUSD"/);
  assert.match(html,/Stop loss must be above/);
  policy={...policy,canPlaceSymbol:()=>false};html=renderTicket();
  assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Buy 0.02 lots XAUUSD"/);
  assert.match(html,/Trading in XAUUSD is paused/);
});
test('rendered Stop ticket preserves its type, displays the entry rule and blocks the wrong price',()=>{
  resetSubmit();renderDraft={...renderDraft,...draft,orderMode:'PENDING',pendingOrderType:'STOP',pendingEntry:'3990'};
  const html=renderTicket();
  assert.match(html,/Place buy stop/);assert.match(html,/Buy stop: set the entry above Ask/);
  assert.match(html,/aria-invalid="true"/);assert.match(html,/wrong side/);
});
const {OrderResult}=component('components/terminal/OrderResult.tsx',{
  '@/store/useOrderFlow':{useOrderFlow:selectFlow},'@/lib/orderReceipt':await import(receiptURL),
  '@/lib/tradingWorkflow':workflowMocks,'@/hooks/useMarketDisplay':marketDisplay,
});
test('rendered order results separate acceptance, actual fills, rejection and uncertainty',()=>{
  for(const [status,title] of [['sending','Sending order'],['submitted','Order submitted'],['open','Position opened'],['pending','Pending order placed'],['rejected','Order not placed'],['checking','Checking order status'],['unconfirmed','Order outcome unconfirmed']]){
    flow.setState({...flow.getInitialState(),receipt:{...receipt,status,...(status==='open'?{fillPrice:4000.35}:{})}},true);
    const html=renderToStaticMarkup(React.createElement(OrderResult,{onBack(){}}));
    assert.ok(html.includes(title));assert.match(html,/role="status"/);
    if(status==='open')assert.match(html,/Filled at.*4000.35/);
    else assert.doesNotMatch(html,/Filled at/);
    if(status==='unconfirmed')assert.match(html,/Check history/);
    if(status==='sending'||status==='checking')assert.match(html,/<button[^>]*disabled=""[^>]*>/);
  }
  flow.setState(flow.getInitialState(),true);
});


test('pending suggestions are valid for all four directions at instrument precision',()=>{
  for(const side of ['BUY','SELL'])for(const type of ['LIMIT','STOP']){
    for(const q of [{bid:4000,ask:4000.3},{bid:1.01001,ask:1.01009}]){
      const digits=q.bid>10?2:5, price=pendingPriceSuggestion(side,type,q,digits);
      assert.ok(price>0);
      assert.equal(validateTrade({...request,orderType:side,executionType:type,limitPrice:price},q),null);
      assert.equal(price,Number(price.toFixed(digits)));
    }
  }
  for(const q of [undefined,{bid:0,ask:1},{bid:2,ask:1},{bid:1,ask:Infinity}])assert.equal(pendingPriceSuggestion('BUY','LIMIT',q,2),undefined);
  assert.equal(pendingPriceSuggestion('SELL','STOP',{bid:.001,ask:.002},2),undefined);
});
