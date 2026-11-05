import type { Order } from '../types/trading';
import type { ActivitySort, ActivityStatus } from './workspaceLayout';
const cancelled = (order: Order) => String(order.orderStatus ?? order.status).toUpperCase().includes('CANCEL');
export function activityRecords(orders: Order[], query: string, status: ActivityStatus, sort: ActivitySort, history: boolean): Order[] {
  const term=query.trim().toLowerCase();
  const rows=orders.filter(o => (!term || `${o.symbol} ${o.id} ${o.orderType}`.toLowerCase().includes(term)) && (!history || status==='all' || (status==='cancelled' ? cancelled(o) : !cancelled(o))));
  const at=(o:Order)=>Date.parse((history ? o.closedAt ?? o.updatedAt ?? o.createdAt : o.createdAt ?? o.updatedAt) ?? '') || 0;
  return rows.sort((a,b)=>sort==='symbol' ? a.symbol.localeCompare(b.symbol) || at(b)-at(a) : sort==='profit' ? (profit(b)-profit(a) || at(b)-at(a)) : sort==='oldest' ? at(a)-at(b) : at(b)-at(a));
}
function profit(o: Order) {const raw=o.pnl??o.profit;return raw!=null&&raw!==''&&Number.isFinite(Number(raw)) ? Number(raw) : -Infinity;}
export function activitySummary(orders: Order[]) {
  const executed=orders.filter(o=>!cancelled(o));
  const volume=executed.reduce((n,o)=>{
    const raw=o.lotSize??o.volume;
    const lots=raw==null || raw==='' ? NaN : Number(raw);
    return n+(Number.isFinite(lots)&&lots>=0 ? lots : NaN);
  },0);
  return {records:orders.length,volume,cancelled:orders.length-executed.length};
}
