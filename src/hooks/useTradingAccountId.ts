"use client";
import { tradingApi } from '@/store/api/tradingApi';
import { useAccountStore } from '@/store/useAccountStore';

// Engine account ID, distinct from the visible login and the session-vault key.
export function useTradingAccountId() {
  const saved = useAccountStore(s => s.accounts.find(a => a.id === s.activeId)?.tradingAccountId);
  const { currentData } = tradingApi.endpoints.getAccountDetails.useQueryState(undefined);
  const id = (currentData?.account ?? currentData)?.id ?? saved;
  return id != null && Number.isFinite(Number(id)) ? Number(id) : undefined;
}
