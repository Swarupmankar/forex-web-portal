import type { PracticeAccount } from './practice';
export function readPracticeAccount(raw: string | null, fallback: PracticeAccount): PracticeAccount {
    try {
        const a = raw ? JSON.parse(raw)?.state?.account : undefined;
        const statuses = new Set(['OPEN', 'PENDING', 'CLOSED', 'CANCELLED', 'REJECTED']);
        const valid = a && Number.isFinite(a.balance) && Number.isSafeInteger(a.sequence) && a.sequence > 0 && Array.isArray(a.orders) && a.orders.every((o: Record<string, unknown>) => typeof o.id === 'string' && typeof o.symbol === 'string' && ['BUY', 'SELL'].includes(String(o.orderType)) && statuses.has(String(o.status)) && Number.isFinite(o.openPrice) && Number.isFinite(o.lotSize) && Number.isFinite(o.margin) && Number.isFinite(o.pnl));
        return valid ? a : fallback;
    }
    catch {
        return fallback;
    }
}
