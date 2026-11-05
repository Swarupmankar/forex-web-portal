import {useUIStore} from '@/store/useUIStore';
import {useWorkspaceStore} from '@/store/useWorkspaceStore';
// Reveal a record in the bottom dock without changing the chart or the current order draft.
export function showActivity(tab: 'positions' | 'pending' | 'history' | 'alerts', tradeId?: string) {
  const workspace = useWorkspaceStore.getState();
  const ui = useUIStore.getState();
  workspace.setFocus(false);
  workspace.setActivityMaximized(false);
  workspace.setActivityExpanded(true);
  ui.setBottomTab(tab);
  workspace.setPanel('activity');
  if (tradeId) workspace.selectTrade(tradeId);
}

// Focus a table without discarding the chart, ticket draft or account session.
export function openActivityView(tab: 'positions' | 'pending' | 'history' | 'alerts') {
  const workspace=useWorkspaceStore.getState();
  useUIStore.getState().setBottomTab(tab);
  workspace.setPanel('activity');
  workspace.setActivityMaximized(true);
}

// Row selection inspects an instrument; it never navigates or submits a trade.
export function inspectInstrument(symbol: string) {
  useUIStore.getState().setActiveSymbol(symbol);
}

// Every instrument entry point opens the same draft. This function never submits an order.
export function composeOrder(symbol: string, side: 'BUY'|'SELL' = 'BUY', entry?: number) {
  useUIStore.getState().prepareOrder(symbol,side,entry);
  useWorkspaceStore.getState().openOrderTicket();
}

export function composePendingOrder(symbol:string, side:'BUY'|'SELL', type:'LIMIT'|'STOP', entry?:number) {
  useUIStore.getState().prepareOrder(symbol,side,entry);
  useUIStore.getState().setExecutionType(type);
  useWorkspaceStore.getState().openOrderTicket();
}

export function viewInstrument(symbol: string, tradeId?: string) {
  useUIStore.getState().setActiveSymbol(symbol);
  const workspace=useWorkspaceStore.getState();
  workspace.setFocus(false);
  workspace.setPanel('chart');
  workspace.setInstrumentPickerOpen(false);
  if(tradeId)workspace.selectTrade(tradeId);
}
