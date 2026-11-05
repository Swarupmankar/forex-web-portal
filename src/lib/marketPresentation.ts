export function quoteSpread(quote?: { bid: number; ask: number }) {
  if (!quote || !Number.isFinite(quote.bid) || !Number.isFinite(quote.ask)
    || quote.bid <= 0 || quote.ask < quote.bid) return undefined;
  return quote.ask - quote.bid;
}
