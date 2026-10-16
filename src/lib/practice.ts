import type { TradeRequest } from './contracts';
import { validateTrade } from './contracts';
import type { PriceTick } from '../types/trading';
export const PRACTICE_BALANCE = 10000;
export const PRACTICE_CONTRACTS: Record<string, number> = { EURUSD: 100000, GBPUSD: 100000, AUDUSD: 100000, USDJPY: 100000, XAUUSD: 100, XAGUSD: 5000, BTCUSD: 1, ETHUSD: 1 };
export type PracticeOrder = TradeRequest & {
    id: string;
    status: 'OPEN' | 'PENDING' | 'CLOSED' | 'CANCELLED' | 'REJECTED';
    openPrice: number;
    margin: number;
    createdAt: string;
    filledAt?: string;
    closedAt?: string;
    exitPrice?: number;
    pnl: number;
    reason?: string;
};
export type PracticeAccount = {
    balance: number;
    orders: PracticeOrder[];
    sequence: number;
};
export type Quotes = Record<string, PriceTick>;
export const newPracticeAccount = (): PracticeAccount => ({ balance: PRACTICE_BALANCE, orders: [], sequence: 1 });
const cents = (n: number) => Math.round(n * 100) / 100;
export function validQuote(q: PriceTick | undefined, now = Date.now()): q is PriceTick {
    return !!q && Number.isFinite(q.bid) && Number.isFinite(q.ask) && q.bid > 0 && q.ask >= q.bid && Number(q.timestamp) <= now + 1000 && now - Number(q.timestamp) < 15000;
}
export function practicePnl(o: PracticeOrder, q?: PriceTick) {
    if (o.status !== 'OPEN' || !q)
        return o.pnl;
    const price = o.orderType === 'BUY' ? q.bid : q.ask;
    const raw = (price - o.openPrice) * (o.orderType === 'BUY' ? 1 : -1) * o.lotSize * PRACTICE_CONTRACTS[o.symbol];
    return cents(o.symbol === 'USDJPY' ? raw / price : raw);
}
export function practiceMetrics(a: PracticeAccount, quotes: Quotes) {
    const open = a.orders.filter(o => o.status === 'OPEN');
    const margin = cents(open.reduce((n, o) => n + o.margin, 0));
    const floating = cents(open.reduce((n, o) => n + practicePnl(o, quotes[o.symbol]), 0));
    const equity = cents(a.balance + floating);
    return { balance: a.balance, equity, margin, floating, freeMargin: cents(equity - margin), marginLevel: margin ? equity / margin * 100 : undefined };
}
function requiredMargin(o: TradeRequest, price: number) { return cents(o.lotSize * PRACTICE_CONTRACTS[o.symbol] * (o.symbol === 'USDJPY' ? 1 : price) / 100); }
export function placePractice(a: PracticeAccount, request: TradeRequest, quotes: Quotes, now = Date.now()): PracticeAccount {
    const q = quotes[request.symbol];
    if (!validQuote(q, now))
        throw new Error('Waiting for a fresh practice quote. Try again in a moment.');
    if (!PRACTICE_CONTRACTS[request.symbol])
        throw new Error('This instrument is not available in practice mode.');
    if (!['BUY', 'SELL'].includes(request.orderType) || !['MARKET', 'LIMIT', 'STOP'].includes(request.executionType))
        throw new Error('Invalid order type.');
    const price = request.orderType === 'BUY' ? q.ask : q.bid;
    const issue = validateTrade(request, price);
    if (issue)
        throw new Error(issue);
    if (request.lotSize < 0.01 || request.lotSize > 100 || Math.abs(request.lotSize * 100 - Math.round(request.lotSize * 100)) > 0.00001)
        throw new Error('Use 0.01–100 lots, in steps of 0.01.');
    if (a.orders.filter(o => o.status === 'OPEN' || o.status === 'PENDING').length >= 100)
        throw new Error('Close or cancel an order before adding another.');
    const entry = request.executionType === 'MARKET' ? price : request.limitPrice!;
    const margin = requiredMargin(request, entry);
    if (margin > practiceMetrics(a, quotes).freeMargin)
        throw new Error('Not enough virtual free margin. Reduce the volume or close a position.');
    const order: PracticeOrder = { ...request, id: `P${a.sequence}`, status: request.executionType === 'MARKET' ? 'OPEN' : 'PENDING', openPrice: entry, margin, createdAt: new Date(now).toISOString(), pnl: 0 };
    if (order.status === 'OPEN' && margin - practicePnl(order, q) > practiceMetrics(a, quotes).freeMargin)
        throw new Error('Not enough virtual margin to cover this trade.');
    return { ...a, sequence: a.sequence + 1, orders: [order, ...a.orders] };
}
export function managePractice(a: PracticeAccount, id: string, action: 'close' | 'cancel' | 'edit', quotes: Quotes, levels: {
    sl?: number;
    tp?: number;
} = {}, now = Date.now()): PracticeAccount {
    const o = a.orders.find(o => o.id === id);
    if (!o || !['OPEN', 'PENDING'].includes(o.status))
        throw new Error('This order is no longer open.');
    if (action === 'cancel') {
        if (o.status !== 'PENDING')
            throw new Error('Only pending orders can be cancelled.');
        return { ...a, orders: a.orders.map(x => x.id === id ? { ...x, status: 'CANCELLED', closedAt: new Date(now).toISOString() } : x) };
    }
    const q = quotes[o.symbol];
    if (!validQuote(q, now))
        throw new Error('Waiting for a fresh practice quote.');
    if (action === 'edit') {
        const reference = o.status === 'PENDING' ? o.openPrice : o.orderType === 'BUY' ? q.bid : q.ask;
        const issue = validateTrade({ ...o, ...levels, executionType: 'MARKET' }, reference);
        if (issue)
            throw new Error(issue);
        return { ...a, orders: a.orders.map(x => x.id === id ? { ...x, ...levels } : x) };
    }
    if (o.status !== 'OPEN')
        throw new Error('Only an open position can be closed.');
    const pnl = practicePnl(o, q);
    return { ...a, balance: cents(a.balance + pnl), orders: a.orders.map(x => x.id === id ? { ...x, status: 'CLOSED', exitPrice: o.orderType === 'BUY' ? q.bid : q.ask, pnl, closedAt: new Date(now).toISOString(), reason: 'Manual close' } : x) };
}
// Closes part of an open position. The closed part becomes its own history record; the remainder keeps the original id.
export function closePracticeVolume(a: PracticeAccount, id: string, lots: number, quotes: Quotes, now = Date.now()): PracticeAccount {
    const o = a.orders.find(o => o.id === id);
    if (!o || o.status !== 'OPEN')
        throw new Error('Only an open position can be closed.');
    if (!Number.isFinite(lots) || lots <= 0 || Math.abs(lots * 100 - Math.round(lots * 100)) > 0.00001)
        throw new Error('Enter a close volume in steps of 0.01 lots.');
    if (lots > o.lotSize + 1e-9)
        throw new Error(`You can close up to ${o.lotSize} lots.`);
    if (Math.abs(lots - o.lotSize) < 1e-9)
        return managePractice(a, id, 'close', quotes, {}, now);
    const q = quotes[o.symbol];
    if (!validQuote(q, now))
        throw new Error('Waiting for a fresh practice quote.');
    const part = Math.round(lots * 100) / 100, rest = Math.round((o.lotSize - part) * 100) / 100;
    const closedPart: PracticeOrder = { ...o, id: `P${a.sequence}`, lotSize: part, margin: cents(o.margin * part / o.lotSize), status: 'OPEN' };
    const pnl = practicePnl(closedPart, q);
    const record: PracticeOrder = { ...closedPart, status: 'CLOSED', exitPrice: o.orderType === 'BUY' ? q.bid : q.ask, pnl, closedAt: new Date(now).toISOString(), reason: `Partial close of ${o.id}` };
    const remainder: PracticeOrder = { ...o, lotSize: rest, margin: cents(o.margin - closedPart.margin) };
    return { ...a, sequence: a.sequence + 1, balance: cents(a.balance + pnl), orders: [record, ...a.orders.map(x => x.id === id ? remainder : x)] };
}
export type BulkClose = 'all' | 'profitable' | 'losing' | 'pending';
// Applies one action to every matching order; orders that cannot be priced are left untouched and counted.
export function closePracticeMany(a: PracticeAccount, which: BulkClose, quotes: Quotes, symbol?: string, now = Date.now()) {
    let next = a, done = 0, skipped = 0;
    for (const o of a.orders) {
        if (symbol && o.symbol !== symbol)
            continue;
        if (which === 'pending') {
            if (o.status !== 'PENDING')
                continue;
            next = managePractice(next, o.id, 'cancel', quotes, {}, now);
            done++;
            continue;
        }
        if (o.status !== 'OPEN')
            continue;
        if (!validQuote(quotes[o.symbol], now)) {
            skipped++;
            continue;
        }
        const pnl = practicePnl(o, quotes[o.symbol]);
        if ((which === 'profitable' && pnl <= 0) || (which === 'losing' && pnl >= 0))
            continue;
        next = managePractice(next, o.id, 'close', quotes, {}, now);
        done++;
    }
    return { account: next, done, skipped };
}
// Called only by the browser's simulated feed. No server or execution API is involved.
export function settlePractice(a: PracticeAccount, quotes: Quotes, now = Date.now()): PracticeAccount {
    let next = a;
    for (const original of a.orders) {
        let o = original;
        const q = quotes[o.symbol];
        if (!validQuote(q, now))
            continue;
        const buy = o.orderType === 'BUY';
        if (o.status === 'PENDING') {
            const price = buy ? q.ask : q.bid;
            const crossed = o.executionType === 'LIMIT' ? (buy ? price <= o.openPrice : price >= o.openPrice) : (buy ? price >= o.openPrice : price <= o.openPrice);
            if (!crossed)
                continue;
            const filled = { ...o, status: 'OPEN' as const, filledAt: new Date(now).toISOString(), openPrice: price, margin: requiredMargin(o, price) };
            if (filled.margin - practicePnl(filled, q) > practiceMetrics(next, quotes).freeMargin) {
                next = { ...next, orders: next.orders.map(x => x.id === o.id ? { ...x, status: 'REJECTED', reason: 'Insufficient virtual margin', closedAt: new Date(now).toISOString() } : x) };
                continue;
            }
            o = filled;
            next = { ...next, orders: next.orders.map(x => x.id === o.id ? o : x) };
        }
        if (o.status !== 'OPEN')
            continue;
        const exit = buy ? q.bid : q.ask;
        const reason = o.sl !== undefined && (buy ? exit <= o.sl : exit >= o.sl) ? 'Stop loss' : o.tp !== undefined && (buy ? exit >= o.tp : exit <= o.tp) ? 'Take profit' : undefined;
        if (reason) {
            next = managePractice(next, o.id, 'close', quotes, {}, now);
            next = { ...next, orders: next.orders.map(x => x.id === o.id ? { ...x, reason } : x) };
        }
    }
    // Stop-out closes the largest loser first and re-checks after each close, like a broker would,
    // instead of liquidating everything at once.
    while (practiceMetrics(next, quotes).margin > 0 && practiceMetrics(next, quotes).equity <= practiceMetrics(next, quotes).margin * 0.5) {
        const worst = next.orders
            .filter(o => o.status === 'OPEN' && validQuote(quotes[o.symbol], now))
            .sort((x, y) => practicePnl(x, quotes[x.symbol]) - practicePnl(y, quotes[y.symbol]))[0];
        if (!worst)
            break;
        next = managePractice(next, worst.id, 'close', quotes, {}, now);
        next = { ...next, orders: next.orders.map(x => x.id === worst.id ? { ...x, reason: 'Practice margin stop-out' } : x) };
    }
    // Negative balance protection: a practice balance never goes below zero.
    if (next.balance < 0)
        next = { ...next, balance: 0, orders: next.orders.map(o => o.status === 'CLOSED' && o.closedAt === new Date(now).toISOString() ? { ...o, reason: `${o.reason ?? 'Closed'} · balance protected at $0` } : o) };
    return next;
}
// Keeps all open and pending orders and the newest `max` finished ones, so storage can't grow without bound.
export function trimHistory(a: PracticeAccount, max = 1000): PracticeAccount {
    let finished = 0;
    const orders = a.orders.filter(o => o.status === 'OPEN' || o.status === 'PENDING' || ++finished <= max);
    return orders.length === a.orders.length ? a : { ...a, orders };
}
export type PracticeLevel = 'sl' | 'tp' | 'entry';
export function movePracticeLevel(a: PracticeAccount, id: string, level: PracticeLevel, price: number | undefined, quotes: Quotes, now = Date.now()): PracticeAccount {
    const order = a.orders.find(o => o.id === id);
    if (!order || !['OPEN', 'PENDING'].includes(order.status))
        throw new Error('This position is no longer active.');
    if (level !== 'entry')
        return managePractice(a, id, 'edit', quotes, { sl: level === 'sl' ? price : order.sl, tp: level === 'tp' ? price : order.tp }, now);
    if (order.status !== 'PENDING')
        throw new Error('An executed entry price cannot be moved.');
    const q = quotes[order.symbol];
    if (!validQuote(q, now))
        throw new Error('Waiting for a fresh practice quote.');
    const revised = { ...order, limitPrice: price };
    const invalid = validateTrade(revised, order.orderType === 'BUY' ? q.ask : q.bid);
    if (invalid)
        throw new Error(invalid);
    const margin = requiredMargin(order, price!);
    if (margin > practiceMetrics(a, quotes).freeMargin)
        throw new Error('Not enough virtual margin at this entry price.');
    return { ...a, orders: a.orders.map(o => o.id === id ? { ...o, limitPrice: price, openPrice: price!, margin } : o) };
}
export function pendingAtPrice(side: 'BUY' | 'SELL', price: number, reference: number): 'LIMIT' | 'STOP' {
    return (side === 'BUY' ? price < reference : price > reference) ? 'LIMIT' : 'STOP';
}
export function projectedPracticePnl(o: PracticeOrder, price: number) {
    const raw = (price - o.openPrice) * (o.orderType === 'BUY' ? 1 : -1) * o.lotSize * PRACTICE_CONTRACTS[o.symbol];
    return cents(o.symbol === 'USDJPY' ? raw / price : raw);
}
