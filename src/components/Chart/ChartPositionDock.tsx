'use client';

import { useState } from 'react';
import { ScanLine, X } from 'lucide-react';
import { practicePnl, type PracticeOrder, type PracticeLevel } from '@/lib/practice';
import { formatPrice, errorMessage } from '@/lib/market';
import { usePracticeStore } from '@/store/usePracticeStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { Dialog } from '@/components/terminal/Dialog';
import { useOneClick } from '@/components/OrderEntry/useOneClick';

export function ChartPositionDock({ order, orders, onSelect, onEdit, onFit }: {
    order: PracticeOrder;
    orders: PracticeOrder[];
    onSelect: (id: string) => void;
    onEdit: (level?: PracticeLevel) => void;
    onFit: () => void;
}) {
    const quote = usePracticeStore(s => s.quotes[order.symbol]);
    const notify = useWorkspaceStore(s => s.notify);
    const [closing, setClosing] = useState<PracticeOrder | null>(null);
    const [error, setError] = useState('');
    const pnl = practicePnl(order, quote);
    const oneClick = useOneClick();
    function close(target: PracticeOrder) {
        try {
            usePracticeStore.getState().manage(target.id, target.status === 'PENDING' ? 'cancel' : 'close');
            setClosing(null);
            notify(target.status === 'PENDING' ? `Order ${target.id} cancelled.` : `Position ${target.id} closed.`);
        } catch (e) {
            if (closing) setError(errorMessage(e, 'Could not update position.'));
            else notify(errorMessage(e, 'Could not update position.'), 'error');
        }
    }
    return <>
        <div className="position-dock" aria-label="Selected trade management">
            <div className="position-dock-summary">
                <span className={`position-direction ${order.orderType.toLowerCase()}`}>{order.orderType === 'BUY' ? 'Buy' : 'Sell'}</span>
                <select aria-label="Selected chart position" value={order.id} onChange={e => onSelect(e.target.value)}>{orders.map(o => <option value={o.id} key={o.id}>{o.id} · {o.orderType} {o.lotSize} lots{orders.length > 1 ? ` (${orders.indexOf(o) + 1}/${orders.length})` : ''}{ o.status === 'PENDING' ? ` · ${o.executionType}` : ''}</option>)}</select>
                <span className="position-entry-price">Entry <b>{formatPrice(order.openPrice, order.symbol)}</b></span>
                <strong className={`position-live-pnl ${pnl >= 0 ? 'positive' : 'negative'}`}>{order.status === 'PENDING' ? 'Pending' : `${pnl >= 0 ? '+' : '−'}$${Math.abs(pnl).toFixed(2)}`}</strong>
                <button className="position-mobile-risk" onClick={() => onEdit()} aria-label={`Edit stop loss and take profit for ${order.id}`}>Edit SL/TP</button>
                <button className="position-mobile-fit" onClick={onFit} aria-label="Fit selected trade levels" title="Fit trade entry, stop loss and take profit"><ScanLine /><span>Fit trade</span></button>
                <button className="position-close" onClick={() => { setError(''); if (oneClick.on) close(order); else setClosing(order); }} aria-label={`${order.status === 'PENDING' ? 'Cancel order' : 'Close position'} ${order.id}`}><X /><span>{order.status === 'PENDING' ? 'Cancel' : 'Close'}</span></button>
            </div>

        </div>
        {closing && <Dialog title={closing.status === 'PENDING' ? 'Cancel practice order' : 'Close practice position'} onClose={() => setClosing(null)}><p className="muted">{closing.id} · {closing.orderType} {closing.lotSize} lots {closing.symbol}</p><p className="notice-note">This affects your browser-local practice account only.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-danger full-width" onClick={() => close(closing)}>Confirm {closing.status === 'PENDING' ? 'cancellation' : 'close'}</button></Dialog>}
    </>;
}
