'use client';
import { useCallback, useMemo } from 'react';
import { tradingApi } from '@/store/api/tradingApi';
import { usePracticeStore } from '@/store/usePracticeStore';
import { usePriceStore } from '@/store/usePriceStore';
import { instrument as fallbackInstrument } from '@/lib/market';
import { priceDigits } from '@/lib/pricePrecision';

// Read the existing query cache: display components never start extra requests.
// Precision updates only when metadata or the feed's decimal count changes.
export function useMarketDisplay() {
  const practice = usePracticeStore(s => s.mode === 'practice');
  const observed = usePriceStore(s => s.digits);
  const { data: stocks } = tradingApi.endpoints.getAllStocks.useQueryState(undefined);
  const { data: watchlist } = tradingApi.endpoints.getWatchlist.useQueryState(undefined);
  const metadata = useMemo(() => new Map([...(watchlist ?? []), ...(stocks ?? [])].map(item => [item.symbol.toUpperCase(), item])), [stocks, watchlist]);
  const instrument = useCallback((symbol: string) => {
    const fallback = fallbackInstrument(symbol);
    const broker = practice ? undefined : metadata.get(symbol.toUpperCase());
    return { ...fallback, ...broker, digits: priceDigits(symbol, broker ?? fallback, practice ? 0 : observed[symbol.toUpperCase()]) };
  }, [metadata, observed, practice]);
  const formatPrice = useCallback((value: number | undefined, symbol: string) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    const digits = instrument(symbol).digits;
    return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }, [instrument]);
  return { instrument, formatPrice };
}
