import type { TradeRequest } from "./contracts";
type Failure = { status?: number | string; data?: { outcome?: string } | unknown };
// "unknown" means the request may have reached the broker: the trader must not be told to retry
// blindly. Validation, auth and gate failures are definite rejections.
export function classifyFailure(error: unknown): "unknown" | "rejected" {
    const e = (error ?? {}) as Failure;
    const outcome = (e.data as { outcome?: string } | undefined)?.outcome;
    if (outcome === "unknown")
        return "unknown";
    if (outcome === "not_sent" || outcome === "rejected")
        return "rejected";
    if (e.status === "FETCH_ERROR" || e.status === "TIMEOUT_ERROR")
        return "unknown";
    // Without an explicit outcome, a server-side fault may have happened after the order was sent.
    return e.status === 500 || e.status === 502 || e.status === 504 ? "unknown" : "rejected";
}
type ServerOrder = {
    orderStatus?: string; status?: string;
    id: string | number; symbol?: string; orderType?: string; executionType?: string;
    lotSize?: string | number; lotSizeStore?: string | number; volume?: number; createdAt?: string;
    limitPrice?: string | number; sl?: string | number | null; tp?: string | number | null;
    openPrice?: number;
    orderDetails?: { entryExecutionType?: string; entryPrice?: string | number | null; entrylimit?: string | number | null; limitPrice?: string | number | null };
};
// A matching row is evidence, not an idempotency-key lookup. Stay uncertain if another
// device produced an indistinguishable order, or if the server omitted matching fields.
export function findSubmittedOrder(request: TradeRequest, knownIds: string[], orders: ServerOrder[], startedAt: number) {
    const known = new Set(knownIds);
    const matches = orders.filter(o => {
        if (known.has(String(o.id)) || o.symbol !== request.symbol)
            return false;
        if (!String(o.orderType ?? "").toUpperCase().startsWith(request.orderType))
            return false;
        const type = String(o.orderDetails?.entryExecutionType ?? o.executionType ?? String(o.orderType).split('_')[1] ?? '').toUpperCase();
        if (type !== request.executionType) return false;
        // lotSizeStore is what was requested; lotSize is "0" until an A-book order fills.
        const lots = Number(o.lotSizeStore ?? o.lotSize ?? o.volume);
        if (!Number.isFinite(lots) || lots <= 0 || Math.abs(lots - request.lotSize) > 1e-6)
            return false;
        if (request.executionType !== 'MARKET') {
            const entry = Number(o.orderDetails?.entrylimit ?? o.orderDetails?.limitPrice ?? o.limitPrice);
            if (!(entry > 0) || request.limitPrice === undefined || Math.abs(entry - request.limitPrice) > 1e-8) return false;
        }
        for (const key of ['sl', 'tp'] as const) {
            const actual = Number(o[key] ?? 0), expected = request[key] ?? 0;
            if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-8) return false;
        }
        const created = o.createdAt ? Date.parse(o.createdAt) : NaN;
        // Allow for clock differences between this device and the server.
        return Number.isFinite(created) && created >= startedAt - 120000 && created <= Date.now() + 120000;
    });
    const unique = new Map(matches.map(o => [String(o.id), o]));
    return unique.size === 1 ? unique.values().next().value : undefined;
}
