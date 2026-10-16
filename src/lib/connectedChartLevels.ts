import type { Order } from '@/types/trading';
export function connectedChartLevels(open: Order[], pending: Order[], symbol: string) {
  return [...open.map(order => ({ order, pending: false })), ...pending.map(order => ({ order, pending: true }))]
    .filter(({ order }) => order.symbol === symbol)
    .flatMap(({ order, pending }) => {
      const entry = Number(order.orderDetails?.entryPrice ?? (pending ? order.targetPrice : undefined) ?? order.openPrice);
      const side = String(order.orderType).toUpperCase().includes('SELL') ? 'Sell' : 'Buy';
      const title = `${pending ? 'Pending ' : ''}${side} ${order.lotSize ?? order.volume ?? ''} · #${order.id}`;
      return [
        { id: `broker:${order.id}:entry`, price: entry, title, color: pending ? '#b08b38' : '#5685aa' },
        { id: `broker:${order.id}:sl`, price: Number(order.sl ?? order.stopLoss), title: `SL · #${order.id}`, color: '#d95765' },
        { id: `broker:${order.id}:tp`, price: Number(order.tp ?? order.takeProfit), title: `TP · #${order.id}`, color: '#219778' },
      ].filter(level => Number.isFinite(level.price) && level.price > 0);
    });
}
