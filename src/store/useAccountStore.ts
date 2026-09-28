import { create } from 'zustand';
import { AccountSessionVault, loginSession, type AccountLogin, type TradingAccount } from '@/lib/accountSessions';
const vault = new AccountSessionVault();
const STORAGE = 'mm-terminal-sessions-v1';
const snapshot = () => ({ accounts: vault.accounts, activeId: vault.activeId, generation: vault.generation });
function save() {
  try { sessionStorage.setItem(STORAGE, vault.serialize()); } catch { /* Current tab still works when storage is unavailable. */ }
}
export const tradingToken = () => vault.token;
interface Accounts {
  accounts: TradingAccount[];
  activeId: string;
  generation: number;
  hydrated: boolean;
  hydrate: () => void;
  connect: (response: unknown, login: AccountLogin) => string;
  activate: (id: string) => void;
  invalidate: () => void;
  remove: (id: string) => void;
  expire: (id: string) => void;
  update: (id: string, data: unknown) => void;
}
export const useAccountStore = create<Accounts>((set, get) => ({
  ...snapshot(), hydrated: false,
  hydrate: () => {
    if (get().hydrated || typeof window === 'undefined') return;
    try {
      vault.restore(sessionStorage.getItem(STORAGE));
      // Migrate the previous single-account login once. Do not treat a portal token as trading authentication.
      const token = localStorage.getItem('trading_token');
      const username = localStorage.getItem('trading_account_no');
      if (!vault.accounts.length && token && username) {
        vault.add(loginSession({ token }, { username, brokerId: '', serverId: '', brokerName: '', serverName: '' }));
      }
      save();
      ['trading_token', 'trading_account_no', 'access_token'].forEach(k => localStorage.removeItem(k));
    } catch { /* A fresh connection is available if browser storage is blocked. */ }
    set({ ...snapshot(), hydrated: true });
  },
  connect: (response, login) => {
    const session = loginSession(response, login);
    vault.add(session); save(); set(snapshot()); return session.account.id;
  },
  activate: id => { vault.activate(id); save(); set(snapshot()); },
  invalidate: () => { vault.invalidate(); set(snapshot()); },
  remove: id => { vault.remove(id); save(); set(snapshot()); },
  expire: id => { vault.expire(id); save(); set(snapshot()); },
  update: (id, data) => {
    vault.update(id, data);
    const next = snapshot();
    if (JSON.stringify(next.accounts) !== JSON.stringify(get().accounts)) { save(); set(next); }
  },
}));
