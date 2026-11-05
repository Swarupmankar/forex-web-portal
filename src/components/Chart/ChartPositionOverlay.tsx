'use client';
import { useMarketDisplay } from '@/hooks/useMarketDisplay';
import { shiftPendingEntry } from '@/lib/contracts';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import type { ChartEngine, ChartLevel } from './useChartEngine';
import { usePracticeStore } from '@/store/usePracticeStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { projectedPracticePnl, practicePnl, movePracticeLevel, type PracticeOrder, type PracticeLevel } from '@/lib/practice';
import { chartDragCoordinate } from '@/lib/chartInteraction';
import { layoutChartOverlays } from '@/lib/chartOverlayLayout';
import { errorMessage } from '@/lib/market';
import { Dialog } from '@/components/terminal/Dialog';

const names: Record<PracticeLevel, string> = { sl: 'Stop loss', tp: 'Take profit', entry: 'Pending entry' };
const colors = { entry: '#5685aa', sl: '#d95765', tp: '#219778' };
const money = (value: number) => !Number.isFinite(value) ? "—" : `${value >= 0 ? '+' : '−'}$${Math.abs(value).toFixed(2)}`;

type Draft = { level: PracticeLevel; price: number; error: string };
export function ChartPositionOverlay({ engine, order, orders, onSelect, onEdit, onReview, visible, extraLines = [], connected }: {
    engine: ChartEngine | null;
    order?: PracticeOrder;
    orders: PracticeOrder[];
    onSelect: (id: string) => void;
    onEdit: (level?: PracticeLevel) => void;
    onReview?: (order:PracticeOrder,level:PracticeLevel,price:number)=>void;
    visible: boolean;
    extraLines?: ChartLevel[];
    connected?: {
        canManage: boolean;
        pnl: (order: PracticeOrder, price?: number) => number;
        validate: (order: PracticeOrder, level: PracticeLevel, price: number) => string | null;
        review: (order: PracticeOrder, level: PracticeLevel, price: number) => void;
    };
}) {
  const { formatPrice, instrument } = useMarketDisplay();
    const [geometry, setGeometry] = useState({ coordinates: {} as Record<string, number>, width: 0, height: 0 });
    const [draft, setDraft] = useState<Draft | null>(null);
    const [groupOpen, setGroupOpen] = useState<PracticeOrder[] | null>(null);
    const drag = useRef<{ level: PracticeLevel; start: number; anchor: number; price: number; moved: boolean; renderedHeight: number } | null>(null);
    const suppressClick = useRef(false);
    const practiceQuote = usePracticeStore(s => order ? s.quotes[order.symbol] : undefined);
    const displayOrder = order && draft ? {
        ...order,
        ...(draft.level === 'entry' ? { ...shiftPendingEntry(order.openPrice, draft.price, order, instrument(order.symbol).digits), openPrice: draft.price } : { [draft.level]: draft.price }),
    } : order;
    const latest = useRef({ order, orders, draft, visible, displayOrder });
    latest.current = { order, orders, draft, visible, displayOrder };
    const notify = useWorkspaceStore(s => s.notify);
    const price = (level: PracticeLevel) => level === 'entry' ? displayOrder?.openPrice : displayOrder?.[level];
    const levelsKey = orders.map(o => `${o.id}:${o.status}:${o.openPrice}:${o.sl}:${o.tp}`).join('|');

    function cancel() { drag.current = null; setDraft(null); engine?.freeze(false); }
    useEffect(() => { cancel(); setGroupOpen(null); }, [order?.id,order?.status,order?.lotSize,order?.sl,order?.tp,order?.openPrice,visible,engine]);
    useEffect(() => {
        if (!engine?.alive()) return;
        const update = () => {
            const { order, orders, displayOrder } = latest.current;
            const coordinates: Record<string, number> = {};
            orders.forEach(o => {
                const y = engine.series.priceToCoordinate(order?.id === o.id ? displayOrder!.openPrice : o.openPrice);
                if (y !== null) coordinates[o.id] = Number(y);
            });
            for (const level of ['sl', 'tp'] as const) {
                const p = displayOrder?.[level];
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
            title: '', color: o.status === 'PENDING' ? '#b1832b' : o.orderType === 'BUY' ? '#219778' : '#d95765', selected: o.id === order?.id, kind: 'entry' as const, pending: o.status === 'PENDING'
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
    }, [engine, levelsKey, order?.id, draft, visible, extraLines, instrument]);
    useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape'&&!e.defaultPrevented&&!(e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"],[role=dialog]')) cancel(); };
        const blur = () => cancel();
        document.addEventListener('keydown', esc);
        window.addEventListener('blur', blur);
        return () => { document.removeEventListener('keydown', esc); window.removeEventListener('blur', blur); };
    }, [engine]);

    function preview(level: PracticeLevel, p: number) {
        if (!order) return;
        let error = '';
        try {
            if (connected) { setDraft({ level, price: p, error: connected.validate(order, level, p) || '' }); return; }
            const state = usePracticeStore.getState();
            movePracticeLevel(state.account, order.id, level, p, state.quotes);
        } catch (e) { error = errorMessage(e, 'Invalid price'); }
        setDraft({ level, price: p, error });
    }
    function commit(level: PracticeLevel, p: number) {
        if (!order) return;
        try {
            if (connected) {
                const issue = connected.validate(order, level, p);
                if (issue) throw new Error(issue);
                connected.review(order, level, p); return;
            }
            if(onReview){onReview(order,level,p);return;}
            usePracticeStore.getState().moveLevel(order.id, level, p);
            notify(`${names[level]} updated to ${formatPrice(p, order.symbol)}.`);
        } catch (e) { notify(errorMessage(e, 'This price could not be saved.'), 'error'); }
        finally { cancel(); }
    }
    if (!order || !visible) return null;
    const rows = [
        ...orders.map(o => ({ id: o.id, group:`${o.status}:${o.orderType}:${o.executionType}`, kind: 'entry' as PracticeLevel, order: o, selected: o.id === order.id, y: geometry.coordinates[o.id], price: o.id === order.id ? price('entry')! : o.openPrice })),
        ...(['sl', 'tp'] as const).flatMap(level => price(level) === undefined ? [] : [{ id: level, kind: level, order, selected: true, y: geometry.coordinates[level], price: price(level)! }])
    ];
    const layout = layoutChartOverlays(rows, geometry.height, { top: 32, bottom: 18, gap: 32 });
    const labels = layout.labels;
    const labelRight = Math.max(0, Math.round(geometry.width - 12));
    const currentOrders = (list: PracticeOrder[]) => list.flatMap(o => { const current = orders.find(active => active.id === o.id); return current ? [current] : []; });
    return <div className="chart-position-overlay">
        <svg className="trade-label-leaders" width="100%" height="100%" aria-hidden="true">
            {labels.filter(l => l.anchorY >= 0 && l.anchorY <= geometry.height).map(l => <path key={l.id} d={`M ${labelRight} ${Math.round(l.labelY)} L ${Math.round(geometry.width - 3)} ${Math.round(l.anchorY)} L ${Math.round(geometry.width)} ${Math.round(l.anchorY)}`} fill="none" stroke={l.selected ? colors[l.kind] : '#87939f88'} strokeWidth="1"/>)}
        </svg>
        {labels.map(label => {
            const row = label.members[0], level = row.kind, active = label.selected, grouped = label.members.length > 1;
            const offscreen = label.offscreen;
            const movable = active && (!connected || connected.canManage) && (level !== 'entry' || row.order.status === 'PENDING');
            const dragging = draft?.level === level && active;
            const projectionOrder = active ? displayOrder! : row.order;
            const pnl = connected ? connected.pnl(projectionOrder, level === 'entry' ? undefined : row.price) : level === 'entry' ? practicePnl(row.order, practiceQuote) : projectedPracticePnl(projectionOrder, row.price);
            const description = `${level === 'entry' ? `${row.order.orderType} ${row.order.lotSize} lots` : names[level]} at ${formatPrice(row.price, row.order.symbol)}, ${money(pnl)}`;
            return <button key={label.id} data-price-coordinate={row.y} className={`trade-marker ${level} is-${row.order.orderType.toLowerCase()} ${row.order.status === 'PENDING' ? 'is-pending' : 'is-position'} ${active ? 'is-selected' : 'is-secondary'} ${dragging ? 'is-dragging' : ''} ${dragging && draft.error ? 'is-invalid' : ''} ${offscreen ? 'is-offscreen' : ''}`} style={{ top: Math.round(label.labelY), left: labelRight, maxWidth: Math.max(0, geometry.width - 24) }} aria-pressed={active} aria-label={grouped ? `View ${label.members.length} ${row.order.status === 'PENDING' ? 'pending orders' : 'positions'} near this price` : `${movable ? 'Move' : 'Select'} ${level === 'entry' ? 'trade' : names[level].toLowerCase()} ${row.order.id}`} aria-description={description} title={grouped ? `${label.members.length} ${row.order.status === 'PENDING' ? 'pending orders' : 'positions'} near this price` : `${description}. ${offscreen ? 'Outside visible range. Click to fit this price.' : movable ? 'Drag to preview, then edit in ticket. Click to enter an exact price.' : 'Select this trade.'}`}
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
                    else if (offscreen) { onSelect(row.order.id); engine?.fitLevels([row.price]); }
                    else if (movable) onEdit(level);
                    else onSelect(row.order.id);
                }}
                onKeyDown={e => {
                    if (!movable) return;
                    if (e.key === 'Escape') { e.preventDefault();e.stopPropagation(); cancel(); }
                    else if (e.key === 'Enter' && draft?.level === level) { e.preventDefault(); commit(level, draft.price); }
                    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault(); engine?.freeze(true);
                        const digits = instrument(order.symbol).digits ?? 5;
                        const step = 10 ** -digits * (e.shiftKey ? 10 : 1);
                        preview(level, Number((row.price + (e.key === 'ArrowUp' ? step : -step)).toFixed(digits)));
                    }
                }}>
                <span className="trade-marker-kind">{offscreen ? offscreen === 'above' ? <ArrowUp /> : <ArrowDown /> : movable ? <GripVertical /> : null}{level === 'entry' ? row.order.orderType === 'BUY' ? 'Buy' : 'Sell' : level.toUpperCase()}</span>
                {grouped ? <span>{label.members.length} {row.order.status === 'PENDING' ? 'pending' : 'positions'}</span> : <><b>{formatPrice(row.price, order.symbol)}</b>{level === 'entry' && <span className="marker-volume">{row.order.lotSize} lots</span>}{level === 'entry' ? <span className={`marker-pnl ${row.order.status === 'PENDING' ? 'pending-label' : pnl >= 0 ? 'positive' : 'negative'}`}>{row.order.status === 'PENDING' ? `Pending ${row.order.executionType.toLowerCase()}` : money(pnl)}</span> : <span className="marker-projection">{money(pnl)}</span>}</>}
            </button>;
        })}
        {layout.overflowCount > 0 && <button className="chart-overlay-overflow" onClick={()=>setGroupOpen(orders)}>+{layout.overflowCount} hidden levels · View trades</button>}
        {draft && <div className={`chart-drag-feedback ${draft.error ? 'is-invalid' : ''}`}><span role="status">{draft.error || `${names[draft.level]} → ${formatPrice(draft.price, order.symbol)}`}</span>{!drag.current && <><button className="apply-level" disabled={!!draft.error} onClick={()=>commit(draft.level,draft.price)}>{connected || onReview ? 'Edit in ticket' : 'Apply'}</button><button onClick={cancel}>Cancel</button></>}</div>}
        {groupOpen && <Dialog title="Trades on this chart" onClose={() => setGroupOpen(null)}><div className="chart-trade-list">{currentOrders([...new Map(groupOpen.map(o => [o.id, o])).values()]).map(o => <button key={o.id} onClick={() => { onSelect(o.id); setGroupOpen(null); }}><span className="trade-list-copy"><b>{o.orderType} {o.lotSize} lots · {o.symbol}</b><small>#{o.id} · {o.status === 'PENDING' ? `Pending ${o.executionType.toLowerCase()}` : 'Open position'}</small></span><span className="trade-list-value">{formatPrice(o.openPrice, o.symbol)}</span></button>)}</div></Dialog>}
    </div>;
}
