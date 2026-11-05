import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),root=new URL('../src/',import.meta.url);
const uri=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const source=file=>ts.transpileModule(readFileSync(new URL(file,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const notifications=await import(uri(source('lib/notifications.ts'))),trade=await import(uri(source('lib/tradeNotifications.ts')));
const {queueNotification:queue,visibleNotifications,NOTIFICATION_LIMIT}=notifications;
const now=Date.now(),receipt={id:'501',accountId:77,key:'request-a',request:{symbol:'XAUUSD',lotSize:.01,orderType:'SELL',executionType:'MARKET'},practice:false,status:'submitted'};
const event={event:'ORDER_FILLED',tradingAccountId:77,severity:'INFORMATIONAL',title:'Order Filled',description:'Your SELL order for 0.01 lot XAUUSD filled at 3924.19.',data:{orderId:501,symbol:'XAUUSD',orderType:'SELL',lotSize:.01,fillPrice:3924.19},ts:new Date(now).toISOString()};
const add=(items,notice,id='generated',at=now)=>queue(items,notice.text,notice.kind,notice.options,id,at);

test('HTTP sent and socket fill update one notification without increasing its count',()=>{
  const sent=trade.receiptNotification(receipt),filled=trade.eventNotification(event);
  let items=add([],sent,'first');items=add(items,filled,'second',now+100);
  assert.equal(items.length,1);assert.equal(items[0].id,'first');assert.equal(items[0].count,1);
  assert.equal(items[0].title,'Order filled · #501');assert.equal(items[0].text,'Sell 0.01 lots · XAUUSD · 3,924.19');
  assert.equal(items[0].kind,'success');assert.equal(items[0].phase,'settled');
});
test('a socket fill before HTTP cannot be downgraded to sent, even after dismissing it',()=>{
  const filled=add([],trade.eventNotification(event),'filled');
  const dismissed=filled.map(t=>({...t,active:false}));
  assert.equal(add(dismissed,trade.receiptNotification(receipt)),dismissed);
  assert.equal(add(dismissed,trade.eventNotification(event)),dismissed,'duplicate events must not reopen an already dismissed result');
});
test('account observation fills share the same notification identity as socket confirmation',()=>{
  const socket=add([],trade.eventNotification(event));
  const observed=trade.receiptNotification({...receipt,status:'open',fillPrice:3924.19});
  assert.equal(add(socket,observed),socket);
  const rejected=trade.eventNotification({...event,event:'ORDER_REJECTED',data:{orderId:501,reason:'Market closed'},description:'Rejected'});
  const items=add(add([],trade.receiptNotification(receipt)),rejected);
  assert.equal(items.length,1);assert.equal(items[0].kind,'error');assert.equal(items[0].sticky,true);assert.match(items[0].text,/Market closed/);
});
test('orders and accounts do not collapse merely because they share symbol, side, volume or number',()=>{
  let items=[];
  for(const [accountId,id] of [[77,'501'],[77,'502'],[78,'501']])items=add(items,trade.receiptNotification({...receipt,accountId,id}),`${accountId}-${id}`);
  assert.equal(items.length,3);assert.equal(new Set(items.map(t=>t.key)).size,3);
  assert.notEqual(trade.orderNotificationKey(77,'501'),trade.orderNotificationKey(undefined,'501',true));
});
test('exit fills are not allowed to overwrite the original opening notification',()=>{
  const entry=trade.eventNotification(event),exit=trade.eventNotification({...event,data:{...event.data,exitPrice:3923.2,closeReason:'USER'}});
  assert.notEqual(entry.options.key,exit.options.key);
  assert.equal(add(add([],entry),exit,'exit').length,2);
});
test('bursts keep only fifty recent records and one ordinary popup',()=>{
  let items=[];
  for(let i=1;i<=70;i++)items=add(items,trade.receiptNotification({...receipt,id:String(i),status:'open'}),String(i),now+i);
  assert.equal(items.length,NOTIFICATION_LIMIT);assert.equal(items[0].id,'21');
  assert.deepEqual(visibleNotifications(items).map(t=>t.id),['70']);
  const archived=items.map(t=>({...t,active:false}));assert.equal(visibleNotifications(archived).length,0);assert.equal(archived.length,50);
});
test('a sticky failure stays visible alongside the newest ordinary trade, without growing the stack',()=>{
  let items=queue([],'Order failed','error',{},'error',now);
  for(let i=0;i<12;i++)items=add(items,trade.receiptNotification({...receipt,id:String(i)}),String(i),now+i+1);
  assert.deepEqual(visibleNotifications(items).map(t=>t.id),['11','error']);
  items=items.map(t=>t.id==='error'?{...t,active:false}:t);
  assert.deepEqual(visibleNotifications(items).map(t=>t.id),['11']);
});
test('repeated general messages count together, while dismissed old ones do not block a new notice',()=>{
  let items=queue([],'Connection restored','info',{},'1',now);
  items=queue(items,'Connection restored','info',{},'2',now+1);
  assert.equal(items.length,1);assert.equal(items[0].count,2);
  items=queue(items.map(t=>({...t,active:false})),'Connection restored','info',{},'3',now+2);
  assert.equal(items.length,2);assert.equal(items[1].count,1);
});
test('unidentified submissions use inline progress and unknown outcomes never claim a fill',()=>{
  assert.equal(trade.receiptNotification({...receipt,id:undefined}),undefined);
  const unknown=trade.receiptNotification({...receipt,status:'unconfirmed'});
  assert.equal(unknown.kind,'warning');assert.equal(unknown.options.sticky,true);assert.equal(unknown.options.phase,'progress');
  assert.match(unknown.text,/before retrying/);
  const noDetails=trade.eventNotification({...event,data:{orderId:501}});
  assert.equal(noDetails.text,event.description);
});

// Render the actual notification UI with local data. No browser or trading transport is used.
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
let state={toasts:[],notificationsOpen:false,dismissToast(){},setNotificationsOpen(){},clearToasts(){}};
const useWorkspaceStore=selector=>selector(state);useWorkspaceStore.getState=()=>state;
const icons=new Proxy({},{get:()=>props=>React.createElement('svg',{'aria-hidden':true,...props})});
const module={exports:{}},js=ts.transpileModule(readFileSync(new URL('components/terminal/ToastStack.tsx',root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const mocks={'@/store/useWorkspaceStore':{useWorkspaceStore},'@/lib/notifications':notifications,'./Dialog':{Dialog:({children,title})=>React.createElement('section',{'aria-label':title},children)},'lucide-react':icons};
new Function('require','module','exports',js)(name=>mocks[name]??require(name),module,module.exports);
const {ToastStack,NotificationButton}=module.exports;
test('rendered bursts show one compact toast and a control to review the rest',()=>{
  state.notificationsOpen=false;state.toasts=[];
  for(let i=0;i<20;i++)state.toasts=add(state.toasts,trade.receiptNotification({...receipt,id:String(i),status:'open'}),String(i),now+i);
  const html=renderToStaticMarkup(React.createElement(ToastStack));
  assert.equal((html.match(/class="terminal-toast /g)??[]).length,1);
  assert.match(html,/Order filled · #19/);assert.match(html,/Recent notifications/);assert.match(html,/aria-live="polite"/);
  const button=renderToStaticMarkup(React.createElement(NotificationButton));assert.match(button,/aria-haspopup="dialog"/);assert.match(button,/Recent notifications \(20\)/);
});
test('notification history renders full details and no popup over the dialog',()=>{
  state.notificationsOpen=true;
  const html=renderToStaticMarkup(React.createElement(ToastStack));
  assert.doesNotMatch(html,/class="toast-stack"/);assert.match(html,/Order filled · #0/);assert.match(html,/Order filled · #19/);
  assert.match(html,/Clear notifications/);assert.match(html,/current account session/);
});
