import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),root=new URL('../src/',import.meta.url);
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const source=file=>ts.transpileModule(readFileSync(new URL(file,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const cache=new Map();
function local(file){if(cache.has(file))return cache.get(file);const url=uri(source(file).replace(/from\s+(['"])([^'"]+)\1/g,(_,q,name)=>'from '+JSON.stringify(name==='zustand'?pathToFileURL(require.resolve(name)).href:local(name.startsWith('@/')?name.slice(2)+'.ts':path.posix.join(path.posix.dirname(file),name)+'.ts'))));cache.set(file,url);return url;}
const logic=await import(local('lib/tradeManagement.ts'));
const {prepareManagement,closeBreakdown,reconcileManagement,managementPending,managementTitle}=logic;
const {shiftPendingEntry}=await import(local('lib/contracts.ts'));
const engine=await import(local('lib/practice.ts'));
const {useTradeManagement:management}=await import(local('store/useTradeManagement.ts'));
const {useOrderFlow:flow}=await import(local('store/useOrderFlow.ts'));
const now=Date.now(),quote={symbol:'XAUUSD',bid:4000,ask:4000.3,timestamp:now};
const order={id:12,tradingAccountId:77,symbol:'XAUUSD',orderType:'BUY',orderStatus:'OPEN',lotSize:'0.03',contractSize:100,sl:'3990',tp:'4020',orderDetails:{entryPrice:'4001'},createdAt:new Date(now-100000).toISOString()};
const draft={sl:'3995',tp:'4020',entry:'4001',lots:'0.01'};
function result(action='close',extra={}){return {key:'manage-12',before:order,command:{action,orderId:'12',changes:action==='edit'?{sl:3995}:{},...(action==='close'&&{lots:.01})},practice:false,accountId:77,generation:1,startedAt:now,knownExits:[],status:'submitted',...extra};}
const exit=(size=.01,extra={})=>({...order,lotSize:size,exitRowId:'12:exit-1',closedAt:new Date(now+100).toISOString(),pnl:-1,orderDetails:{exitPrice:'4000'},...extra});

test('bounded confirmation waits become unconfirmed after 30 seconds without claiming failure',()=>{
  const r=result();assert.equal(logic.expireManagement(r,now+29999),r);
  assert.equal(logic.expireManagement(r,now+30000).status,'unconfirmed');
  for(const status of ['complete','rejected','changed','sending']){const settled={...r,status};assert.equal(logic.expireManagement(settled,now+60000),settled);}
});

test('close volume respects 0.01 steps, the open amount and the exact remainder',()=>{
  assert.deepEqual(closeBreakdown(.03,.01),{remaining:.02,partial:true});
  assert.deepEqual(closeBreakdown(.03,.03),{remaining:0,partial:false});
  for(const n of [0,-.01,.015,.04,NaN])assert.ok(closeBreakdown(.03,n).error);
  assert.ok(closeBreakdown(NaN,.01).error);
});
test('close preparation validates current volume and permits exits while quotes are unavailable',()=>{
  assert.equal(prepareManagement(order,order,'close',draft).command.lots,.01);
  assert.match(prepareManagement(order,{...order,lotSize:'.02'},'close',draft).error,/changed/);
  assert.match(prepareManagement(order,undefined,'close',draft).error,/no longer/);
  assert.match(prepareManagement(order,{...order,orderStatus:'CLOSED'},'close',draft).error,/changed/);
});
test('SL/TP uses liquidation bid/ask and cannot remove protection, save nothing or use stale prices',()=>{
  assert.deepEqual(prepareManagement(order,order,'edit',draft,quote).command.changes,{sl:3995});
  assert.match(prepareManagement(order,order,'edit',{...draft,sl:''},quote).error,/removing/);
  assert.match(prepareManagement(order,order,'edit',{...draft,sl:'3990'},quote).error,/No levels/);
  assert.match(prepareManagement(order,order,'edit',{...draft,sl:'4000.1'},quote).error,/below/);
  assert.match(prepareManagement(order,order,'edit',draft,{...quote,timestamp:now-10000}).error,/fresh quote/);
  assert.match(prepareManagement(order,{...order,tp:'4030'},'edit',draft,quote).error,/changed/);
});
for(const [side,type,entry,next] of [['BUY','LIMIT',3990,3980],['BUY','STOP',4010,4020],['SELL','LIMIT',4010,4020],['SELL','STOP',3990,3980]])test(`${side} ${type} repricing preserves protection distances and cannot edit an executed entry`,()=>{
  const sign=side==='BUY'?1:-1,o={...order,orderType:side,orderStatus:'PENDING',sl:entry-sign*5,tp:entry+sign*10,orderDetails:{entrylimit:entry,entryExecutionType:type}};
  const moved=shiftPendingEntry(entry,next,o,2),fields={...draft,entry:String(next),sl:String(moved.sl),tp:String(moved.tp)};
  assert.deepEqual(prepareManagement(o,o,'edit',fields,quote).command.changes,moved);
  assert.match(prepareManagement(o,{...o,orderStatus:'OPEN'},'edit',fields,quote).error,/changed/);
});
test('pending cancellation detects an order that filled while its ticket was open',()=>{
  const pending={...order,orderStatus:'PENDING'};
  assert.equal(prepareManagement(pending,pending,'cancel',draft).command.action,'cancel');
  assert.match(prepareManagement(pending,{...pending,orderStatus:'OPEN'},'cancel',draft).error,/changed/);
});
test('partial close needs both the remaining position and a new exit record',()=>{
  const r=result(),remaining={...order,lotSize:'.02'};
  assert.equal(reconcileManagement(r,[remaining],[],now+1),r);
  assert.equal(reconcileManagement(r,[order],[exit()],now+1),r);
  assert.equal(reconcileManagement(r,[remaining],[exit()],now-1),r);
  const confirmed=reconcileManagement(r,[remaining],[exit()],now+1);
  assert.equal(confirmed.status,'complete');assert.equal(confirmed.remaining,.02);assert.equal(confirmed.exitPrice,4000);assert.equal(confirmed.pnl,-1);
  assert.equal(managementTitle(confirmed),'Position partially closed');
});
test('full close never treats a missing position or an old exit as proof',()=>{
  const r=result('close',{command:{action:'close',orderId:'12',changes:{},lots:.03}});
  assert.equal(reconcileManagement(r,[],[],now+1),r);
  assert.equal(reconcileManagement(r,[],[exit(.03,{closedAt:'2000-01-01'})],now+1),r);
  const old={...r,knownExits:['12:exit-1']};assert.equal(reconcileManagement(old,[],[exit(.03)],now+1),old);
  const full=reconcileManagement(r,[],[exit(.03)],now+1);assert.equal(full.status,'complete');assert.equal(full.remaining,0);
  assert.equal(managementTitle(full),'Position closed');
});
test('modify and cancel results require observed account changes, not just acceptance',()=>{
  const r=result('edit');assert.equal(reconcileManagement(r,[order],[],now+1),r);
  assert.equal(reconcileManagement(r,[{...order,sl:'3995'}],[],now+1).status,'complete');
  const c=result('cancel',{before:{...order,orderStatus:'PENDING'}});
  assert.equal(reconcileManagement(c,[],[],now+1),c);
  assert.equal(reconcileManagement(c,[c.before],[{...order,orderStatus:'CANCELLED'}],now+1),c);
  assert.equal(reconcileManagement(c,[],[{...order,orderStatus:'CANCELLED'}],now+1).status,'complete');
  assert.equal(reconcileManagement(c,[order],[],now+1).status,'changed');
});
test('unconfirmed requests can resolve later and excess closing activity is reported as changed',()=>{
  const r=result('close',{status:'unconfirmed'});
  assert.ok(managementPending(r));
  assert.equal(reconcileManagement(r,[{...order,lotSize:'.02'}],[exit()],now+1).status,'complete');
  assert.equal(reconcileManagement(r,[{...order,lotSize:'.01'}],[exit(.02)],now+1).status,'changed');
});
test('the persistent result cannot regress when HTTP returns after an account confirmation',()=>{
  management.getState().reset();management.getState().put({...result(),status:'complete'});
  management.getState().put({...result(),status:'submitted'});assert.equal(management.getState().results['12'].status,'complete');
  management.getState().select({key:'selection',generation:1,order,action:'close',practice:false});
  management.getState().select(undefined);assert.equal(management.getState().results['12'].status,'complete');
  management.getState().reset();assert.deepEqual(management.getState().results,{});
});
test('practice repricing applies entry and SL/TP atomically and partial/full closes settle actual volume',()=>{
  const quotes={XAUUSD:quote},r={symbol:'XAUUSD',orderType:'BUY',executionType:'LIMIT',lotSize:.03,limitPrice:3990,sl:3985,tp:4000};
  let a=engine.placePractice(engine.newPracticeAccount(),r,quotes,now);
  a=engine.editPracticeOrder(a,'P1',{limitPrice:3980,sl:3975,tp:3990},quotes,now);
  assert.equal(a.orders[0].openPrice,3980);assert.equal(a.orders[0].sl,3975);assert.equal(a.orders[0].tp,3990);
  assert.throws(()=>engine.editPracticeOrder(a,'P1',{limitPrice:4001,sl:3995,tp:4010},quotes,now),/wrong side/);
  let b=engine.placePractice(engine.newPracticeAccount(),{...r,executionType:'MARKET',sl:3990,tp:4020},quotes,now);
  b=engine.closePracticeVolume(b,'P1',.01,quotes,now+100);
  assert.equal(b.orders.find(o=>o.id==='P1').lotSize,.02);assert.equal(b.orders[0].lotSize,.01);
  assert.equal(b.orders.find(o=>o.id==='P1').sl,3990);
  b=engine.closePracticeVolume(b,'P1',.02,quotes,now+200);
  assert.equal(b.orders.find(o=>o.id==='P1').status,'CLOSED');
});

// Run the actual management submit path with isolated account/transport fixtures.
let policy={practice:false,canManage:true},account={generation:1},rows=[order],history={},calls=[],reply=async()=>({accepted:true}),paperState;
let quickSettings={oneClickClose:false},workspaceSettings={oneClickClosePractice:false},opened=[],notices=[];
const quickUi=selector=>selector(quickSettings);quickUi.getState=()=>quickSettings;
const quickWorkspace=selector=>selector(workspaceSettings);quickWorkspace.getState=()=>({...workspaceSettings,notify:message=>notices.push(message)});
const quickPractice=selector=>selector(paperState);quickPractice.getState=()=>paperState;
const selectFlow=selector=>selector(flow.getState());selectFlow.getState=flow.getState;
const selected=()=>({key:'selection',generation:1,order,action:'close',practice:false});
const fixtureState={
  useEffect(){},useRef:value=>({current:value}),useTradeManagement:management,useAccountStore:{getState:()=>account},
  usePracticeStore:quickPractice,useOrderFlow:selectFlow,useUIStore:quickUi,useWorkspaceStore:quickWorkspace,
  openTradeManagement:(...args)=>opened.push(args),
  useExecutionPolicy:()=>policy,useTradingAccountId:()=>77,executableQuote:()=>({...quote,timestamp:Date.now()}),
  useModifyOrderMutation:()=>[args=>({unwrap:async()=>{calls.push({kind:'modify',...args});return reply(args);}})],
  useExitOrderMutation:()=>[args=>({unwrap:async()=>{calls.push({kind:'exit',...args});return reply(args);}})],
  useGetOpenOrdersQuery(){},useGetOrderHistoryQuery(){},
  tradingApi:{endpoints:{getOpenOrders:{select:()=>()=>({data:{openOrders:rows}})},getOrderHistory:{select:()=>()=>({data:history})}},util:{invalidateTags:tags=>({tags})}},
  store:{getState:()=>({}),dispatch(){}},mobileSocketService:{ensureConnected(){}},errorMessage:e=>e.data?.message??'Rejected',
};
globalThis.__managementFixture=fixtureState;
const fixtures=(...names)=>uri(names.map(name=>`export const ${name}=globalThis.__managementFixture.${name};`).join('\n'));
const modules={react:fixtures('useEffect','useRef'),'@/store/useWorkspaceStore':fixtures('useWorkspaceStore'),'@/store/useTradeManagement':fixtures('useTradeManagement'),'@/store/useAccountStore':fixtures('useAccountStore'),'@/store/usePracticeStore':fixtures('usePracticeStore'),'@/store/useOrderFlow':fixtures('useOrderFlow'),'@/store/useUIStore':fixtures('useUIStore'),'@/store':fixtures('store'),'@/store/api/tradingApi':fixtures('tradingApi','useGetOpenOrdersQuery','useGetOrderHistoryQuery','useModifyOrderMutation','useExitOrderMutation'),'./useExecutionPolicy':fixtures('useExecutionPolicy'),'./useTradingAccountId':fixtures('useTradingAccountId'),'./useExecutableQuote':fixtures('executableQuote'),'@/lib/market':fixtures('errorMessage'),'@/services/mobileSocket':fixtures('mobileSocketService')};
const hookURL=uri(source('hooks/useTradeManagement.ts').replace(/from\s+(['"])([^'"]+)\1/g,(_,q,name)=>'from '+JSON.stringify(modules[name]??local(name.slice(2)+'.ts'))));
const {useManagementSubmit}=await import(hookURL);
function reset(){management.getState().reset();flow.setState(flow.getInitialState(),true);policy={practice:false,canManage:true};account={generation:1};rows=[order];history={};calls=[];reply=async()=>({accepted:true});paperState={mode:'connected',account:{orders:[]}};quickSettings={oneClickClose:false};workspaceSettings={oneClickClosePractice:false};opened=[];notices=[];}

const quickModules={...modules,'./useTradeManagement':hookURL,'@/lib/openTradeManagement':fixtures('openTradeManagement')};
const {useQuickTradeActions}=await import(uri(source('hooks/useQuickTradeActions.ts').replace(/from\s+(['"])([^'"]+)\1/g,(_,q,name)=>'from '+JSON.stringify(quickModules[name]??local(name.slice(2)+'.ts')))));
test('close opens the management ticket until separately enabled, then submits the entire current position',async()=>{
  reset();const actions=useQuickTradeActions();assert.equal(actions.enabled,false);
  await actions.exit(order,'close');assert.equal(opened.length,1);assert.equal(calls.length,0);
  quickSettings.oneClickClose=true;await actions.exit(order,'close');
  assert.equal(calls.length,1);assert.equal(calls[0].exitLotSize,.03);assert.equal(calls[0].orderId,'12');
  assert.equal(management.getState().results['12'].status,'submitted','acceptance must not optimistically remove the row');
  assert.equal(management.getState().results['12'].notify,true);
  await actions.exit(order,'close');assert.equal(calls.length,1);assert.match(notices[0],/unresolved/);
});
test('one-tap cancellation shares validation and does not include a close volume',async()=>{
  reset();quickSettings.oneClickClose=true;const pending={...order,orderStatus:'PENDING'};rows=[pending];
  await useQuickTradeActions().exit(pending,'cancel');
  assert.equal(calls[0].kind,'modify');assert.equal(calls[0].cancelOrder,true);assert.equal(calls[0].exitLotSize,undefined);
});
test('quick close rechecks changed volume and reads the current opt-in rather than an old render',async()=>{
  reset();quickSettings.oneClickClose=true;const actions=useQuickTradeActions();
  rows=[{...order,lotSize:'.02'}];await actions.exit(order,'close');
  assert.equal(calls.length,0);assert.match(notices[0],/changed/);
  quickSettings.oneClickClose=false;await actions.exit(order,'close');
  assert.equal(opened.length,1);assert.equal(calls.length,0);
});
test('a close submits exact requested volume with one idempotency key and remains unconfirmed after acceptance',async()=>{
  reset();await useManagementSubmit()(selected(),draft);
  assert.equal(calls.length,1);assert.equal(calls[0].exitLotSize,.01);assert.equal(calls[0].orderId,'12');assert.ok(calls[0].idempotencyKey);
  assert.equal(management.getState().results['12'].status,'submitted');
  assert.match(await useManagementSubmit()(selected(),draft),/unresolved/);assert.equal(calls.length,1);
});
test('current account, policy, volume and cross-device changes are checked before transport',async()=>{
  reset();rows=[{...order,tradingAccountId:78}];assert.match(await useManagementSubmit()(selected(),draft),/no longer/);
  rows=[{...order,lotSize:'.02'}];assert.match(await useManagementSubmit()(selected(),draft),/changed/);
  rows=[order];policy={practice:false,canManage:false};assert.match(await useManagementSubmit()(selected(),draft),/unavailable/);
  policy={practice:false,canManage:true};account.generation=2;assert.match(await useManagementSubmit()(selected(),draft),/Account changed/);
  assert.equal(calls.length,0);
});
test('duplicate calls are locked, and late responses cannot cross an account switch',async()=>{
  reset();let resolve;reply=()=>new Promise(r=>{resolve=r;});
  const sent=useManagementSubmit()(selected(),draft);
  assert.match(await useManagementSubmit()(selected(),draft),/Another request/);assert.equal(calls.length,1);
  account.generation=2;management.getState().reset();flow.setState(flow.getInitialState(),true);resolve({accepted:true});await sent;
  assert.deepEqual(management.getState().results,{});assert.equal(flow.getState().inFlight,false);
});
test('lost responses remain locked after leaving the ticket; definite failures retain their reason',async()=>{
  reset();reply=async()=>{throw {status:'TIMEOUT_ERROR'};};await useManagementSubmit()(selected(),draft);
  assert.equal(management.getState().results['12'].status,'checking');management.getState().select(undefined);
  assert.match(await useManagementSubmit()(selected(),draft),/unresolved/);assert.equal(calls.length,1);
  reset();reply=async()=>{throw {status:400,data:{message:'Order no longer open'}};};await useManagementSubmit()(selected(),draft);
  assert.equal(management.getState().results['12'].status,'rejected');assert.equal(management.getState().results['12'].message,'Order no longer open');
});
test('modify sends only the changed fields and cancellation sends no entry or protection',async()=>{
  reset();await useManagementSubmit()({...selected(),action:'edit'},draft);
  assert.equal(calls[0].sl,3995);assert.equal(calls[0].tp,undefined);assert.equal(calls[0].cancelOrder,false);
  reset();const pending={...order,orderStatus:'PENDING'};rows=[pending];
  await useManagementSubmit()({...selected(),order:pending,action:'cancel'},draft);
  assert.equal(calls[0].cancelOrder,true);assert.equal(calls[0].sl,undefined);assert.equal(calls[0].exitLotSize,undefined);
});

const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function component(file,mocks){
  const js=ts.transpileModule(readFileSync(new URL(file,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}},icons=new Proxy({},{get:()=>props=>React.createElement('svg',{'aria-hidden':true,...props})});
  new Function('require','module','exports',js)(name=>name==='lucide-react'?icons:mocks[name]??require(name),module,module.exports);return module.exports;
}
const volume=await import(local('lib/volume.ts')),connected=await import(local('lib/connectedOrders.ts')),positions=await import(local('lib/positionPnl.ts'));
const display={formatPrice:n=>n==null?'—':Number(n).toFixed(2),instrument:()=>({name:'Gold / US dollar',digits:2,contractSize:100,baseCurrency:'XAU',quoteCurrency:'USD'})};
const managementHook=selector=>selector(management.getState());managementHook.getState=management.getState;
const mocks={
  '@/components/OrderEntry/OrderEntry':{OrderEntry:()=>null},
  '@/hooks/useTradeManagement':{useManagementTracking(){},useManagementSubmit:()=>async()=>{throw Error('Rendering must not execute');}},
  '@/store/useTradeManagement':{useTradeManagement:managementHook},'@/store/useUIStore':{useUIStore(){}},
  '@/store/useOrderFlow':{useOrderFlow:selectFlow},'@/store/usePracticeStore':{usePracticeStore:selector=>selector({quotes:{XAUUSD:quote}})},
  '@/store/usePriceStore':{usePriceStore:selector=>selector({prices:{XAUUSD:quote}})},
  '@/hooks/useExecutionPolicy':{useExecutionPolicy:()=>policy},'@/hooks/useMarketDisplay':{useMarketDisplay:()=>display},
  '@/hooks/useExecutableQuote':{useExecutableQuote:()=>({...quote,timestamp:Date.now()})},'@/hooks/useTradingAccountId':{useTradingAccountId:()=>77},
  '@/lib/positionPnl':positions,'@/lib/connectedOrders':connected,'@/lib/tradeManagement':logic,
  '@/lib/contracts':{shiftPendingEntry},'@/lib/freshness':await import(local('lib/freshness.ts')),'@/lib/practice':engine,
  '@/lib/tradingWorkflow':{showActivity(){},viewInstrument(){}},'@/lib/openTradeManagement':{openTradeManagement(){}},
  './InstrumentIcon':{InstrumentIcon:()=>null},'./CloseVolumePresets':component('components/terminal/CloseVolumePresets.tsx',{'@/lib/volume':volume}),
};
const {ManagementEditor,ManagementOutcome}=component('components/terminal/TradeManagementTicket.tsx',mocks);
const renderEditor=(selection=selected(),current=order)=>renderToStaticMarkup(React.createElement(ManagementEditor,{selection,current,refresh(){}}));
test('the rendered close ticket shows full and partial controls, exact remainder and indicative bid-side P&L',()=>{
  reset();const html=renderEditor();
  assert.match(html,/Full close/);assert.match(html,/Partial close/);assert.match(html,/Close full position · 0.03 lots/);
  assert.match(html,/Remaining<\/dt><dd>0 lots/);assert.match(html,/−\$3.00/);
  assert.match(html,/Bid · sell to close/);assert.match(html,/remaining position keeps|closes the full position/);
});
test('a minimum-lot position cannot offer an unexecutable partial close',()=>{
  reset();const small={...order,lotSize:'.01'},html=renderEditor({...selected(),order:small},small);
  assert.match(html,/<button[^>]*disabled=""[^>]*>Partial close/);
  assert.doesNotMatch(html,/25%|50%/);assert.match(html,/All · 0.01 lots/);
});
test('the editor shows original and proposed protection and never offers to remove it',()=>{
  reset();const html=renderEditor({...selected(),action:'edit',initial:{sl:3995}});
  assert.match(html,/Stop loss &amp; take profit/);assert.match(html,/<del>3990.00<\/del> → 3995.00/);
  assert.match(html,/Preview changes on the chart/);assert.match(html,/cannot be removed/);assert.match(html,/Save changes/);
});
test('pending projected P&L uses the proposed entry, not the original entry',()=>{
  reset();const pending={...order,orderStatus:'PENDING',sl:'3985',tp:'4000',orderDetails:{entrylimit:'3990',entryExecutionType:'LIMIT'}};
  const html=renderEditor({...selected(),order:pending,action:'edit',initial:{limitPrice:3980,sl:3975,tp:3990}},pending);
  assert.match(html,/−\$15.00/);assert.match(html,/\+\$30.00/);
  assert.match(html,/Limit\/Stop type stays fixed/);
});
test('rendered stale trades explain the conflict and offer reload rather than sending',()=>{
  reset();const html=renderEditor(selected(),{...order,lotSize:'.02'});
  assert.match(html,/changed while you were editing/);assert.match(html,/Reload latest details/);
  assert.match(html,/<button[^>]*type="submit"[^>]*disabled=""/);
  const missing=renderToStaticMarkup(React.createElement(ManagementEditor,{selection:selected(),current:undefined,refresh(){}}));assert.match(missing,/Refresh trade/);
});
test('result UI distinguishes requested, partially closed, fully closed and uncertain outcomes',()=>{
  for(const r of [result(),{...result(),status:'complete',remaining:.02,exitPrice:4000,pnl:-1},{...result(),status:'complete',remaining:0},{...result(),status:'unconfirmed'}]){
    const html=renderToStaticMarkup(React.createElement(ManagementOutcome,{result:r,current:order,refresh(){},onBack(){}}));
    assert.ok(html.includes(managementTitle(r)));assert.match(html,/role="status"/);
    if(r.status==='complete'&&r.remaining===.02){assert.match(html,/Remaining<\/dt><dd>0.02 lots/);assert.match(html,/Realised P&amp;L/);}
    if(r.status==='unconfirmed'){assert.match(html,/cannot be repeated yet/);assert.doesNotMatch(html,/Manage remaining trade/);}
  }
  const filled=renderToStaticMarkup(React.createElement(ManagementOutcome,{result:result('cancel',{status:'changed'}),current:order,refresh(){},onBack(){}}));assert.match(filled,/Manage filled position/);
});
