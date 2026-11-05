import type { SymbolItem } from '@/types/trading';

export const WATCHLIST_CATEGORIES = ['All', 'Forex', 'Metals', 'Crypto', 'Indices', 'Energies', 'Other'] as const;
export type WatchlistCategory = typeof WATCHLIST_CATEGORIES[number];
const fiat = new Set('USD EUR GBP JPY CHF CAD AUD NZD SEK NOK DKK PLN HUF CZK TRY ZAR MXN SGD HKD CNH CNY RUB ILS INR THB KRW BRL'.split(' '));
const metals = ['XAU', 'XAG', 'XPT', 'XPD'];
const energies = ['WTI', 'BRN', 'BRENT', 'XNG', 'NGAS', 'NGC', 'USOIL', 'UKOIL', 'XTI', 'XBR'];
const indices = ['DJI', 'NDX', 'SPX', 'US30', 'US100', 'US500', 'USTEC', 'NAS100', 'SPX500', 'DJ30', 'GER40', 'GER30', 'DE40', 'DE30', 'UK100', 'FRA40', 'FR40', 'EU50', 'STOXX50', 'ESP35', 'IT40', 'JP225', 'JPN225', 'AUS200', 'HK50', 'CHINA50', 'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];
const crypto = ['BTC', 'ETH', 'SOL', 'BCH', 'XRP', 'LTC', 'BNB', 'DOGE', 'ADA', 'DOT', 'AVAX', 'TRX', 'TON', 'XLM', 'MATIC', 'SHIB'];
const key = (symbol: string) => symbol.trim().toUpperCase();

// Display classification follows the mobile MarketWatch fallback. It never changes
// broker order specifications or assumes that an instrument can be traded.
export function watchlistCategory(item: SymbolItem): WatchlistCategory {
  const symbol = key(item.symbol).replace(/[^A-Z0-9]/g, '');
  const inferred = metals.some(p => symbol.startsWith(p)) ? 'Metals'
    : energies.some(p => symbol.startsWith(p)) ? 'Energies'
    : indices.some(p => symbol.startsWith(p)) ? 'Indices'
    : crypto.some(p => symbol.startsWith(p)) ? 'Crypto'
    : fiat.has(symbol.slice(0, 3)) && fiat.has(symbol.slice(3, 6)) ? 'Forex' : 'Other';
  const listed = WATCHLIST_CATEGORIES.find(c => c.toLowerCase() === item.category?.toLowerCase());
  // Older catalogues label gold, indices and energy as Forex; the app corrects that.
  if (!listed || listed === 'All' || (listed === 'Forex' && inferred !== 'Other' && inferred !== 'Forex')) return inferred;
  return listed;
}

export function enrichWatchlist(saved: readonly SymbolItem[], catalogue: readonly SymbolItem[]): SymbolItem[] {
  const bySymbol = new Map(catalogue.map(item => [key(item.symbol), item]));
  return saved.map(item => {
    const meta = bySymbol.get(key(item.symbol));
    return { ...meta, ...item,
      category: meta?.category && meta.category !== 'All' ? meta.category : item.category,
      // Keep the watchlist row ID and favourite state; stock IDs belong to the catalogue.
      id: item.id, isFavorite: item.isFavorite === true,
    };
  });
}

export function filterWatchlist(items: readonly SymbolItem[], category: WatchlistCategory, favoritesOnly: boolean, query: string, revealSymbol?: string) {
  const search = query.trim().toLowerCase();
  const result = items.filter(item => (!favoritesOnly || item.isFavorite)
    && (category === 'All' || watchlistCategory(item) === category)
    && `${item.symbol} ${item.name}`.toLowerCase().includes(search));
  if (revealSymbol && !search && category === 'All' && !favoritesOnly) {
    const at = result.findIndex(item => key(item.symbol) === key(revealSymbol));
    if (at > 0) result.unshift(...result.splice(at, 1));
  }
  return result;
}
