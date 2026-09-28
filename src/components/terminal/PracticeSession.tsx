'use client';
import { unlockTradeSound } from '@/lib/tradeSound';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useEffect, useRef } from 'react';
import { usePracticeStore } from '@/store/usePracticeStore';

// With several terminal tabs open, exactly one (the holder of a Web Lock) runs the practice
// engine; the others only animate prices and pick up account changes through storage events.
// If the leader tab closes, the lock passes to another tab automatically.
function usePracticeLeader(enabled: boolean) {
    const leader = useRef(false);
    useEffect(() => {
        if (!enabled)
            return;
        if (!('locks' in navigator)) {
            leader.current = true;
            return () => { leader.current = false; };
        }
        const abort = new AbortController();
        let release = () => { };
        navigator.locks.request('mm-practice-engine', { signal: abort.signal }, () => new Promise<void>(resolve => {
            leader.current = true;
            // Pick up anything another tab wrote while it was leader.
            usePracticeStore.getState().syncAccount();
            release = resolve;
        })).catch(() => { });
        return () => { leader.current = false; abort.abort(); release(); };
    }, [enabled]);
    return leader;
}

export function PracticeSession() {
    useEffect(() => {
        const unlock = () => { if (useWorkspaceStore.getState().tradeSounds) unlockTradeSound(); };
        document.addEventListener('pointerdown', unlock, { capture: true });
        document.addEventListener('keydown', unlock, { capture: true });
        return () => { document.removeEventListener('pointerdown', unlock, true); document.removeEventListener('keydown', unlock, true); };
    }, []);
    useEffect(() => {
        const sync = (e: StorageEvent) => { if (e.key === 'mm-terminal-practice-v1') usePracticeStore.getState().syncAccount(); };
        window.addEventListener('storage', sync);
        return () => window.removeEventListener('storage', sync);
    }, []);
    const practice = usePracticeStore(s => s.mode === 'practice');
    const tick = usePracticeStore(s => s.tick);
    const leader = usePracticeLeader(practice);
    useEffect(() => {
        if (!practice)
            return;
        tick(leader.current);
        const timer = setInterval(() => tick(leader.current), 1000);
        return () => clearInterval(timer);
    }, [practice, tick, leader]);
    return null;
}
