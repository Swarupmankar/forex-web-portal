import type {Order} from '@/types/trading';
import type {OrderChanges} from './connectedOrders';
import {managementPending,type ManagementAction} from './tradeManagement';
import {useTradeManagement} from '@/store/useTradeManagement';
import {useWorkspaceStore} from '@/store/useWorkspaceStore';
import {useUIStore} from '@/store/useUIStore';
import {useAccountStore} from '@/store/useAccountStore';
export function openTradeManagement(order:Order,action:ManagementAction,practice:boolean,initial?:OrderChanges,focus?:'sl'|'tp'|'entry') {
  useUIStore.getState().setActiveSymbol(order.symbol);
  const management=useTradeManagement.getState();
  if(!managementPending(management.results[String(order.id)]))management.clearResult(String(order.id));
  useTradeManagement.getState().select({key:crypto.randomUUID(),generation:useAccountStore.getState().generation,order,action,practice,initial,focus});
  const workspace=useWorkspaceStore.getState();
  workspace.selectTrade(String(order.id));workspace.openOrderTicket();
}
