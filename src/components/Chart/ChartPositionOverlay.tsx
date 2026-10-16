'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import type { ChartEngine, ChartLevel } from './useChartEngine';
import { usePracticeStore } from '@/store/usePracticeStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { projectedPracticePnl, practicePnl, movePracticeLevel, type PracticeOrder, type PracticeLevel } from '@/lib/practice';
import { chartDragCoordinate } from '@/lib/chartInteraction';
import { layoutChartOverlays } from '@/lib/chartOverlayLayout';
import { formatPrice, instrument, errorMessage } from '@/lib/market';
import { Dialog } from '@/components/terminal/Dialog';

const names: Record<PracticeLevel, string> = { sl: 'Stop loss', tp: 'Take profit', entry: 'Pending entry' };
const colors = { entry: '#5685aa', sl: '#d95765', tp: '#219778' };
const money = (value: number) => `${value >= 0 ? '+' : '−'}$${Math.abs(value).toFixed(2)}`;

type Draft = { level: PracticeLevel; price: number; error: string };
export function ChartPositionOverlay({ engine, order, orders, onSelect, onEdit, visible, extraLines = [] }: {
    engine: ChartEngine | null;
    order?: PracticeOrder;
    orders: PracticeOrder[];
    onSelect: (id: string) => void;
    onEdit: (level?: PracticeLevel) => void;
    visible: boolean;
    extraLines?: ChartLevel[];
}) {
    const [geometry, setGeometry] = useState({ coordinates: {} as Record<string, number>, width: 0, height: 0 });
    const [draft, setDraft] = useState<Draft | null>(null);
    const [groupOpen, setGroupOpen] = useState<PracticeOrder[] | null>(null);
    const drag = useRef<{ level: PracticeLevel; start: number; anchor: number; price: number; moved: boolean; renderedHeight: number } | null>(null);
    const suppressClick = useRef(false);
    const quotes = usePracticeStore(s => s.quotes);
    const latest = useRef({ order, orders, draft, visible });
    latest.current = { order, orders, draft, visible };
    const notify = useWorkspaceStore(s => s.notify);
    const price = (level: PracticeLevel) => draft?.level === level ? draft.price : level === 'entry' ? order?.openPrice : order?.[level];
    const levelsKey = orders.map(o => `${o.id}:${o.status}:${o.openPrice}:${o.sl}:${o.tp}`).join('|');

    function cancel() { drag.current = null; setDraft(null); engine?.freeze(false); }
    useEffect(() => { cancel(); setGroupOpen(null); }, [order?.id, visible, engine]);
    useEffect(() => {
        if (!engine?.alive()) return;
        const update = () => {
            const { order, orders, draft } = latest.current;
            const coordinates: Record<string, number> = {};
            orders.forEach(o => {
                const y = engine.series.priceToCoordinate(draft?.level === 'entry' && order?.id === o.id ? draft.price : o.openPrice);
                if (y !== null) coordinates[o.id] = Number(y);
            });
            for (const level of ['sl', 'tp'] as const) {
                const p = draft?.level === level ? draft.price : order?.[level];
                if (p !== undefined) {
                    const y = engine.series.priceToCoordinate(p);
                    if (y !== null) coordinates[level] = Number(y);
                }
            }
            const next = { coordinates, width: engine.chart.timeScale().width(), height: engine.chart.paneSize().height };
            setGeometry(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
        };
        const off = engine.subscribe(update);
        update();
        return () => { off(); engine.freeze(false); };
    }, [engine]);
    useEffect(() => {
        if (!engine?.alive()) return;
        const levels: ChartLevel[] = [...extraLines, ...(visible ? orders.map(o => ({
            id: o.id, price: o.id === order?.id ? price('entry')! : o.openPrice,
            title: '', color: o.id === order?.id ? colors.entry : '#87939f77', selected: o.id === order?.id, kind: 'entry' as const
        })) : [])];
        if (order && visible) {
            for (const level of ['sl', 'tp'] as const) {
                const p = price(level);
                if (p !== undefined) levels.push({ id: level, price: p, title: '', color: colors[level], kind: level, selected: true });
            }
            if (draft) {
                const original = draft.level === 'entry' ? order.openPrice : order[draft.level];
                if (original !== undefined) levels.push({ id: 'original-level', price: original, title: '', color: '#87939f66' });
            }
        }
        engine.setLevels(levels);
    }, [engine, levelsKey, order?.id, draft, visible, extraLines]);
    useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
        const blur = () => cancel();
        document.addEventListener('keydown', esc);
        window.addEventListener('blur', blur);
        return () => { document.removeEventListener('keydown', esc); window.removeEventListener('blur', blur); };
    }, [engine]);

    function preview(level: PracticeLevel, p: number) {
        if (!order) return;
        let error = '';
        try {
            const state = usePracticeStore.getState();
            movePracticeLevel(state.account, order.id, level, p, state.quotes);
        } catch (e) { error = errorMessage(e, 'Invalid price'); }
        setDraft({ level, price: p, error });
    }
    function commit(level: PracticeLevel, p: number) {
        if (!order) return;
        try {
            usePracticeStore.getState().moveLevel(order.id, level, p);
            notify(`${names[level]} updated to ${formatPrice(p, order.symbol)}.`);
        } catch (e) { notify(errorMessage(e, 'This price could not be saved.'), 'error'); }
        finally { cancel(); }
    }
    if (!order || !visible) return null;
    const rows = [
        ...orders.map(o => ({ id: o.id, kind: 'entry' as PracticeLevel, order: o, selected: o.id === order.id, y: geometry.coordinates[o.id], price: o.id === order.id ? price('entry')! : o.openPrice })),
        ...(['sl', 'tp'] as const).flatMap(level => price(level) === undefined ? [] : [{ id: level, kind: level, order, selected: true, y: geometry.coordinates[level], price: price(level)! }])
    ];
    const layout = layoutChartOverlays(rows, geometry.height, { top: 50, bottom: 22, gap: 36 });
    const labels = layout.labels;
    const labelRight = Math.max(0, Math.round(geometry.width - 12));
    const currentOrders = (list: PracticeOrder[]) => list.filter(o => orders.some(active => active.id === o.id));
    return <div className="chart-position-overlay">
        <svg className="trade-label-leaders" width="100%" height="100%" aria-hidden="true">
            {labels.filter(l => l.anchorY >= 0 && l.anchorY <= geometry.height).map(l => <path key={l.id} d={`M ${labelRight} ${Math.round(l.labelY)} L ${Math.round(geometry.width - 3)} ${Math.round(l.anchorY)} L ${Math.round(geometry.width)} ${Math.round(l.anchorY)}`} fill="none" stroke={l.selected ? colors[l.kind] : '#87939f88'} strokeWidth="1"/>)}
        </svg>
        {labels.map(label => {
            const row = label.members[0], level = row.kind, active = label.selected, grouped = label.members.length > 1;
            const offscreen = label.anchorY < 0 ? 'above' : label.anchorY > geometry.height ? 'below' : null;
            const movable = active && (level !== 'entry' || row.order.status === 'PENDING');
            const dragging = draft?.level === level && active;
            const pnl = level === 'entry' ? practicePnl(row.order, quotes[row.order.symbol]) : projectedPracticePnl(row.order, row.price);
            const description = `${level === 'entry' ? `${row.order.orderType} ${row.order.lotSize} lots` : names[level]} at ${formatPrice(row.price, row.order.symbol)}, ${money(pnl)}`;
            return <button key={label.id} data-price-coordinate={row.y} className={`trade-marker ${level} ${active ? 'is-selected' : 'is-secondary'} ${dragging ? 'is-dragging' : ''} ${dragging && draft.error ? 'is-invalid' : ''} ${offscreen ? 'is-offscreen' : ''}`} style={{ top: Math.round(label.labelY) - 15, left: labelRight }} aria-label={`${movable ? 'Move' : 'Select'} ${level === 'entry' ? 'trade' : names[level].toLowerCase()} ${row.order.id}`} aria-description={description} title={grouped ? `${label.members.length} trades near this price` : `${description}. ${offscreen ? 'Outside visible range. Click to edit or use Fit trade.' : movable ? 'Drag to preview, then Apply. Click to enter an exact price.' : 'Select this trade.'}`}
                onPointerDown={e => {
                    suppressClick.current = false;
                    if (!movable || offscreen || e.button !== 0) return;
                    e.preventDefault(); e.stopPropagation(); e.currentTarget.focus();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    drag.current = { level, start: e.clientY, anchor: row.y, price: row.price, moved: false, renderedHeight: e.currentTarget.closest('.interactive-chart-plot')!.getBoundingClientRect().height * geometry.height / e.currentTarget.closest('.interactive-chart-plot')!.clientHeight };
                    engine?.freeze(true);
                }}
                onPointerMove={e => {
                    const d = drag.current;
                    if (!d || d.level !== level || !engine) return;
                    const y = chartDragCoordinate(d.anchor, e.clientY - d.start, geometry.height, d.renderedHeight);
                    if (y === null) return;
                    const raw = engine.series.coordinateToPrice(y);
                    if (raw === null || raw <= 0) return;
                    d.moved ||= Math.abs(e.clientY - d.start) > 3;
                    d.price = Number(Number(raw).toFixed(instrument(order.symbol).digits ?? 5));
                    if (d.moved) preview(level, d.price);
                }}
                onPointerUp={e => {
                    const d = drag.current;
                    if (!d) return;
                    drag.current = null;
                    suppressClick.current = d.moved;
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                    if (d.moved) { engine?.freeze(false); setDraft(current => current ? {...current} : null); /* Keep preview until Apply. */ } else cancel();
                }}
                onLostPointerCapture={() => { if (drag.current) cancel(); }}
                onPointerCancel={cancel}
                
                onClick={() => {
                    if (suppressClick.current) { suppressClick.current = false; return; }
                    if (grouped) setGroupOpen(label.members.map(member => member.order));
                    else if (movable) onEdit(level);
                    else onSelect(row.order.id);
                }}
                onKeyDown={e => {
                    if (!movable) return;
                    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                    else if (e.key === 'Enter' && draft?.level === level) { e.preventDefault(); commit(level, draft.price); }
                    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault(); engine?.freeze(true);
                        const digits = instrument(order.symbol).digits ?? 5;
                        const step = 10 ** -digits * (e.shiftKey ? 10 : 1);
                        preview(level, Number((row.price + (e.key === 'ArrowUp' ? step : -step)).toFixed(digits)));
                    }
                }}>
                <span className="trade-marker-kind">{offscreen ? offscreen === 'above' ? <ArrowUp /> : <ArrowDown /> : movable ? <GripVertical /> : null}{level === 'entry' ? row.order.orderType === 'BUY' ? 'Buy' : 'Sell' : level.toUpperCase()}</span>
                {grouped ? <span>{label.members.length} trades</span> : <><b>{formatPrice(row.price, order.symbol)}</b>{level === 'entry' && <span className="marker-volume">{row.order.lotSize} lots</span>}{level === 'entry' ? <span className={`marker-pnl ${pnl >= 0 ? 'positive' : 'negative'}`}>{row.order.status === 'PENDING' ? row.order.executionType : money(pnl)}</span> : <span className="marker-projection">{money(pnl)}</span>}</>}
            </button>;
        })}
        {layout.overflowCount > 0 && <button className="chart-overlay-overflow" onClick={()=>setGroupOpen(orders)}>+{layout.overflowCount} hidden levels · View trades</button>}
        {draft && <div className={`chart-drag-feedback ${draft.error ? 'is-invalid' : ''}`}><span role="status">{draft.error || `${names[draft.level]} → ${formatPrice(draft.price, order.symbol)}`}</span>{!drag.current && <><button className="apply-level" disabled={!!draft.error} onClick={()=>commit(draft.level,draft.price)}>Apply</button><button onClick={cancel}>Cancel</button></>}</div>}
        {groupOpen && <Dialog title="Trades on this chart" onClose={() => setGroupOpen(null)}><div className="chart-trade-list">{currentOrders([...new Map(groupOpen.map(o => [o.id, o])).values()]).map(o => <button key={o.id} onClick={() => { onSelect(o.id); setGroupOpen(null); }}><b>{o.id} · {o.orderType} {o.lotSize} lots</b><span>{formatPrice(o.openPrice, o.symbol)}</span></button>)}</div></Dialog>}
    </div>;
}
export function ChartRiskEditor({ order, onClose, initialLevel }: {
    order: PracticeOrder;
    onClose: () => void;
    initialLevel?: PracticeLevel;
}) {
    const [sl, setSl] = useState(order.sl === undefined ? '' : String(order.sl)), [tp, setTp] = useState(order.tp === undefined ? '' : String(order.tp)), [entry, setEntry] = useState(String(order.openPrice)), [error, setError] = useState('');
    const quote = usePracticeStore(s => s.quotes[order.symbol]);
    const notify = useWorkspaceStore(s => s.notify);
    const editingEntry = initialLevel === 'entry' && order.status === 'PENDING';
    return <Dialog title={editingEntry ? 'Edit pending entry' : 'Edit stop loss & take profit'} onClose={onClose}>
  <p className="muted">{order.id} · {order.orderType} {order.lotSize} lots {order.symbol}</p>
  <form onSubmit={e => { e.preventDefault(); try {
        if (editingEntry)
            usePracticeStore.getState().moveLevel(order.id, 'entry', Number(entry));
        else
            usePracticeStore.getState().manage(order.id, 'edit', { sl: sl ? Number(sl) : undefined, tp: tp ? Number(tp) : undefined });
        notify('Practice order levels updated.');
        onClose();
    }
    catch (e) {
        setError(errorMessage(e, 'Could not update levels.'));
    } }}>
   {editingEntry ? <label className="risk-editor-entry">Entry price<input type="number" step="any" min="0.000001" value={entry} onChange={e => setEntry(e.target.value)}/></label> : <div className="form-row"><label>Stop loss<input autoFocus={initialLevel === 'sl'} type="number" step="any" value={sl} onChange={e => setSl(e.target.value)} placeholder="Not set"/></label><label>Take profit<input autoFocus={initialLevel === 'tp'} type="number" step="any" value={tp} onChange={e => setTp(e.target.value)} placeholder="Not set"/></label></div>}
   {!editingEntry && <button type="button" className="text-button" onClick={() => { const base = order.status === 'PENDING' ? order.openPrice : order.orderType === 'BUY' ? quote?.bid : quote?.ask; if (!base)
        return; const distance = Math.max(base * 0.0015, (quote?.ask ?? base) - (quote?.bid ?? base)) * 2, sign = order.orderType === 'BUY' ? 1 : -1, digits = instrument(order.symbol).digits ?? 5; setSl((base - sign * distance).toFixed(digits)); setTp((base + sign * distance).toFixed(digits)); }}>Add initial SL &amp; TP levels</button>}
   <p className="notice-note">{editingEntry ? 'Moving the entry retains its order type and existing exit levels.' : 'Leave a field empty to remove that level. After saving, drag its chart handle or return here to enter an exact price.'}</p>
   {error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary full-width" type="submit">Save practice levels</button>
  </form>
 </Dialog>;
}
