import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),root=new URL('../src/',import.meta.url);
const uri=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const source=file=>ts.transpileModule(readFileSync(new URL(file,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const freshnessURL=uri(source('lib/freshness.ts'));
const alertsURL=uri(source('lib/priceAlerts.ts').replace(/(['"])\.\/freshness\1/,JSON.stringify(freshnessURL)));
const {priceAlertReached}=await import(alertsURL);
const {receiptSound,eventSound}=await import(uri(source('lib/executionSounds.ts')));
const now=Date.now(),rule={id:'a',symbol:'XAUUSD',mode:'connected',target:4000,direction:'above'},quote={symbol:'XAUUSD',bid:4000,ask:4000.3,timestamp:now};

test('alerts use inclusive Bid thresholds, active mode, valid prices and fresh feed data',()=>{
  assert.equal(priceAlertReached(rule,quote,'connected',now),true);
  assert.equal(priceAlertReached({...rule,direction:'below'},quote,'connected',now),true);
  assert.equal(priceAlertReached(rule,{...quote,bid:3999.9},'connected',now),false);
  assert.equal(priceAlertReached(rule,quote,'practice',now),false);
  assert.equal(priceAlertReached({...rule,triggeredAt:now},quote,'connected',now),false);
  for(const invalid of [undefined,{...quote,timestamp:now-20000},{...quote,lagMs:5000},{...quote,bid:NaN},{...quote,ask:3999},{...quote,symbol:'EURUSD'}])assert.equal(priceAlertReached(rule,invalid,'connected',now),false);
});
test('connected demo/live confirmations share sound cues and practice is not sounded twice',()=>{
  const receipt={practice:false,accountId:77,id:'12',status:'open'};
  const event={event:'ORDER_FILLED',tradingAccountId:77,ts:new Date(now).toISOString(),data:{orderId:12}};
  assert.deepEqual(receiptSound(receipt),eventSound(event));
  assert.equal(receiptSound({...receipt,practice:true}),undefined);
  for(const status of ['sending','submitted','checking','unconfirmed'])assert.equal(receiptSound({...receipt,status}),undefined);
  assert.equal(receiptSound({...receipt,status:'pending'}).kind,'pending');
  assert.equal(receiptSound({...receipt,status:'rejected'}).kind,'alert');
  assert.notEqual(receiptSound({...receipt,accountId:78}).key,receiptSound(receipt).key);
});
test('local close confirmations share a cue with the matching socket exit, not other accounts or older exits',()=>{
  const op={key:'close-a',accountId:77,startedAt:now,command:{action:'close',orderId:'12'}};
  const event={event:'ORDER_FILLED',tradingAccountId:77,ts:new Date(now+10).toISOString(),data:{orderId:12,exitPrice:4000}};
  assert.deepEqual(eventSound(event,op),{key:'management:close-a',kind:'closed'});
  assert.notEqual(eventSound({...event,tradingAccountId:88},op).key,'management:close-a');
  assert.notEqual(eventSound({...event,ts:new Date(now-10).toISOString()},op).key,'management:close-a');
  assert.equal(eventSound({...event,event:'UNKNOWN'}),undefined);
});

// Execute the actual alert hook against synchronous store and raw-feed fixtures.
function createStore(initial){let state=initial;const listeners=new Set();const hook=selector=>selector(state);hook.getState=()=>state;hook.subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};hook.set=update=>{const old=state;state={...state,...update};for(const fn of listeners)fn(state,old);};return hook;}
const workspace=createStore({alerts:[],tradeSounds:true}),prices=createStore({prices:{},connection:'connected'}),practice=createStore({mode:'connected',quotes:{}});
let notices=[],tones=[],raw,cleanup;
workspace.set({triggerAlert:id=>workspace.set({alerts:workspace.getState().alerts.map(a=>a.id===id?{...a,triggeredAt:Date.now()}:a)}),notify:(...args)=>notices.push(args)});
globalThis.__alertFixture={useEffect:fn=>{cleanup=fn();},useWorkspaceStore:workspace,usePriceStore:prices,usePracticeStore:practice,onRawTick:fn=>{raw=fn;return()=>{raw=undefined;};},playTradeSoundOnce:(...args)=>tones.push(args)};
const fixture=(...names)=>uri(names.map(name=>`export const ${name}=globalThis.__alertFixture.${name};`).join('\n'));
const modules={react:fixture('useEffect'),'@/store/useWorkspaceStore':fixture('useWorkspaceStore'),'@/store/usePriceStore':fixture('usePriceStore'),'@/store/usePracticeStore':fixture('usePracticeStore'),'@/services/priceSocket':fixture('onRawTick'),'@/lib/tradeSound':fixture('playTradeSoundOnce'),'@/lib/priceAlerts':alertsURL};
const {usePriceAlerts}=await import(uri(source('hooks/usePriceAlerts.ts').replace(/from\s+(['"])([^'"]+)\1/g,(_,q,name)=>'from '+JSON.stringify(modules[name]))));
function resetAlerts(){cleanup?.();cleanup=undefined;workspace.set({alerts:[],tradeSounds:true});prices.set({prices:{},connection:'connected'});practice.set({mode:'connected',quotes:{}});notices=[];tones=[];}
test('a brief target touch in a raw tick triggers once even if the next rendered price is below it',()=>{
  resetAlerts();workspace.set({alerts:[rule]});usePriceAlerts();
  raw({...quote,receivedAt:Date.now()});raw({...quote,bid:3998,receivedAt:Date.now()});
  prices.set({prices:{XAUUSD:{...quote,bid:3998,timestamp:Date.now()}}});
  assert.equal(notices.length,1);assert.equal(tones.length,1);assert.ok(workspace.getState().alerts[0].triggeredAt);
  raw({...quote,receivedAt:Date.now()});assert.equal(notices.length,1);cleanup();
});
test('new alerts evaluate current prices, respect mute and wait for a connected feed',()=>{
  resetAlerts();prices.set({prices:{XAUUSD:{...quote,timestamp:Date.now()}},connection:'disconnected'});workspace.set({tradeSounds:false});usePriceAlerts();
  workspace.set({alerts:[rule]});assert.equal(notices.length,0);
  prices.set({connection:'connected'});assert.equal(notices.length,1);assert.equal(tones.length,0);
  workspace.set({alerts:[...workspace.getState().alerts,{...rule,id:'b'}]});assert.equal(notices.length,2);
  cleanup();
});
test('practice monitors only simulated quotes and cleans up subscriptions on leaving the mode',()=>{
  resetAlerts();practice.set({mode:'practice'});workspace.set({alerts:[{...rule,mode:'practice'}]});usePriceAlerts();
  assert.equal(raw,undefined);prices.set({prices:{XAUUSD:{...quote,timestamp:Date.now()}}});assert.equal(notices.length,0);
  practice.set({quotes:{XAUUSD:{...quote,timestamp:Date.now()}}});assert.equal(notices.length,1);
  cleanup();workspace.set({alerts:[{...rule,id:'after-cleanup',mode:'practice'}]});assert.equal(notices.length,1);
});
test('audio deduplicates socket/receipt repeats and coalesces bursts without affecting execution',async()=>{
  const frequencies=[];
  class Context {state='running';currentTime=1;destination={};createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}createOscillator(){return {frequency:{setValueAtTime:n=>frequencies.push(n)},connect(){},disconnect(){},start(){},stop(){}};}}
  globalThis.window={AudioContext:Context};
  const sound=await import(uri(source('lib/tradeSound.ts')+'\n// isolated sound fixture'));
  try {
    assert.equal(await sound.playTradeSoundOnce('fill:1','filled'),true);
    await sound.playTradeSoundOnce('fill:1','filled');await sound.playTradeSoundOnce('fill:2','filled');
    assert.deepEqual(frequencies,[660,880]);
  } finally {delete globalThis.window;}
});

const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const module={exports:{}},code=ts.transpileModule(readFileSync(new URL('components/terminal/TradeDetails.tsx',root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const icons=new Proxy({},{get:()=>()=>React.createElement('svg')});
const mocks={'lucide-react':icons,'./Dialog':{Dialog:({title,children,className})=>React.createElement('section',{role:'dialog','aria-label':title,className},children)},'./InstrumentIcon':{InstrumentIcon:()=>null},'@/hooks/useMarketDisplay':{useMarketDisplay:()=>({formatPrice:value=>value==null?'—':Number(value).toFixed(2)})},'@/lib/connectedOrders':{orderEntry:o=>Number(o.orderDetails?.entryPrice)}};
new Function('require','module','exports',code)(name=>mocks[name]??require(name),module,module.exports);
test('history details render as a modal with the selected exit rather than a side inspector',()=>{
  const order={id:'long-order-identifier-12345678901234567890',exitRowId:'exit-2',symbol:'XAUUSD',orderType:'SELL',lotSize:.01,pnl:3.5,swap:0,commission:.04,orderStatus:'COMPLETED',createdAt:'2026-11-04T00:00:00Z',closedAt:'2026-11-04T00:10:00Z',orderDetails:{entryPrice:4000,exitPrice:3996.5}};
  const html=renderToStaticMarkup(React.createElement(module.exports.TradeDetails,{order,onClose(){}}));
  assert.match(html,/role="dialog"/);assert.match(html,/trade-details-dialog/);assert.match(html,/Closed volume/);assert.match(html,/3996.50/);assert.doesNotMatch(html,/<aside/);
  const missingExit={...order,currentPrice:9999,orderDetails:{entryPrice:4000}};
  const missing=renderToStaticMarkup(React.createElement(module.exports.TradeDetails,{order:missingExit,onClose(){}}));
  assert.doesNotMatch(missing,/9999.00/,'a live quote must not be presented as a historical exit');
  assert.match(missing,/Exit<\/dt><dd>—/);
  const practiceExit=renderToStaticMarkup(React.createElement(module.exports.TradeDetails,{order:{...missingExit,exitPrice:3996.5},onClose(){}}));
  assert.match(practiceExit,/Exit<\/dt><dd>3996.50/);
});
