type PriceMetadata = { digits?: number; pipSize?: number };
const MAX_DIGITS = 8; // The broker feed uses 1e8-scaled prices.
const crypto = ['BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'XRP', 'MATIC', 'BNB', 'LTC', 'SHIB', 'DOT', 'BCH', 'AVAX', 'TRX', 'TON', 'XLM'];
const indices = ['DJI', 'NDX', 'SPX', 'US30', 'US100', 'US500', 'GER40', 'DE40', 'DE30', 'UK100', 'FR40', 'JP225', 'HK50', 'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];

export function decimalPlaces(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value.toFixed(MAX_DIGITS).replace(/0+$/, '').split('.')[1]?.length ?? 0;
}

// Same fallbacks as the mobile app, used until broker metadata/quotes arrive.
function fallbackDigits(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s.startsWith('XAG')) return 3;
  if (/^X(AU|PT|PD)/.test(s)) return 2;
  if (crypto.some(c => s.includes(c)) || indices.some(c => s.includes(c)) || /(OIL|BRENT|BRN|WTI|CL|NG)/.test(s)) return 2;
  if (/^[A-Z]{6,7}$/.test(s) || /^[A-Z]{3}\/?[A-Z]{3}$/.test(s)) return s.includes('JPY') ? 3 : 5;
  return 2;
}

export function priceDigits(symbol: string, metadata?: PriceMetadata, observed = 0): number {
  const explicit = metadata?.digits;
  const base = explicit !== undefined && Number.isInteger(explicit) && explicit >= 0 && explicit <= MAX_DIGITS ? explicit : fallbackDigits(symbol);
  return Math.min(MAX_DIGITS, Math.max(base, metadata?.pipSize && metadata.pipSize > 0 ? decimalPlaces(metadata.pipSize) : 0, Number.isFinite(observed) ? observed : 0));
}

// Keep the greatest precision observed until the account changes. A trailing-zero
// quote (31.6200 -> 31.62) must not make prices or chart keyboard steps jump.
export function rememberPriceDigits(previous: Record<string, number>, ticks: { symbol: string; bid: number; ask: number }[]): Record<string, number> {
  let next = previous;
  for (const tick of ticks) {
    if (!Number.isFinite(tick.bid) || !Number.isFinite(tick.ask) || tick.bid <= 0 || tick.ask < tick.bid) continue;
    const key = tick.symbol.toUpperCase();
    const digits = Math.max(decimalPlaces(tick.bid), decimalPlaces(tick.ask));
    if (digits <= (next[key] ?? 0)) continue;
    if (next === previous) next = { ...previous };
    next[key] = digits;
  }
  return next;
}
