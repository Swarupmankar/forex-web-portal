'use client';
import type { Order } from '@/types/trading';
import { useManagementSubmit } from './useTradeManagement';
import { usePracticeStore } from '@/store/usePracticeStore';
import { useUIStore } from '@/store/useUIStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useAccountStore } from '@/store/useAccountStore';
import { openTradeManagement } from '@/lib/openTradeManagement';
import { openLots } from '@/lib/tradeManagement';

/** The same validation, idempotency and reconciliation as the management ticket. */
export function useQuickTradeActions() {
  const submit = useManagementSubmit();
  const practice = usePracticeStore(s => s.mode === 'practice');
  const practiceOn = useWorkspaceStore(s => s.oneClickClosePractice);
  const connectedOn = useUIStore(s => s.oneClickClose);
  const enabled = practice ? practiceOn : connectedOn;
  async function exit(order: Order, action: 'close' | 'cancel') {
    const activePractice = usePracticeStore.getState().mode === 'practice';
    const armed = activePractice ? useWorkspaceStore.getState().oneClickClosePractice : useUIStore.getState().oneClickClose;
    if (!armed) { openTradeManagement(order, action, activePractice); return; }
    const selection = { key: crypto.randomUUID(), generation: useAccountStore.getState().generation, order, action, practice: activePractice };
    const error = await submit(selection, { lots: String(openLots(order)), sl: '', tp: '', entry: '' });
    if (error) useWorkspaceStore.getState().notify(error, 'error');
  }
  return { enabled, exit };
}
