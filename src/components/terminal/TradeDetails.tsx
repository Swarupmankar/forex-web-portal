"use client";
import type { Order } from '@/types/trading';
import { Dialog } from './Dialog';
import { InstrumentIcon } from './InstrumentIcon';
import { useMarketDisplay } from '@/hooks/useMarketDisplay';
import { orderEntry } from '@/lib/connectedOrders';
import {X,ChartCandlestick,SlidersHorizontal} from 'lucide-react';
import {useEffect,useRef} from 'react';

const amount = (value: unknown) => value == null || value === '' || !Number.isFinite(Number(value)) ? '—'
  : Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const time = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : '—';
export function TradeDetails({order:o,onClose,embedded=false,onChart,onEdit,onExit,onTrade}: {order:Order;onClose:()=>void;embedded?:boolean;onChart?:()=>void;onEdit?:()=>void;onExit?:()=>void;onTrade?:()=>void}) {
  const { formatPrice } = useMarketDisplay();
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    if(!embedded)return;
    const before=document.activeElement as HTMLElement|null;
    heading.current?.focus();
    return ()=>{requestAnimationFrame(()=>{if(before?.isConnected && before.getClientRects().length)before.focus();});};
  },[embedded,o.id]);
  const price = (value: unknown) => formatPrice(value == null || value === '' ? undefined : Number(value), o.symbol);
  const exited = !!o.exitRowId || !!o.closedAt;
  const cancelled = String(o.orderStatus ?? o.status).toUpperCase() === 'CANCELLED';
  const fields = [
    ['Status', o.closeReason ?? (exited && ['OPEN', 'PARTIALLY_COMPLETED'].includes(o.orderStatus ?? '') ? 'Partial close' : o.orderStatus ?? o.status ?? '—')],
    ['Side', String(o.orderType).replaceAll('_', ' ')],
    [cancelled ? 'Cancelled volume' : exited ? 'Closed volume' : 'Volume', `${o.lotSize ?? o.volume ?? '—'} lots`],
    ['Entry', formatPrice(orderEntry(o), o.symbol)],
    ...(exited ? [['Exit', price(o.orderDetails?.exitPrice ?? (o as Order & {exitPrice?:number}).exitPrice)]] : [['Used margin · USD', amount(o.marginInUse)]]),
    ['Stop loss', price(o.sl ?? o.stopLoss)], ['Take profit', price(o.tp ?? o.takeProfit)],
    ['Gross P&L · USD', amount(o.pnl ?? o.profit)],
    ['Swap · USD', amount(o.swap)], ['Entry commission · USD', amount(o.commission)],
    ['Opened', time(o.createdAt)], ...(exited ? [['Closed', time(o.closedAt ?? o.updatedAt)]] : []),
  ];
  const content=<>
    <div className="trade-detail-heading"><InstrumentIcon symbol={o.symbol} /><strong>{o.symbol}</strong></div>
    <dl className="trade-detail-grid">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="muted trade-detail-note">Times are shown in your local timezone. Charges appear when supplied by the server; entry commission belongs to the whole order.</p>
    <div className="trade-inspector-actions">
      {onChart&&<button className="button button-outline" onClick={onChart}><ChartCandlestick/>View chart</button>}
      {onTrade&&<button className="button button-primary" onClick={onTrade}>Trade again</button>}
      {onEdit&&<button className="button button-outline" onClick={onEdit}><SlidersHorizontal/>Edit SL / TP</button>}
      {onExit&&<button className="button button-outline" onClick={onExit}>{String(o.orderStatus??o.status)==='PENDING'?'Cancel order':'Close position'}</button>}
    </div>
  </>;
  return embedded?<aside className="trade-inspector" aria-label={`Details for order ${o.id}`}><header><h3 ref={heading} tabIndex={-1}>Order #{o.id}</h3><button className="icon-button" onClick={onClose} aria-label="Close trade details"><X/></button></header>{content}</aside>:<Dialog title={`Order #${o.id}`} className="trade-details-dialog" onClose={onClose}>{content}</Dialog>;
}
