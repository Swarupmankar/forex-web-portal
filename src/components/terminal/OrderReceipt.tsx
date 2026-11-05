"use client";
import { useEffect, useRef } from 'react';
import { useOrderFlow } from '@/store/useOrderFlow';
import { useGetOpenOrdersQuery } from '@/store/api/tradingApi';
import { useTradingAccountId } from '@/hooks/useTradingAccountId';
import { confirmReceipt, expireReceipt } from '@/lib/orderReceipt';
import { receiptNotification } from '@/lib/tradeNotifications';
import { receiptSound } from '@/lib/executionSounds';
import { playTradeSoundOnce } from '@/lib/tradeSound';
import { ownOrders } from '@/lib/positionPnl';
import { usePracticeStore } from '@/store/usePracticeStore';
import { useUIStore } from '@/store/useUIStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

// Track fills and notifications without adding a banner above the trading workspace.
export function OrderReceiptTracker() {
  const receipt = useOrderFlow(s => s.receipt);
  const selectedReceipt=useRef('');
  useEffect(()=>{
    if(!receipt)return;
    const notice=receiptNotification(receipt);
    if(notice)useWorkspaceStore.getState().notify(notice.text,notice.kind,notice.options);
    const cue=receiptSound(receipt);
    if(cue&&useWorkspaceStore.getState().tradeSounds)void playTradeSoundOnce(cue.key,cue.kind);
  },[receipt]);
  useEffect(()=>{
    if(!receipt?.id||!['open','pending'].includes(receipt.status))return;
    const key=`${receipt.key}:${receipt.status}`;
    if(selectedReceipt.current===key)return;
    selectedReceipt.current=key;
    if(useUIStore.getState().activeSymbol===receipt.request.symbol)useWorkspaceStore.getState().selectTrade(receipt.id);
  },[receipt]);
  const accountId = useTradingAccountId();
  const practiceOrders = usePracticeStore(s => s.account.orders);
  const { currentData } = useGetOpenOrdersQuery(undefined, {skip:!receipt || receipt.practice});
  useEffect(() => {
    if (!receipt || (!receipt.practice && !currentData)) return;
    const rows = receipt.practice ? practiceOrders : ownOrders([...(currentData?.openOrders ?? []), ...(currentData?.pendingOrders ?? [])],accountId);
    const next = confirmReceipt(receipt, rows);
    if(next !== receipt && useOrderFlow.getState().receipt?.key === receipt.key) useOrderFlow.getState().set({receipt:next});
  }, [receipt,currentData,accountId,practiceOrders]);
  useEffect(() => {
    if (!receipt || receipt.status !== 'submitted') return;
    const timer = setTimeout(() => {
      const current = useOrderFlow.getState().receipt;
      if (current?.key === receipt.key) useOrderFlow.getState().set({receipt:expireReceipt(current,Date.now())});
    }, Math.max(0,receipt.startedAt + 30000 - Date.now()));
    return () => clearTimeout(timer);
  }, [receipt]);
  return null;
}
