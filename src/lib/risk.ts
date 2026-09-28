import type { TradeRequest } from './contracts';
// Converts a price move into account USD. Only USD-quoted and USD-based symbols are converted;
// anything else would need a cross rate, so it returns undefined instead of a guessed amount.
export function moneyAt(symbol: string, side: 'BUY' | 'SELL', lots: number, contract: number, entry: number, exit: number) {
    if (![lots, contract, entry, exit].every(Number.isFinite) || lots <= 0 || contract <= 0 || entry <= 0 || exit <= 0)
        return undefined;
    const raw = (exit - entry) * (side === 'BUY' ? 1 : -1) * lots * contract;
    const value = symbol.endsWith('USD') ? raw : symbol.startsWith('USD') ? raw / exit : undefined;
    return value === undefined ? undefined : Math.round(value * 100) / 100;
}
export type OrderRisk = { entry?: number; atStop?: number; atTarget?: number; rewardRisk?: number; margin?: number };
export function orderRisk(order: TradeRequest, reference: number | undefined, contract: number | undefined, leverage?: number): OrderRisk {
    const entry = order.executionType === 'MARKET' ? reference : order.limitPrice;
    if (!entry || !Number.isFinite(entry) || !contract)
        return { entry };
    const atStop = order.sl ? moneyAt(order.symbol, order.orderType, order.lotSize, contract, entry, order.sl) : undefined;
    const atTarget = order.tp ? moneyAt(order.symbol, order.orderType, order.lotSize, contract, entry, order.tp) : undefined;
    const rewardRisk = atStop !== undefined && atTarget !== undefined && atStop < 0 ? Math.round(atTarget / -atStop * 100) / 100 : undefined;
    const notional = order.symbol.startsWith('USD') ? order.lotSize * contract : order.symbol.endsWith('USD') ? order.lotSize * contract * entry : undefined;
    const margin = leverage && notional !== undefined ? Math.round(notional / leverage * 100) / 100 : undefined;
    return { entry, atStop, atTarget, rewardRisk, margin };
}
// Lots that lose `riskAmount` if the stop is hit, floored to the lot step.
export function lotsForRisk(symbol: string, side: 'BUY' | 'SELL', riskAmount: number, contract: number, entry: number, stop: number, step = 0.01) {
    const perLot = moneyAt(symbol, side, 1, contract, entry, stop);
    if (perLot === undefined || perLot >= 0 || !(riskAmount > 0))
        return undefined;
    const lots = Math.floor(riskAmount / -perLot / step + 1e-9) * step;
    return lots >= step ? Number(lots.toFixed(4)) : undefined;
}
