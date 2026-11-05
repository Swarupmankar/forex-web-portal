'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLazyGetHistoricalChartQuery } from '@/store/api/tradingApi';
import { useAccountStore } from '@/store/useAccountStore';
import { MAX_BARS, normalizeCandles, type Candle } from '@/lib/chart';
import { FEED_TIMEFRAMES } from '@/lib/chartTime';
import { onFeedConnected } from '@/services/candleFeed';
const EMPTY: Candle[] = [];

export function useChartHistory(symbol: string, timeframe: string, enabled: boolean) {
  const generation = useAccountStore(s => s.generation);
  const identity = `${generation}:${symbol}:${timeframe}:${enabled}`;
  const [request] = useLazyGetHistoricalChartQuery();
  const scope = useRef({ identity: '', rows: EMPTY, busy: false, more: true, retryAt: 0, recoveredAt: 0 });
  const [view, setView] = useState({ identity: '', rows: EMPTY, loading: false, error: '', more: true });
  const abort = useRef<(() => void) | undefined>(undefined);
  const fetchPage = useCallback(async (kind: 'initial' | 'older' | 'tail') => {
    const current = scope.current;
    if (!enabled || current.identity !== identity || current.busy || (kind === 'older' && (!current.more || Date.now() < current.retryAt))) return;
    current.busy = true;
    setView(v => ({ ...v, loading: true }));
    const oldest = current.rows[0]?.time;
    const pending = request({ symbol, tf: FEED_TIMEFRAMES[timeframe], limit: kind === 'tail' ? 100 : 500, ...(kind === 'older' && oldest && { to: oldest * 1000 }) });
    abort.current = pending.abort;
    try {
      const response = await pending.unwrap();
      if (scope.current !== current) return;
      const page = normalizeCandles(response);
      const map = new Map(current.rows.map(c => [c.time, c]));
      for (const candle of page) map.set(candle.time, candle);
      current.rows = [...map.values()].sort((a, b) => a.time - b.time).slice(-MAX_BARS);
      if ((kind === 'older' && !page.some(c => c.time < (oldest ?? Infinity))) || current.rows.length >= MAX_BARS) current.more = false;
      setView({ identity, rows: current.rows, loading: false, error: '', more: current.more });
    } catch {
      if (scope.current !== current) return;
      current.retryAt = Date.now() + 15000;
      setView(v => ({ ...v, loading: false, error: kind === 'older' ? 'Older history could not be loaded. Try again.' : 'Price history is temporarily unavailable.' }));
    } finally { current.busy = false; }
  }, [identity, enabled, request, symbol, timeframe]);
  useEffect(() => {
    scope.current = { identity, rows: EMPTY, busy: false, more: true, retryAt: 0, recoveredAt: 0 };
    setView({ identity, rows: EMPTY, loading: enabled, error: '', more: true });
    // Strict Mode mounts/cleans up once before the actual mount. Start after that
    // cycle so its aborted query cannot be reused by the live subscription.
    const timer = window.setTimeout(() => { void fetchPage('initial'); }, 0);
    return () => { window.clearTimeout(timer); abort.current?.(); scope.current = { ...scope.current, identity: '' }; };
  }, [identity, enabled, fetchPage]);
  useEffect(() => {
    if (!enabled) return;
    const recover = () => {
      const current = scope.current;
      if (!document.hidden && !current.busy && Date.now() - current.recoveredAt > 5000) {
        current.recoveredAt = Date.now(); void fetchPage(current.rows.length ? 'tail' : 'initial');
      }
    };
    const off = onFeedConnected(recover);
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', recover);
    return () => { off(); window.removeEventListener('focus', recover); document.removeEventListener('visibilitychange', recover); };
  }, [enabled, fetchPage]);
  return {
    candles: view.identity === identity ? view.rows : EMPTY,
    loading: enabled && (view.identity !== identity || view.loading),
    error: view.identity === identity ? view.error : '', more: view.more,
    older: useCallback(() => { void fetchPage('older'); }, [fetchPage]),
    refresh: () => { void fetchPage(scope.current.rows.length ? 'tail' : 'initial'); },
  };
}
