'use client';
import {useSyncExternalStore} from 'react';
import {useWorkspaceStore} from '@/store/useWorkspaceStore';
import {COMPACT_WORKSPACE_QUERY, ticketVisible} from '@/lib/workspaceLayout';

function subscribe(notify: () => void) {
  const query = window.matchMedia(COMPACT_WORKSPACE_QUERY);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}
const compactSnapshot = () => window.matchMedia(COMPACT_WORKSPACE_QUERY).matches;
export function useTicketVisibility() {
  const compact = useSyncExternalStore(subscribe, compactSnapshot, () => true);
  const open = useWorkspaceStore(s => s.ticketOpen);
  const dismissed = useWorkspaceStore(s => s.ticketDismissed);
  return {visible: ticketVisible(open, dismissed, compact), compact};
}
