import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const source = name => ts.transpileModule(readFileSync(new URL('../src/' + name, import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const outcomeURL = uri(source('lib/orderOutcome.ts'));
const layoutURL = uri(source('lib/workspaceLayout.ts'));
const {confirmReceipt, expireReceipt, receiptDestination} = await import(uri(source('lib/orderReceipt.ts').replace(/(['"])\.\/orderOutcome\1/,JSON.stringify(outcomeURL))));
const {activityRecords, activitySummary} = await import(uri(source('lib/activityRecords.ts')));
const {activityHeight, CHART_RESERVED_SPACE, ticketVisible} = await import(layoutURL);
const {normalizeInstruments} = await import(uri(source('lib/contracts.ts')));

const storage = new Map();
globalThis.localStorage = {getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
const workspaceURL = uri(source('store/useWorkspaceStore.ts')
  .replace(/(['"])@\/lib\/notifications\1/g,JSON.stringify(uri(source('lib/notifications.ts'))))
  .replace(/(['"])@\/lib\/workspaceLayout\1/,JSON.stringify(layoutURL))
  .replace(/(['"])zustand\1/,JSON.stringify(pathToFileURL(require.resolve('zustand')).href))
  .replace(/(['"])zustand\/middleware\1/,JSON.stringify(pathToFileURL(require.resolve('zustand/middleware')).href)));
const {useWorkspaceStore:w} = await import(workspaceURL);

const startedAt = Date.now();
const request = {symbol:'XAUUSD',orderType:'BUY',executionType:'MARKET',lotSize:0.01};
const receipt = {request,status:'submitted',practice:false,key:'order-a',startedAt,knownIds:['10']};
const order = {id:11,...request,createdAt:new Date(startedAt).toISOString(),orderStatus:'OPEN'};

test('an accepted request or SENDING row is not shown as a filled position',()=>{
  assert.equal(confirmReceipt(receipt,[]),receipt);
  const sending=confirmReceipt(receipt,[{...order,orderStatus:'SENDING'}]);
  assert.equal(sending.status,'submitted');assert.equal(sending.id,'11');
  const confirmed=confirmReceipt(receipt,[order]);
  assert.equal(confirmed.status,'open'); assert.equal(confirmed.id,'11');
  assert.equal(confirmReceipt(confirmed,[order]),confirmed);
});
test('old and ambiguous same-symbol executions cannot confirm a new order',()=>{
  assert.equal(confirmReceipt(receipt,[{...order,id:10}]),receipt);
  assert.equal(confirmReceipt(receipt,[order,{...order,id:12}]),receipt);
  assert.equal(confirmReceipt(receipt,[{...order,lotSize:0.02}]),receipt);
  assert.equal(confirmReceipt(receipt,[{...order,createdAt:new Date(startedAt-300000).toISOString()}]),receipt);
});
test('identified pending fills move the result link to positions even after entry details change',()=>{
  const pending={...receipt,status:'pending',id:'11',request:{...request,executionType:'LIMIT',limitPrice:3990}};
  assert.equal(receiptDestination(pending),'pending');
  const filled=confirmReceipt(pending,[order]);
  assert.equal(filled.status,'open'); assert.equal(receiptDestination(filled),'positions');
  assert.equal(confirmReceipt(pending,[{...order,id:12}]),pending);
});
test('delayed confirmations become uncertain, can recover, and never change confirmed results',()=>{
  assert.equal(expireReceipt(receipt,startedAt+29999),receipt);
  const late=expireReceipt(receipt,startedAt+30000);
  assert.equal(late.status,'unconfirmed');
  assert.equal(confirmReceipt(late,[order]).status,'open');
  const filled={...receipt,status:'open'};
  assert.equal(expireReceipt(filled,startedAt+60000),filled);
});
test('practice pending receipts use the same pending-to-position transition',()=>{
  const pending={...receipt,practice:true,status:'pending',id:'practice-1'};
  assert.equal(confirmReceipt(pending,[{...order,id:'practice-1',orderStatus:undefined,status:'OPEN'}]).status,'open');
});

const rows=[
  {id:1,symbol:'XAUUSD',orderType:'BUY',lotSize:'.01',pnl:'12',orderStatus:'COMPLETED',closedAt:'2026-11-03T10:00:00Z',createdAt:'2026-11-02T10:00:00Z'},
  {id:2,symbol:'EURUSD',orderType:'SELL',lotSize:'.02',pnl:-3,orderStatus:'COMPLETED',closedAt:'2026-11-03T11:00:00Z',createdAt:'2026-11-01T10:00:00Z'},
  {id:3,symbol:'XAUUSD',orderType:'BUY_LIMIT',lotSize:'1',pnl:null,orderStatus:'CANCELLED',updatedAt:'2026-11-03T12:00:00Z'},
];
test('history searches by symbol, ID and side with independent completion filters',()=>{
  assert.deepEqual(activityRecords(rows,'  xau  ','closed','newest',true).map(r=>r.id),[1]);
  assert.deepEqual(activityRecords(rows,'','cancelled','newest',true).map(r=>r.id),[3]);
  assert.deepEqual(activityRecords(rows,'2','all','newest',true).map(r=>r.id),[2]);
  assert.deepEqual(activityRecords(rows,'SELL','all','newest',true).map(r=>r.id),[2]);
  assert.deepEqual(activityRecords(rows,'BTC','all','newest',true),[]);
});
test('history orders by exit time, open positions by entry time, without mutating records',()=>{
  const before=structuredClone(rows);
  assert.deepEqual(activityRecords(rows,'','all','newest',true).map(r=>r.id),[3,2,1]);
  assert.deepEqual(activityRecords(rows,'','all','oldest',false).map(r=>r.id),[2,1,3]);
  assert.deepEqual(activityRecords(rows,'','all','symbol',true).map(r=>r.id),[2,3,1]);
  assert.deepEqual(rows,before);
});
test('profit sort preserves unknown P&L as unknown and places it below losses',()=>{
  const unknown={...rows[2],id:4,pnl:''};
  assert.deepEqual(activityRecords([...rows,unknown],'','all','profit',true).map(r=>r.id),[1,2,3,4]);
  assert.equal(unknown.pnl,'');
});
test('closed-history filter does not hide current open or pending orders',()=>{
  assert.equal(activityRecords(rows,'','cancelled','newest',false).length,3);
});
test('volume totals exclude cancelled orders and do not turn missing exit sizes into zero',()=>{
  assert.deepEqual(activitySummary(rows),{records:3,volume:.03,cancelled:1});
  assert.equal(activitySummary([{...rows[0],lotSize:undefined,volume:.02}]).volume,.02);
  for(const lotSize of [undefined,'',NaN,-1]) assert.ok(Number.isNaN(activitySummary([{...rows[0],lotSize}]).volume));
  assert.deepEqual(activitySummary([]),{records:0,volume:0,cancelled:0});
});
test('activity resizing preserves room for the chart and clamps stored dimensions',()=>{
  assert.equal(activityHeight(9999),520); assert.equal(activityHeight(-1),180);
  assert.equal(activityHeight(NaN),220); assert.equal(activityHeight(350.6),351);
  assert.equal(activityHeight(520,600),240); assert.equal(activityHeight(520,200),180);
});
test('switching activity tabs keeps a full-page workspace until deliberately collapsed',()=>{
  w.getState().resetLayout();
  w.getState().setPanel('activity'); w.getState().setActivityMaximized(true);
  w.getState().setActivityExpanded(true);
  assert.equal(w.getState().activityMaximized,true);
  w.getState().setActivityExpanded(false);
  assert.equal(w.getState().activityMaximized,false);
});
test('navigation can reopen hidden panels and reset restores a usable trading desk',()=>{
  w.getState().setMarketsOpen(false); w.getState().setTicketOpen(false);
  w.getState().setActivityMaximized(true); w.getState().setPanel('markets');
  assert.equal(w.getState().marketsOpen,true); assert.equal(w.getState().activityMaximized,false);
  w.getState().setPanel('trade'); assert.equal(w.getState().ticketOpen,true);
  w.getState().setFocus(true); w.getState().setActivityHeight(500); w.getState().resetLayout();
  assert.equal(w.getState().activityHeight,220); assert.equal(w.getState().panel,'chart'); assert.equal(w.getState().focusChart,false);
});
test('older persisted layouts get defaults and malformed dimensions cannot break the desk',()=>{
  const merge=w.persist.getOptions().merge;
  const legacy=merge({showGrid:false},w.getInitialState());
  assert.equal(legacy.marketsOpen,true); assert.equal(legacy.ticketOpen,false); assert.equal(legacy.activityHeight,220); assert.equal(legacy.showGrid,false);
  const invalid=merge({marketsOpen:'no',ticketOpen:false,activityHeight:-900},w.getInitialState());
  assert.equal(invalid.marketsOpen,true); assert.equal(invalid.ticketOpen,false); assert.equal(invalid.activityHeight,180);
});
test('energy instruments are discoverable separately from metals and forex',()=>{
  const catalogue=normalizeInstruments([{symbol:'XNGUSD',category:'Energy'},{symbol:'XTIUSD',category:'Oil'},{symbol:'XAUUSD',category:'Metals'},{symbol:'EURUSD',category:'Forex'}]);
  assert.deepEqual(catalogue.map(s=>s.category),['Energies','Energies','Metals','Forex']);
});

const zustandURL=pathToFileURL(require.resolve('zustand')).href;
const accountSessionURL=uri(source('lib/accountSessions.ts'));
const accountStoreURL=uri(source('store/useAccountStore.ts').replace(/(['"])zustand\1/,JSON.stringify(zustandURL)).replace(/(['"])@\/lib\/accountSessions\1/,JSON.stringify(accountSessionURL)));
const uiURL=uri(source('store/useUIStore.ts').replace(/(['"])zustand\1/,JSON.stringify(zustandURL)).replace(/(['"])\.\/useAccountStore\1/,JSON.stringify(accountStoreURL)));
const {useUIStore:u}=await import(uiURL);
const {composeOrder,composePendingOrder,viewInstrument,showActivity,inspectInstrument,openActivityView}=await import(uri(source('lib/tradingWorkflow.ts').replace(/(['"])@\/store\/useUIStore\1/,JSON.stringify(uiURL)).replace(/(['"])@\/store\/useWorkspaceStore\1/,JSON.stringify(workspaceURL))));
function resetWorkflow(){u.setState(u.getInitialState());w.setState(w.getInitialState());}

test('separate Positions and History views keep the same account draft and return to the chart',()=>{
  resetWorkflow();composeOrder('EURUSD','SELL',1.12);u.getState().setVolumeInput('.07');u.getState().setStopLoss('1.15');
  for(const tab of ['positions','history']){
    openActivityView(tab);assert.equal(u.getState().bottomTab,tab);assert.equal(w.getState().panel,'activity');
    assert.equal(w.getState().activityMaximized,true);assert.equal(w.getState().activityExpanded,true);
    assert.equal(u.getState().activeSymbol,'EURUSD');assert.equal(u.getState().pendingEntry,'1.12');assert.equal(u.getState().volumeInput,'.07');assert.equal(u.getState().stopLoss,'1.15');
  }
  viewInstrument('EURUSD');assert.equal(w.getState().activityMaximized,false);assert.equal(w.getState().panel,'chart');
  openActivityView('positions');w.getState().openOrderTicket();assert.equal(w.getState().activityMaximized,false);assert.equal(w.getState().ticketOpen,true);
});

test('explicit Limit and Stop choices survive chart price edits and reset for another account or symbol',()=>{
  resetWorkflow();u.getState().setExecutionType('STOP');u.getState().setPendingEntry('4020');
  composeOrder('XAUUSD','BUY',4030);
  assert.equal(u.getState().pendingOrderType,'STOP');assert.equal(u.getState().pendingEntry,'4030');
  u.getState().setPendingEntry('3990');assert.equal(u.getState().pendingOrderType,'STOP');
  u.getState().setExecutionType('LIMIT');assert.equal(u.getState().pendingEntry,'3990');
  u.getState().setExecutionType('MARKET');assert.equal(u.getState().pendingEntry,'');assert.equal(u.getState().pickingEntry,false);
  u.getState().setExecutionType('STOP');viewInstrument('EURUSD');assert.equal(u.getState().pendingOrderType,'LIMIT');
  u.getState().setExecutionType('STOP');u.getState().resetOrderDraft();assert.equal(u.getState().orderMode,'MARKET');assert.equal(u.getState().pendingOrderType,'LIMIT');
});

test('chart and toolbar actions prepare one ticket, preserving volume and the selected entry',()=>{
  resetWorkflow();u.getState().setVolumeInput('0.07');w.getState().setActivityMaximized(true);
  composeOrder('EURUSD','SELL',1.12);
  assert.equal(u.getState().activeSymbol,'EURUSD');assert.equal(u.getState().selectedOrderSide,'SELL');
  assert.equal(u.getState().pendingEntry,'1.12');assert.equal(u.getState().orderMode,'PENDING');assert.equal(u.getState().volumeInput,'0.07');
  assert.equal(w.getState().ticketOpen,true);assert.equal(w.getState().panel,'trade');assert.equal(w.getState().activityMaximized,false);
  u.getState().setPendingEntry('1.125');
  assert.equal(u.getState().pendingEntry,'1.125');
  w.getState().closeOrderTicket();assert.equal(w.getState().panel,'chart');assert.equal(w.getState().ticketOpen,false);
  assert.equal(u.getState().pendingEntry,'1.125');
});
test('switching symbol or direction clears incompatible protection without clearing lot size',()=>{
  resetWorkflow();u.getState().setVolumeInput('0.04');u.getState().setStopLoss('3990');u.getState().setTakeProfit('4050');
  composeOrder('XAUUSD','BUY');assert.equal(u.getState().stopLoss,'3990');
  composeOrder('XAUUSD','SELL');assert.equal(u.getState().stopLoss,'');assert.equal(u.getState().takeProfit,'');
  u.getState().setStopLoss('4050');u.getState().setPendingEntry('4020');u.getState().setOrderMode('PENDING');
  viewInstrument('EURUSD');assert.equal(u.getState().stopLoss,'');assert.equal(u.getState().pendingEntry,'');assert.equal(u.getState().orderMode,'MARKET');assert.equal(u.getState().volumeInput,'0.04');
});
test('instrument switching retains up to six chart tabs without duplication',()=>{
  resetWorkflow();
  for(const symbol of ['EURUSD','GBPUSD','USDJPY','AUDUSD','XAGUSD','BTCUSD','ETHUSD'])viewInstrument(symbol);
  assert.equal(u.getState().chartSymbols.length,6);assert.equal(u.getState().activeSymbol,'ETHUSD');
  viewInstrument('BTCUSD');assert.equal(u.getState().chartSymbols.length,6);
  assert.equal(new Set(u.getState().chartSymbols).size,6);
  u.getState().closeChartSymbol('BTCUSD');assert.equal(u.getState().chartSymbols.includes('BTCUSD'),false);assert.ok(u.getState().chartSymbols.includes(u.getState().activeSymbol));
  for(const symbol of [...u.getState().chartSymbols])u.getState().closeChartSymbol(symbol);
  assert.equal(u.getState().chartSymbols.length,1);assert.equal(u.getState().activeSymbol,u.getState().chartSymbols[0]);
});
test('viewing an instrument returns from history, closes the picker and selects the trade',()=>{
  resetWorkflow();w.getState().setActivityMaximized(true);w.getState().setInstrumentPickerOpen(true);
  viewInstrument('XAUUSD','1234');
  assert.equal(w.getState().panel,'chart');assert.equal(w.getState().activityMaximized,false);assert.equal(w.getState().instrumentPickerOpen,false);assert.equal(w.getState().selectedTradeId,'1234');
});
test('account draft reset clears pending chart selection and connected one-click consent',()=>{
  resetWorkflow();composeOrder('XAUUSD','BUY',3990);u.getState().setPickingEntry(true);u.getState().setStopLoss('3980');u.getState().setOneClickTrading(true);u.getState().setOneClickClose(true);
  u.getState().resetOrderDraft();
  assert.equal(u.getState().pendingEntry,'');assert.equal(u.getState().pickingEntry,false);assert.equal(u.getState().stopLoss,'');assert.equal(u.getState().oneClickTrading,false);assert.equal(u.getState().orderMode,'MARKET');
  assert.equal(u.getState().oneClickClose,false);
});

test('one-tap entry and closing require separate opt-ins, cleared when a connected session ends',()=>{
  resetWorkflow();
  assert.equal(u.getState().oneClickTrading,false);assert.equal(u.getState().oneClickClose,false);
  u.getState().setOneClickTrading(true);assert.equal(u.getState().oneClickClose,false);
  u.getState().setOneClickClose(true);u.getState().setOneClickTrading(false);
  assert.equal(u.getState().oneClickClose,true);
  u.getState().setOneClickTrading(true);u.getState().endSession('Session expired');
  assert.equal(u.getState().oneClickTrading,false);assert.equal(u.getState().oneClickClose,false);
});

test('practice quick closing is a separate saved preference with a safe legacy default',()=>{
  resetWorkflow();w.getState().setOneClickPractice(true);
  assert.equal(w.getState().oneClickClosePractice,false);
  w.getState().setOneClickClosePractice(true);
  const saved=w.persist.getOptions().partialize(w.getState());
  assert.equal(saved.oneClickClosePractice,true);
  const restored=w.persist.getOptions().merge(saved,w.getInitialState());
  assert.equal(restored.oneClickClosePractice,true);
  const legacy=w.persist.getOptions().merge({oneClickPractice:true},w.getInitialState());
  assert.equal(legacy.oneClickClosePractice,false);
  assert.equal(u.getState().oneClickClose,false,'practice consent must not arm connected accounts');
});
test('chart-first entry ignores a previously persisted open order panel',()=>{
  const restored=w.persist.getOptions().merge({ticketOpen:true,marketsOpen:false},w.getInitialState());
  assert.equal(restored.ticketOpen,false);assert.equal(restored.marketsOpen,false);
  resetWorkflow();w.getState().setPracticeFavorites(['EURUSD']);
  assert.deepEqual(w.getState().practiceFavorites,['EURUSD']);
});

test('starting another draft invalidates an earlier review even for the same instrument and side',()=>{
  resetWorkflow();composeOrder('XAUUSD','BUY',3990);
  const original=u.getState().orderDraftVersion;
  composeOrder('XAUUSD','BUY',3995);
  assert.ok(u.getState().orderDraftVersion>original);assert.equal(u.getState().pendingEntry,'3995');
  assert.equal(w.getInitialState().oneClickPractice,false);
});


test('watchlist selection updates the shared instrument without submitting or discarding volume', () => {
  resetWorkflow();
  u.getState().setVolumeInput('0.07');
  inspectInstrument('EURUSD');
  assert.equal(u.getState().activeSymbol, 'EURUSD');
  assert.equal(u.getState().volumeInput, '0.07');
  assert.equal(w.getState().ticketOpen, false);
  composeOrder('EURUSD', 'SELL');
  assert.equal(w.getState().ticketOpen, true);
  assert.equal(u.getState().selectedOrderSide, 'SELL');
});

test('switching the bottom dock preserves the chart, ticket and protections', () => {
  resetWorkflow();
  composeOrder('XAUUSD', 'BUY', 3990);
  u.getState().setStopLoss('3980');
  u.getState().setTakeProfit('4010');
  u.getState().setVolumeInput('0.03');
  w.getState().setFocus(true);
  for (const tab of ['history', 'positions', 'pending', 'alerts']) {
    showActivity(tab, '42');
    assert.equal(u.getState().bottomTab, tab);
    assert.equal(w.getState().activityMaximized, false);
    assert.equal(w.getState().activityExpanded, true);
    assert.equal(w.getState().focusChart, false);
    assert.equal(w.getState().ticketOpen, true);
    assert.equal(w.getState().selectedTradeId, '42');
    assert.equal(u.getState().activeSymbol, 'XAUUSD');
    assert.equal(u.getState().pendingEntry, '3990');
    assert.equal(u.getState().volumeInput, '0.03');
    assert.equal(u.getState().stopLoss, '3980');
    assert.equal(u.getState().takeProfit, '4010');
  }
});

test('viewing a history instrument keeps the bottom history view and never starts an order', () => {
  resetWorkflow();
  showActivity('history');
  viewInstrument('XAUUSD', '42');
  assert.equal(u.getState().bottomTab, 'history');
  assert.equal(w.getState().ticketOpen, false);
  assert.equal(w.getState().selectedTradeId, '42');
});

test('the one-page dock reserves chart space and clamps old saved heights', () => {
  assert.equal(activityHeight(520, 800, CHART_RESERVED_SPACE), 320);
  assert.equal(activityHeight(520, 1100, CHART_RESERVED_SPACE), 440);
  assert.equal(activityHeight(250, 500, CHART_RESERVED_SPACE), 200);
  assert.equal(activityHeight(NaN, 800, CHART_RESERVED_SPACE), 220);
});

test('compact layout restores hidden panels without replacing the draft or the chart', () => {
  resetWorkflow();
  assert.equal(w.getState().activityExpanded, true);
  assert.equal(w.getState().ticketOpen, false);
  composeOrder('XAUUSD', 'BUY', 3990);
  u.getState().setStopLoss('3980');
  u.getState().setVolumeInput('0.03');
  const version = u.getState().orderDraftVersion;
  w.getState().closeOrderTicket();
  w.getState().setMarketsOpen(false);
  w.getState().setFocus(true);
  w.getState().setMarketsOpen(true);
  assert.equal(w.getState().focusChart, false);
  assert.equal(w.getState().panel, 'markets');
  w.getState().openOrderTicket();
  assert.equal(w.getState().ticketOpen, true);
  assert.equal(w.getState().panel, 'trade');
  assert.equal(u.getState().pendingEntry, '3990');
  assert.equal(u.getState().stopLoss, '3980');
  assert.equal(u.getState().volumeInput, '0.03');
  assert.equal(u.getState().orderDraftVersion, version);
  showActivity('history');
  assert.equal(w.getState().activityExpanded, true);
  w.getState().resetLayout();
  assert.equal(w.getState().activityExpanded, true);
  assert.equal(w.getState().marketsOpen, true);
  assert.equal(w.getState().ticketOpen, false);
  assert.equal(u.getState().pendingEntry, '3990');
});

const {quoteSpread} = await import(uri(source('lib/marketPresentation.ts')));
test('spread uses ask minus bid without inventing a value for missing or invalid quotes', () => {
  assert.ok(Math.abs(quoteSpread({bid:4000.20,ask:4000.48}) - .28) < 1e-9);
  assert.ok(Math.abs(quoteSpread({bid:1.08440,ask:1.08452}) - .00012) < 1e-9);
  assert.equal(quoteSpread({bid:1,ask:1}), 0);
  for (const quote of [undefined, {bid:0,ask:1}, {bid:2,ask:1}, {bid:NaN,ask:2}, {bid:1,ask:Infinity}]) assert.equal(quoteSpread(quote), undefined);
});


test('ticket is visible on desktop by default, compact only when opened, and respects dismissal',()=>{
  assert.equal(ticketVisible(false,false,false),true);
  assert.equal(ticketVisible(false,false,true),false);
  assert.equal(ticketVisible(true,false,true),true);
  assert.equal(ticketVisible(false,true,false),false);
  resetWorkflow();w.getState().closeOrderTicket();
  assert.equal(w.getState().ticketDismissed,true);
  w.getState().openOrderTicket();assert.equal(w.getState().ticketDismissed,false);
});
test('each pending menu action prepares the exact side and type while preserving lot size',()=>{
  for(const side of ['BUY','SELL'])for(const type of ['LIMIT','STOP']){
    resetWorkflow();u.getState().setVolumeInput('0.07');
    composePendingOrder('XAUUSD',side,type,3999.5);
    assert.equal(u.getState().orderMode,'PENDING');
    assert.equal(u.getState().pendingOrderType,type);
    assert.equal(u.getState().selectedOrderSide,side);
    assert.equal(u.getState().pendingEntry,'3999.5');
    assert.equal(u.getState().volumeInput,'0.07');
    assert.equal(w.getState().ticketOpen,true);
  }
});


test('a tall saved activity panel cannot take most of a laptop workspace',()=>{
  for(const available of [500,600,700,800]){
    const height=activityHeight(520,available,CHART_RESERVED_SPACE);
    assert.ok(height<=available*.4);
    assert.ok(available-height>=CHART_RESERVED_SPACE);
    assert.ok(height>=180);
  }
});
test('compact density persists independently from watchlist reveal and order drafts',()=>{
  resetWorkflow();
  assert.equal(w.getState().density,'compact');
  w.getState().setDensity('comfortable');
  const persisted=w.persist.getOptions().partialize(w.getState());
  assert.equal(persisted.density,'comfortable');
  assert.equal(persisted.watchlistReveal,undefined);
  assert.equal(w.persist.getOptions().merge({density:'broken'},w.getInitialState()).density,'compact');
  u.getState().setVolumeInput('0.03');w.getState().setMarketsOpen(false);w.getState().setInstrumentPickerOpen(true);
  w.getState().revealWatchlist('SOLUSD');
  assert.equal(w.getState().marketsOpen,true);assert.equal(w.getState().instrumentPickerOpen,false);
  assert.equal(w.getState().watchlistReveal.symbol,'SOLUSD');
  assert.equal(u.getState().volumeInput,'0.03');
  const revision=w.getState().watchlistReveal.revision;
  w.getState().revealWatchlist('SOLUSD');assert.equal(w.getState().watchlistReveal.revision,revision+1);
});
