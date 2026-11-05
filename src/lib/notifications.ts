export type ToastKind = 'success' | 'error' | 'info' | 'warning';
export type ToastOptions = { sticky?: boolean; key?: string; title?: string; phase?: 'progress' | 'settled' };
export type Toast = ToastOptions & { id: string; text: string; kind: ToastKind; count: number; at: number; sticky: boolean; active: boolean };
export const NOTIFICATION_LIMIT = 50;
export const TOAST_LIFETIME = 5000;

/** One record per operation. A late acknowledgement cannot replace its execution result. */
export function queueNotification(current: Toast[], text: string, kind: ToastKind, options: ToastOptions, id: string, at: number): Toast[] {
  if (!text.trim()) return current;
  const existing = options.key
    ? current.find(t => t.key === options.key)
    : current.find(t => t.active && !t.key && t.text === text && t.kind === kind);
  if (existing?.phase === 'settled' && options.phase === 'progress') return current;
  if (existing && options.key && existing.text === text && existing.kind === kind && existing.title === options.title && existing.phase === options.phase) return current;
  const toast: Toast = { ...options, id: existing?.id ?? id, text, kind, count: existing && !options.key ? existing.count + 1 : 1, at, sticky: options.sticky ?? kind === 'error', active: true };
  return [...current.filter(t => t.id !== toast.id), toast].slice(-NOTIFICATION_LIMIT);
}

/** One current message, plus an unresolved error if it would otherwise be hidden. */
export function visibleNotifications(toasts: Toast[]): Toast[] {
  const active = toasts.filter(t => t.active), latest = active.at(-1);
  if (!latest) return [];
  const critical = active.findLast(t => t.sticky && (t.kind === 'error' || t.kind === 'warning') && t.id !== latest.id);
  return critical ? [latest, critical] : [latest];
}
