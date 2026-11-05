"use client";
import { useEffect } from 'react';
import { useGetOrderHistoryQuery } from '@/store/api/tradingApi';
import { useAccountStore } from '@/store/useAccountStore';
import { followHistory, orderListSignature } from '@/lib/historyRefresh';
import type { OrderlistResponseDTO } from '@/types/trading';

export function useTradeHistory(enabled: boolean, orders?: OrderlistResponseDTO) {
  const generation = useAccountStore(s => s.generation);
  const history = useGetOrderHistoryQuery(undefined, { skip: !enabled,
    refetchOnMountOrArgChange: true, refetchOnFocus: true, refetchOnReconnect: true });
  const signature = orderListSignature(orders);
  const { refetch } = history;
  useEffect(() => {
    if (!enabled) return;
    // Bounded retries catch delayed exit records. Account changes and leaving History cancel them.
    return followHistory(() => { if (generation === useAccountStore.getState().generation) void refetch(); });
  }, [enabled, generation, signature, refetch]);
  return history;
}
