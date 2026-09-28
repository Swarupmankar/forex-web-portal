import type { Candle } from './chart';
import type { IndicatorPoint, Study, StudyKey } from './indicators';

type Line = 'sma' | 'ema' | 'middle' | 'upper' | 'lower' | 'rsi';
type State = { value?: number; gain?: number; loss?: number };
type Cache = { start?: number; period: number; deviation?: number; states: State[] };
const keys: StudyKey[] = ['sma', 'ema', 'bollinger', 'rsi'];

/** Per-chart cache, keyed by study. A full history load or parameter change rebuilds it.
 *  For live ticks we recalculate from the changed bar, preserving the state BEFORE it.
 *  Repeated updates to an open candle therefore never compound EMA/RSI smoothing. */
export function createStudyCache() {
  const caches = new Map<StudyKey, Cache>();
  return {
    clear() { caches.clear(); },
    values(key: StudyKey, bars: Candle[], study: Study, since?: number): Partial<Record<Line, IndicatorPoint[]>> {
      const period = study.period, deviation = study.deviation ?? 2;
      if (!keys.includes(key) || !Number.isInteger(period) || period < 2 || period > 200) return {};
      let cache = caches.get(key);
      const rebuild = since === undefined || !cache || cache.start !== bars[0]?.time || cache.period !== period || cache.deviation !== deviation || cache.states.length > bars.length;
      if (rebuild) {
        cache = { start: bars[0]?.time, period, deviation, states: [] };
        caches.set(key, cache);
      }
      const states = cache!.states;
      let from = 0;
      if (!rebuild && since !== undefined) {
        from = bars.length;
        while (from > 0 && bars[from - 1].time >= since) from--;
        from = Math.min(from, states.length);
      }
      states.length = from;
      const result: Partial<Record<Line, IndicatorPoint[]>> = {};
      const push = (line: Line, time: number, value: number) => (result[line] ??= []).push({ time, value });
      for (let i = from; i < bars.length; i++) {
        const { time, close } = bars[i];
        const previous = states[i - 1];
        const current: State = {};
        if (key === 'rsi' && i >= period) {
          let gain = 0, loss = 0;
          if (i === period) {
            for (let j = 1; j <= period; j++) {
              const delta = bars[j].close - bars[j - 1].close;
              gain += Math.max(0, delta); loss += Math.max(0, -delta);
            }
            gain /= period; loss /= period;
          } else {
            const delta = close - bars[i - 1].close;
            gain = (previous!.gain! * (period - 1) + Math.max(0, delta)) / period;
            loss = (previous!.loss! * (period - 1) + Math.max(0, -delta)) / period;
          }
          current.gain = gain; current.loss = loss;
          current.value = gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
          push('rsi', time, current.value);
        } else if (key !== 'rsi' && i >= period - 1) {
          if (key === 'ema' && i >= period) {
            const factor = 2 / (period + 1);
            current.value = close * factor + previous!.value! * (1 - factor);
          } else {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) sum += bars[j].close;
            current.value = sum / period;
          }
          if (key === 'bollinger') {
            let variance = 0;
            for (let j = i - period + 1; j <= i; j++) variance += (bars[j].close - current.value) ** 2;
            const distance = Math.sqrt(variance / period) * deviation;
            push('middle', time, current.value); push('upper', time, current.value + distance); push('lower', time, current.value - distance);
          } else push(key, time, current.value);
        }
        states.push(current);
      }
      return result;
    },
  };
}
