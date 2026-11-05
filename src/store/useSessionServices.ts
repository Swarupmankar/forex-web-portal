import { create } from 'zustand';
import { tradingToken, useAccountStore } from './useAccountStore';
import type { SessionServices } from '@/lib/server/sessionServices';
type State = { binding?: SessionServices; error?: string; loading: boolean; load: () => Promise<boolean>; clear: () => void };
export const useSessionServices = create<State>((set) => ({
  loading: false,
  clear: () => set({ binding: undefined, error: undefined, loading: false }),
  load: async () => {
    const generation = useAccountStore.getState().generation;
    set({ binding: undefined, error: undefined, loading: true });
    try {
      const response = await fetch('/api/trading/session/services', { headers: { Authorization: `Bearer ${tradingToken() || ''}` }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Trading services are unavailable.');
      if (generation !== useAccountStore.getState().generation) return false;
      const accounts = useAccountStore.getState();
      const selected = accounts.accounts.find(a => a.id === accounts.activeId);
      if (data.username && data.username !== selected?.username) throw new Error('The server returned a different trading account. Reopen the intended account from your client portal.');
      set({ binding: data, loading: false });
      return true;
    } catch (error) {
      if (generation === useAccountStore.getState().generation) set({ error: error instanceof Error ? error.message : 'Trading services are unavailable.', loading: false });
      return false;
    }
  },
}));
