'use client';
import {useMarketDisplay} from '@/hooks/useMarketDisplay';
import {ScanLine,X,Plus,SlidersHorizontal,LoaderCircle,Clock3} from 'lucide-react';
import {practicePnl,type PracticeOrder,type PracticeLevel} from '@/lib/practice';
import {usePracticeStore} from '@/store/usePracticeStore';
import {ToolbarMenu} from '@/components/terminal/ToolbarMenu';

export function ChartPositionDock({order,orders,onSelect,onEdit,onFit,onClose,onReduce,connected,busy=false,quickClose=false,progress=''}:{
  order:PracticeOrder;orders:PracticeOrder[];onSelect:(id:string)=>void;onEdit:(level?:PracticeLevel)=>void;
  onFit:()=>void;onClose:()=>void;onReduce:()=>void;connected?:{pnl:number;canManage:boolean};busy?:boolean;quickClose?:boolean;progress?:string;
}) {
  const {formatPrice}=useMarketDisplay(),quote=usePracticeStore(s=>s.quotes[order.symbol]);
  const pnl=connected?connected.pnl:practicePnl(order,quote),disabled=busy||(connected&&!connected.canManage);
  return <div className="position-dock" aria-label="Selected trade management">
    <div className="position-dock-summary">
      <span className={`position-direction ${order.orderType.toLowerCase()}`}>{order.orderType==='BUY'?'Buy':'Sell'}</span>
      <select aria-label="Selected chart position" value={order.id} onChange={e=>onSelect(e.target.value)}>{orders.map(o=><option key={o.id} value={o.id}>{o.id} · {o.orderType} {o.lotSize} lots{o.status==='PENDING'?` · ${o.executionType}`:''}</option>)}</select>
      <span className="position-entry-price">Entry <b>{formatPrice(order.openPrice,order.symbol)}</b></span>
      <strong className={`position-live-pnl ${pnl>=0?'positive':'negative'}`}>{order.status==='PENDING'?'Pending':!Number.isFinite(pnl)?'—':`${pnl>=0?'+':'−'}$${Math.abs(pnl).toFixed(2)}`}</strong>
      <button className="position-close" disabled={disabled} onClick={onClose} title={quickClose?'Sends immediately':'Open management ticket'} aria-label={`${order.status==='PENDING'?'Cancel':'Close'} trade ${order.id}`}>{progress?(progress==='Status unconfirmed'?<Clock3/>:<LoaderCircle className="spin"/>):<X/>}{progress||(order.status==='PENDING'?'Cancel':'Close')}</button>
      <ToolbarMenu label="Manage" icon={<SlidersHorizontal />} className="position-manage-menu">
        <button disabled={disabled} onClick={()=>onEdit()}>{order.status==='PENDING'?'Modify order':'Edit SL/TP'}</button>
        {(['sl','tp'] as const).map(level=><button key={level} disabled={disabled} onClick={()=>onEdit(level)} aria-label={`${order[level]==null?'Add':'Edit'} ${level==='sl'?'stop loss':'take profit'} for ${order.id}`}>{order[level]==null&&<Plus/>}<span>{level==='sl'?'Stop loss':'Take profit'}</span><strong>{order[level]==null?'Add':formatPrice(order[level],order.symbol)}</strong></button>)}
        {order.status==='PENDING'&&<button disabled={disabled} onClick={()=>onEdit('entry')}>Edit entry</button>}
        <button onClick={onFit}><ScanLine/>Fit trade on chart</button>
        {order.status!=='PENDING'&&<button disabled={disabled} onClick={onReduce}>Partial close / reduce</button>}
      </ToolbarMenu>
    </div>
  </div>;
}
