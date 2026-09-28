import { store } from '@/store';
import { tradingApi } from '@/store/api/tradingApi';
import { useAccountStore } from '@/store/useAccountStore';
import { useUIStore } from '@/store/useUIStore';
import { usePracticeStore } from '@/store/usePracticeStore';
import { usePriceStore } from '@/store/usePriceStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { stopPriceSocket } from '@/services/priceSocket';
import { useOrderFlow } from '@/store/useOrderFlow';
import { resetServerClock } from '@/lib/serverClock';

export function clearTradingWorkspace() {
  // Abort reads before replacing credentials. The API also rejects late responses by generation.
  store.dispatch(tradingApi.util.getRunningQueriesThunk()).forEach(q => q.abort());
  store.dispatch(tradingApi.util.resetApiState());
  stopPriceSocket();
  usePriceStore.setState({ prices: {}, lastReceivedAt: 0, connection: 'disconnected' });
  resetServerClock();
  // An unconfirmed order belongs to the previous account; stop verifying it here.
  useOrderFlow.setState({ verifying: undefined, inFlight: false });
  useUIStore.getState().resetOrderDraft();
  useWorkspaceStore.setState({ selectedTradeId: '', toasts: [], alertOpen: false });
}
export function switchTradingAccount(id: string | 'practice') {
  if (id !== 'practice' && !useAccountStore.getState().accounts.some(a => a.id === id)) return;
  clearTradingWorkspace();
  const accounts = useAccountStore.getState();
  if (id === 'practice') accounts.invalidate();
  else accounts.activate(id);
  usePracticeStore.getState().setMode(id === 'practice' ? 'practice' : 'connected');
  const active = useAccountStore.getState();
  const account = active.accounts.find(a => a.id === active.activeId);
  useUIStore.setState({ isAuthenticated: !!account, tradingAccountNo: account?.username ?? '' });
}
export function disconnectTradingAccount(id: string) {
  if (useAccountStore.getState().activeId === id) switchTradingAccount('practice');
  useAccountStore.getState().remove(id);
  const active = useAccountStore.getState();
  const account = active.accounts.find(a => a.id === active.activeId);
  useUIStore.setState({ isAuthenticated: !!account, tradingAccountNo: account?.username ?? '' });
}
