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
type ServerOrder = { id: string | number; symbol?: string; orderType?: string; lotSize?: string | number; volume?: number; createdAt?: string };
// Finds an order that appeared after an unconfirmed submit and matches what was sent.
export function findSubmittedOrder(request: TradeRequest, knownIds: string[], orders: ServerOrder[], startedAt: number) {
    const known = new Set(knownIds);
    return orders.find(o => {
        if (known.has(String(o.id)) || o.symbol !== request.symbol)
            return false;
        if (!String(o.orderType ?? "").toUpperCase().startsWith(request.orderType))
            return false;
        const lots = Number(o.lotSize ?? o.volume);
        if (Number.isFinite(lots) && Math.abs(lots - request.lotSize) > 1e-6)
            return false;
        const created = o.createdAt ? Date.parse(o.createdAt) : NaN;
        // Allow for clock differences between this device and the server.
        return !Number.isFinite(created) || created >= startedAt - 120000;
    });
}
