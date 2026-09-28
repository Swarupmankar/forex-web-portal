import type { Candle } from './chart';
export type StudyKey = 'sma' | 'ema' | 'bollinger' | 'rsi';
export type Study = {
    enabled: boolean;
    period: number;
    deviation?: number;
};
export type Studies = Record<StudyKey, Study>;
export const DEFAULT_STUDIES: Studies = { sma: { enabled: false, period: 20 }, ema: { enabled: false, period: 50 }, bollinger: { enabled: false, period: 20, deviation: 2 }, rsi: { enabled: false, period: 14 } };
export const STUDY_INFO: Record<StudyKey, {
    name: string;
    short: string;
    color: string;
    description: string;
}> = {
    sma: { name: 'Simple moving average', short: 'SMA', color: '#ddad45', description: 'The average closing price over your selected period.' },
    ema: { name: 'Exponential moving average', short: 'EMA', color: '#58a6e7', description: 'A moving average that gives recent prices more weight.' },
    bollinger: { name: 'Bollinger Bands', short: 'BB', color: '#ad8ade', description: 'A moving average with upper and lower standard-deviation bands.' },
    rsi: { name: 'Relative strength index', short: 'RSI', color: '#b28ce8', description: 'Wilder momentum oscillator with 30 and 70 reference levels.' }
};
export function validPeriod(period: number) { return Number.isInteger(period) && period >= 2 && period <= 200; }
export function normalizeStudies(value: unknown): Studies {
    const v = value as Partial<Studies> | undefined;
    return Object.fromEntries((Object.keys(DEFAULT_STUDIES) as StudyKey[]).map(k => {
        const candidate = v?.[k], base = DEFAULT_STUDIES[k];
        return [k, { ...base, enabled: typeof candidate?.enabled === 'boolean' ? candidate.enabled : base.enabled, period: validPeriod(candidate?.period as number) ? candidate!.period : base.period, ...(k === 'bollinger' ? { deviation: Number.isFinite(candidate?.deviation) && candidate!.deviation! >= 0.5 && candidate!.deviation! <= 4 ? candidate!.deviation : 2 } : {}) }];
    })) as Studies;
}
export type IndicatorPoint = {
    time: number;
    value: number;
};
export function sma(candles: Candle[], period: number): IndicatorPoint[] {
    if (!validPeriod(period))
        return [];
    let sum = 0;
    const output: IndicatorPoint[] = [];
    candles.forEach((c, i) => { sum += c.close; if (i >= period)
        sum -= candles[i - period].close; if (i >= period - 1)
        output.push({ time: c.time, value: sum / period }); });
    return output;
}
export function ema(candles: Candle[], period: number): IndicatorPoint[] {
    if (!validPeriod(period) || candles.length < period)
        return [];
    let average = candles.slice(0, period).reduce((sum, c) => sum + c.close, 0) / period;
    const out = [{ time: candles[period - 1].time, value: average }];
    const factor = 2 / (period + 1);
    for (let i = period; i < candles.length; i++) {
        average = candles[i].close * factor + average * (1 - factor);
        out.push({ time: candles[i].time, value: average });
    }
    return out;
}
export function bollinger(candles: Candle[], period: number, deviation = 2) {
    if (!validPeriod(period) || !Number.isFinite(deviation) || deviation <= 0)
        return { middle: [], upper: [], lower: [] };
    const middle = sma(candles, period);
    const upper: IndicatorPoint[] = [], lower: IndicatorPoint[] = [];
    middle.forEach((p, i) => { let variance = 0; for (let j = i; j < i + period; j++)
        variance += (candles[j].close - p.value) ** 2; const distance = Math.sqrt(variance / period) * deviation; upper.push({ time: p.time, value: p.value + distance }); lower.push({ time: p.time, value: p.value - distance }); });
    return { middle, upper, lower };
}
export function rsi(candles: Candle[], period: number): IndicatorPoint[] {
    if (!validPeriod(period) || candles.length <= period)
        return [];
    let gain = 0, loss = 0;
    for (let i = 1; i <= period; i++) {
        const delta = candles[i].close - candles[i - 1].close;
        gain += Math.max(0, delta);
        loss += Math.max(0, -delta);
    }
    gain /= period;
    loss /= period;
    const value = () => gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    const out = [{ time: candles[period].time, value: value() }];
    for (let i = period + 1; i < candles.length; i++) {
        const delta = candles[i].close - candles[i - 1].close;
        gain = (gain * (period - 1) + Math.max(0, delta)) / period;
        loss = (loss * (period - 1) + Math.max(0, -delta)) / period;
        out.push({ time: candles[i].time, value: value() });
    }
    return out;
}
