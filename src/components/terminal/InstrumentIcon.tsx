const currencies = new Set(['EUR', 'USD', 'GBP', 'AUD', 'JPY']);
const assets = new Set([...currencies, 'BTC', 'ETH', 'XAU', 'XAG']);

// Decorative beside the instrument name. Percentage sizing keeps pairs in proportion
// in the watchlist, chart heading, ticket and compact position rows.
export function InstrumentIcon({ symbol }: { symbol: string }) {
  const normalized = symbol.toUpperCase().replace(/[\s/_-]/g, '');
  const base = normalized.slice(0, 3);
  const counter = normalized.slice(3, 6);
  const pair = currencies.has(base) && currencies.has(counter);
  return (
    <span aria-hidden="true" className={`instrument-icon instrument-art${pair ? ' currency-pair' : ''}`}>
      {assets.has(base) ? (
        <span className="instrument-disc base-disc">
          <img src={`/instruments/${base.toLowerCase()}.svg?v=refined`} alt="" width="40" height="40" draggable={false} />
        </span>
      ) : (
        <span className="instrument-monogram">{base.slice(0, 2) || '—'}</span>
      )}
      {pair && (
        <span className="instrument-disc counter-disc">
          <img src={`/instruments/${counter.toLowerCase()}.svg?v=refined`} alt="" width="24" height="24" draggable={false} />
        </span>
      )}
    </span>
  );
}
