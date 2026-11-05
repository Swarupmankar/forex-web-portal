import { create } from 'zustand';
import { nextSettlement, type Settlement } from '@/lib/accountSettlement';
import type { OrderlistResponseDTO } from '@/types/trading';

// Observe fulfilled snapshots once, outside components; both header and footer
// read the same settlement sequence. Never persisted across sessions/accounts.
export const useAccountValuation = create<{
  generation: number;
  settlement?: Settlement;
  observe: (list: OrderlistResponseDTO, generation: number, accountId?: number) => void;
  reset: () => void;
}>((set) => ({
  generation: -1,
  observe: (list, generation, accountId) => set(state => ({ generation,
    settlement: nextSettlement(state.generation === generation ? state.settlement : undefined, list, accountId, Date.now()),
  })),
  reset: () => set({ generation: -1, settlement: undefined }),
}));
