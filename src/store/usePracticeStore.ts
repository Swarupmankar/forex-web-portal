import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { newPracticeAccount, trimHistory, type PracticeOrder, placePractice, managePractice, settlePractice, movePracticeLevel, closePracticeVolume, closePracticeMany, type BulkClose, type PracticeLevel, type PracticeAccount, type Quotes } from '@/lib/practice';
import { useWorkspaceStore } from './useWorkspaceStore';
import { playTradeSound } from '@/lib/tradeSound';
import { readPracticeAccount } from '@/lib/practicePersistence';
import { SAMPLE_QUOTES } from '@/lib/market';
import type { TradeRequest } from '@/lib/contracts';
function savedAccount(fallback: PracticeAccount) {
    if (typeof window === 'undefined')
        return fallback;
    try {
        return readPracticeAccount(localStorage.getItem('mm-terminal-practice-v1'), fallback);
    }
    catch {
        return fallback;
    }
}
type PracticeState = {
    syncAccount: () => void;
    mode: 'practice' | 'connected';
    account: PracticeAccount;
    quotes: Quotes;
    setMode: (mode: 'practice' | 'connected') => void;
    // `settle` is true only in the leader tab, which alone fills pending orders and triggers stops.
    tick: (settle?: boolean) => void;
    place: (r: TradeRequest) => void;
    manage: (id: string, action: 'close' | 'cancel' | 'edit', levels?: {
        sl?: number;
        tp?: number;
    }) => void;
    moveLevel: (id: string, level: PracticeLevel, price: number | undefined) => void;
    closeVolume: (id: string, lots: number) => void;
    closeMany: (which: BulkClose, symbol?: string) => { done: number; skipped: number };
    reset: () => void;
};
const money = (n: number) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`;
// Reports every order the engine changed in one tick; a stop-out that closes several positions is one grouped message.
function announce(before: PracticeOrder[], after: PracticeOrder[]) {
    const was = new Map(before.map(o => [o.id, o.status]));
    const changed = after.filter(o => was.has(o.id) && was.get(o.id) !== o.status);
    if (!changed.length)
        return;
    const w = useWorkspaceStore.getState();
    const stopped = changed.filter(o => o.reason === 'Practice margin stop-out');
    if (stopped.length)
        w.notify(`Stop-out: ${stopped.length} position${stopped.length === 1 ? '' : 's'} closed · ${money(stopped.reduce((n, o) => n + o.pnl, 0))}`, 'warning', { sticky: true });
    for (const o of changed.filter(o => !stopped.includes(o))) {
        const side = `${o.orderType === 'BUY' ? 'Buy' : 'Sell'} ${o.lotSize} ${o.symbol}`;
        if (o.status === 'OPEN')
            w.notify(`${o.id} ${side} ${o.executionType.toLowerCase()} filled at ${o.openPrice}`, 'success');
        else if (o.status === 'REJECTED')
            w.notify(`${o.id} ${side} rejected: ${o.reason ?? 'not filled'}`, 'error');
        else if (o.status === 'CLOSED')
            w.notify(`${o.id} ${side} · ${o.reason ?? 'closed'} ${money(o.pnl)}`, o.reason === 'Stop loss' ? 'warning' : 'success');
    }
    if (w.tradeSounds)
        playTradeSound(changed.some(o => o.status === 'OPEN') ? 'filled' : 'closed');
}
// Writes the account to localStorage only when it changed; quotes update every second but aren't persisted.
let lastWritten = '';
const practiceStorage = createJSONStorage(() => ({
    getItem: (name: string) => localStorage.getItem(name),
    setItem: (name: string, value: string) => { if (value !== lastWritten) { lastWritten = value; localStorage.setItem(name, value); } },
    removeItem: (name: string) => localStorage.removeItem(name),
}));
export const usePracticeStore = create<PracticeState>()(persist((set, get) => ({
    mode: 'practice', account: newPracticeAccount(), quotes: {},
    setMode: mode => set({ mode, account: savedAccount(get().account) }),
    syncAccount: () => { const a = savedAccount(get().account); if (JSON.stringify(a) !== JSON.stringify(get().account))
        set({ account: a }); },
    tick: (settle = true) => {
        const now = Date.now();
        const previous = get().quotes;
        const quotes = Object.fromEntries(Object.entries(SAMPLE_QUOTES).map(([symbol, base], i) => {
            const wave = Math.sin(now / 23000 + i) * 0.00015 + Math.sin(now / 7100 + i * 2) * 0.00006;
            const bid = base.bid * (1 + wave), ask = bid + base.ask - base.bid;
            return [symbol, { ...base, bid, ask, change24h: undefined, timestamp: now, direction: bid > (previous[symbol]?.bid ?? bid) ? 'up' : bid < (previous[symbol]?.bid ?? bid) ? 'down' : 'same' }];
        })) as Quotes;
        if (!settle) {
            set({ quotes });
            return;
        }
        // The in-memory account is kept current by storage events from other tabs (PracticeSession).
        const before = get().account;
        const settled = settlePractice(before, quotes, now);
        const next = settled === before ? before : trimHistory(settled);
        set(next === before ? { quotes } : { quotes, account: next });
        if (next !== before)
            announce(before.orders, next.orders);
    },
    place: r => { if (get().mode !== 'practice')
        throw new Error('Switch to practice mode first.'); set(s => ({ account: placePractice(savedAccount(s.account), r, s.quotes) })); const w = useWorkspaceStore.getState(); w.selectTrade(get().account.orders[0].id); w.setActivityExpanded(true); if (w.tradeSounds)
        playTradeSound(r.executionType === 'MARKET' ? 'filled' : 'pending'); },
    manage: (id, action, levels) => { if (get().mode !== 'practice')
        throw new Error('Switch to practice mode first.'); set(s => ({ account: managePractice(savedAccount(s.account), id, action, s.quotes, levels) })); if (useWorkspaceStore.getState().tradeSounds)
        playTradeSound(action === 'edit' ? 'updated' : 'closed'); },
    moveLevel: (id, level, price) => { if (get().mode !== 'practice')
        throw new Error('Switch to practice mode first.'); set(s => ({ account: movePracticeLevel(savedAccount(s.account), id, level, price, s.quotes) })); if (useWorkspaceStore.getState().tradeSounds)
        playTradeSound('updated'); },
    closeVolume: (id, lots) => { if (get().mode !== 'practice')
        throw new Error('Switch to practice mode first.'); set(s => ({ account: closePracticeVolume(savedAccount(s.account), id, lots, s.quotes) })); if (useWorkspaceStore.getState().tradeSounds)
        playTradeSound('closed'); },
    closeMany: (which, symbol) => { if (get().mode !== 'practice')
        throw new Error('Switch to practice mode first.'); const r = closePracticeMany(savedAccount(get().account), which, get().quotes, symbol); set({ account: r.account }); if (r.done && useWorkspaceStore.getState().tradeSounds)
        playTradeSound('closed'); return { done: r.done, skipped: r.skipped }; },
    reset: () => set({ account: newPracticeAccount() }),
}), { name: 'mm-terminal-practice-v1', version: 1, storage: practiceStorage, partialize: s => ({ account: s.account }), merge: (persisted, current) => {
        // Only account data can hydrate; modes, quotes and actions never come from storage.
        return { ...current, account: readPracticeAccount(JSON.stringify({ state: persisted }), current.account) };
    } }));
