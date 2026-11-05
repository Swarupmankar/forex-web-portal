/** Presentation only: this registry never changes the broker's tradable catalogue. */
export const CURRENCY_FLAGS: Readonly<Record<string, string>> = {
  USD: 'us', EUR: 'eu', GBP: 'gb', JPY: 'jp', CHF: 'ch', CAD: 'ca', AUD: 'au', NZD: 'nz',
};
export const CRYPTO_CODES = ['BTC', 'ETH', 'SOL', 'BCH', 'XRP', 'LTC', 'BNB'] as const;
export const OBJECT_ARTWORK: Readonly<Record<string, string>> = {
  XAU: 'gold', XAG: 'silver', XPT: 'platinum', WTI: 'oil', BRN: 'brent', XNG: 'gas',
  DJI: 'index', NDX: 'index', SPX: 'index',
};

const ALIASES: Readonly<Record<string, string>> = {
  US30: 'DJI', DJ30: 'DJI', DOW30: 'DJI',
  US100: 'NDX', NAS100: 'NDX', USTEC: 'NDX',
  US500: 'SPX', SPX500: 'SPX',
  USOIL: 'WTI', XTI: 'WTI', UKOIL: 'BRN', BRENT: 'BRN', XBR: 'BRN',
  NGAS: 'XNG', NATGAS: 'XNG',
};
const KNOWN = new Set([...Object.keys(CURRENCY_FLAGS), ...CRYPTO_CODES, ...Object.keys(OBJECT_ARTWORK)]);
const PREFIXES = [...KNOWN, ...Object.keys(ALIASES)].sort((a, b) => b.length - a.length);
const QUOTES = Object.keys(CURRENCY_FLAGS).sort((a, b) => b.length - a.length);
const clean = (value?: string | null) => String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const canonical = (value: string) => ALIASES[value] ?? value;

export type ArtworkLegs = { base: string; quote?: string };
export type ArtworkMetadata = { base?: string | null; quote?: string | null };

/** Prefer broker metadata; parse known prefixes only when that metadata is absent. */
export function artworkLegs(symbol: string, metadata?: ArtworkMetadata): ArtworkLegs {
  const text = clean(symbol);
  const prefix = PREFIXES.find(code => text.startsWith(code));
  const tail = prefix ? text.slice(prefix.length) : '';
  const inferredQuote = QUOTES.find(code => tail.startsWith(code));
  const base = clean(metadata?.base);
  const quote = clean(metadata?.quote);
  // A supplied base is authoritative, including bases we do not have artwork for.
  // Do not attach an inferred quote from an unrelated symbol in that case.
  if (base) return { base: canonical(base), quote: quote || undefined };
  if (prefix) return { base: canonical(prefix), quote: quote || inferredQuote };
  return { base: text || '?', quote: quote || undefined };
}

export function artworkKind(code: string): 'flag' | 'crypto' | 'object' | 'text' {
  if (CURRENCY_FLAGS[code]) return 'flag';
  if ((CRYPTO_CODES as readonly string[]).includes(code)) return 'crypto';
  if (OBJECT_ARTWORK[code]) return 'object';
  return 'text';
}

/** Local artwork copied from XpertTrader; unknown instruments retain a text fallback. */
export function artworkPath(code: string): string | undefined {
  if (CURRENCY_FLAGS[code]) return `/instruments/app/flags/${CURRENCY_FLAGS[code]}.svg`;
  if ((CRYPTO_CODES as readonly string[]).includes(code)) return `/instruments/app/crypto/${code.toLowerCase()}.svg`;
  const object = OBJECT_ARTWORK[code];
  if (object === 'index') return `/instruments/app/index/${code.toLowerCase()}.svg`;
  return object ? `/instruments/app/objects/${object}.png` : undefined;
}
