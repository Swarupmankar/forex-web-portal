export const ACTIVITY_MIN = 180;
export const ACTIVITY_MAX = 520;
export const ACTIVITY_DEFAULT = 220;
// Includes the divider. Chart + activity fit a laptop viewport without a 520px chart floor.
export const CHART_RESERVED_SPACE = 300;
export const COMPACT_WORKSPACE_QUERY = '(max-width: 1179px)';
export function ticketVisible(open: boolean, dismissed: boolean, compact: boolean) {
  return open || (!compact && !dismissed);
}
export function activityHeight(value: number, available?: number, reserved = CHART_RESERVED_SPACE) {
  const max = available ? Math.min(ACTIVITY_MAX, Math.max(ACTIVITY_MIN, Math.min(available - reserved, available * .4))) : ACTIVITY_MAX;
  return Math.round(Math.min(max, Math.max(ACTIVITY_MIN, Number.isFinite(value) ? value : ACTIVITY_DEFAULT)));
}
export type ActivitySort = 'newest' | 'oldest' | 'profit' | 'symbol';
export type ActivityStatus = 'all' | 'closed' | 'cancelled';
