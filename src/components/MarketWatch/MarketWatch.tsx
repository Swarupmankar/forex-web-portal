'use client';

import React, { useState, useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { usePriceStore } from '@/store/usePriceStore';
import { CategoryType, SymbolItem } from '@/types/trading';
import { subscribeSymbol } from '@/services/priceSocket';
import { 
  useGetWatchlistQuery, 
  useGetAllStocksQuery, 
  useAddStockWatchlistMutation, 
  useDeleteStockWatchlistMutation,
  useToggleFavoriteWatchlistMutation,
  useGetUserProfileQuery,
  useGetAccountDetailsQuery
} from '@/store/api/tradingApi';
import { 
  Search, 
  Star, 
  Flame, 
  Plus, 
  Trash2, 
  Loader2, 
  Check, 
  Eye, 
  User, 
  ArrowLeft, 
  ShieldCheck, 
  Mail, 
  Layers, 
  DollarSign, 
  Cpu, 
  LogOut, 
  KeyRound,
  ListFilter
} from 'lucide-react';

const PUBLIC_SYMBOLS: SymbolItem[] = [
  { id: '1', symbol: 'XAUUSD', name: 'Gold vs US Dollar', category: 'Metals', spreadPips: 26, isFavorite: true },
  { id: '2', symbol: 'BTCUSD', name: 'Bitcoin vs USD', category: 'Crypto', spreadPips: 659, isFavorite: true },
  { id: '3', symbol: 'ETHUSD', name: 'Ethereum vs USD', category: 'Crypto', spreadPips: 67, isFavorite: true },
  { id: '4', symbol: 'GBPUSD', name: 'Great Britain Pound vs USD', category: 'Forex', spreadPips: 13, isFavorite: false },
  { id: '5', symbol: 'EURUSD', name: 'Euro vs US Dollar', category: 'Forex', spreadPips: 11, isFavorite: false },
  { id: '6', symbol: 'USDJPY', name: 'US Dollar vs Japanese Yen', category: 'Forex', spreadPips: 14, isFavorite: false },
];

export const MarketWatch: React.FC = () => {
  const { 
    activeSymbol, 
    setActiveSymbol, 
    selectedCategory, 
    setSelectedCategory, 
    searchQuery, 
    setSearchQuery,
    sidebarTab,
    setSidebarTab,
    isAuthenticated,
    setIsAuthenticated,
    tradingAccountNo,
    setTradingAccountNo,
    setLoginModalOpen
  } = useUIStore();

  const prices = usePriceStore((state) => state.prices);
  const [addSearchQuery, setAddSearchQuery] = useState('');

  // Queries
  const { data: watchlistData, isLoading: isLoadingWl } = useGetWatchlistQuery(undefined, {
    skip: !isAuthenticated,
    pollingInterval: 8000,
  });

  const { data: allStocksData, isLoading: isLoadingAll } = useGetAllStocksQuery(undefined, {
    skip: sidebarTab !== 'add-symbols',
  });

  const { data: profileData } = useGetUserProfileQuery(undefined, {
    skip: !isAuthenticated || sidebarTab !== 'profile',
  });

  const { data: accountData } = useGetAccountDetailsQuery(undefined, {
    skip: !isAuthenticated || sidebarTab !== 'profile',
  });

  // Mutations
  const [addStock, { isLoading: isAdding }] = useAddStockWatchlistMutation();
  const [deleteStock] = useDeleteStockWatchlistMutation();
  const [toggleFavorite] = useToggleFavoriteWatchlistMutation();

  // Format backend watchlist items
  const userWatchlist: SymbolItem[] = isAuthenticated && Array.isArray(watchlistData)
    ? watchlistData.map((item: any) => ({
        id: item.id,
        stockId: item.id,
        symbol: item.symbol,
        name: item.currencyGroup ? `${item.currencyBase || item.symbol}/${item.currencyQuote || 'USD'}` : item.symbol,
        category: (item.currencyGroup || (item.symbol?.includes('USD') ? 'Forex' : 'Crypto')) as CategoryType,
        spreadPips: item.spreadPips ? Number(item.spreadPips) : 15,
        isFavorite: Boolean(item.isFavorite),
      }))
    : [];

  const displayList: SymbolItem[] = isAuthenticated ? userWatchlist : PUBLIC_SYMBOLS;

  // Auto subscribe price sockets for visible symbols
  useEffect(() => {
    displayList.forEach((item) => {
      subscribeSymbol(item.symbol);
    });
  }, [displayList]);

  const categories: CategoryType[] = ['Popular', 'Forex', 'Crypto', 'Metals', 'All'];

  const filteredSymbols = displayList.filter((item) => {
    const matchesCategory =
      selectedCategory === 'Popular'
        ? item.isFavorite || ['XAUUSD', 'BTCUSD', 'ETHUSD'].includes(item.symbol)
        : selectedCategory === 'All' || item.category === selectedCategory;

    const matchesSearch =
      item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const handleToggleFav = async (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }
    try {
      await toggleFavorite({ symbol }).unwrap();
    } catch (err: any) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleDeleteStock = async (e: React.MouseEvent, stockId: number | string) => {
    e.stopPropagation();
    if (typeof stockId !== 'number') return;
    try {
      await deleteStock(stockId).unwrap();
    } catch (err: any) {
      console.error('Failed to delete stock from watchlist:', err);
    }
  };

  const handleAddStock = async (symbol: string) => {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }
    try {
      await addStock({ symbol }).unwrap();
    } catch (err: any) {
      alert(err?.data?.message || err?.message || 'Failed to add symbol to watchlist');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('trading_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('trading_account_no');
    setIsAuthenticated(false);
    setTradingAccountNo('');
    setSidebarTab('watchlist');
  };

  const addedSymbolSet = new Set(userWatchlist.map((w) => w.symbol.toUpperCase()));

  return (
    <aside className="w-[280px] h-full bg-[var(--mm-surface)] border-r border-[var(--mm-hairline)] flex flex-col select-none relative">
      {/* Sidebar Header Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[var(--mm-hairline)] bg-[var(--mm-surface-2)] p-1.5 shrink-0">
        <button
          onClick={() => setSidebarTab('watchlist')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            sidebarTab === 'watchlist'
              ? 'bg-[var(--mm-surface)] text-[var(--mm-accent)] border border-[var(--mm-hairline)] shadow-sm'
              : 'text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Watchlist</span>
        </button>

        <button
          onClick={() => setSidebarTab('add-symbols')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            sidebarTab === 'add-symbols'
              ? 'bg-[var(--mm-surface)] text-[var(--mm-accent)] border border-[var(--mm-hairline)] shadow-sm'
              : 'text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>

        <button
          onClick={() => setSidebarTab('profile')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            sidebarTab === 'profile'
              ? 'bg-[var(--mm-surface)] text-[var(--mm-accent)] border border-[var(--mm-hairline)] shadow-sm'
              : 'text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)]'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Profile</span>
        </button>
      </div>

      {/* VIEW 1: WATCHLIST */}
      {sidebarTab === 'watchlist' && (
        <>
          {/* Category selector & Search bar */}
          <div className="p-3 border-b border-[var(--mm-hairline)] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--mm-ink)]">
                <ListFilter className="w-3.5 h-3.5 text-amber-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as CategoryType)}
                  className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer text-[var(--mm-ink)]"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-[var(--mm-surface-2)] text-[var(--mm-ink)]">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-[10px] font-semibold text-[var(--mm-ink-3)] bg-[var(--mm-surface-2)] px-1.5 py-0.5 rounded">
                {filteredSymbols.length} instruments
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mm-ink-3)]" />
              <input
                type="text"
                placeholder="Search symbols..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] text-xs rounded-lg pl-8 pr-3 py-1.5 text-[var(--mm-ink)] placeholder-[var(--mm-ink-3)] focus:outline-none focus:border-[var(--mm-accent)] transition-colors"
              />
            </div>
          </div>

          {/* Symbol List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--mm-hairline)] no-scrollbar">
            {isLoadingWl && isAuthenticated ? (
              <div className="p-8 text-center text-xs text-[var(--mm-ink-3)] flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--mm-accent)]" />
                <span>Syncing live watchlist...</span>
              </div>
            ) : filteredSymbols.length > 0 ? (
              filteredSymbols.map((item) => {
                const isActive = activeSymbol === item.symbol;
                const tick = prices[item.symbol];
                const bidPrice = tick ? tick.bid : 0;
                const changePercent = tick?.change24h ?? 0;
                const isUp = changePercent >= 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveSymbol(item.symbol)}
                    className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors group ${
                      isActive
                        ? 'bg-[var(--mm-surface-2)] border-l-2 border-l-[var(--mm-accent)]'
                        : 'hover:bg-[var(--mm-surface-2)]/50'
                    }`}
                  >
                    {/* Symbol Info */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-[var(--mm-hairline)] flex items-center justify-center font-bold text-[10px] text-amber-300 shrink-0">
                        {item.symbol.substring(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-xs text-[var(--mm-ink)] truncate">{item.symbol}</span>
                        </div>
                        <div className="text-[10px] text-[var(--mm-ink-3)] truncate">{item.name}</div>
                      </div>
                    </div>

                    {/* Price & Change */}
                    <div className="text-right shrink-0 flex items-center gap-1.5">
                      <div>
                        <div
                          className={`font-mono text-xs font-bold transition-all px-1 py-0.5 rounded ${
                            tick?.direction === 'up'
                              ? 'text-emerald-400 bg-emerald-500/10 animate-flash-green'
                              : tick?.direction === 'down'
                              ? 'text-rose-400 bg-rose-500/10 animate-flash-red'
                              : 'text-[var(--mm-ink)]'
                          }`}
                        >
                          {bidPrice ? bidPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                        </div>
                        <div className={`text-[10px] font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isUp ? '+' : ''}
                          {changePercent.toFixed(2)}%
                        </div>
                      </div>

                      {/* Actions: Favorite & Delete */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => handleToggleFav(e, item.symbol)}
                          className={`p-1 rounded hover:bg-[var(--mm-hairline)] transition-colors ${
                            item.isFavorite ? 'text-amber-400' : 'text-[var(--mm-ink-3)] opacity-40 group-hover:opacity-100'
                          }`}
                          title={item.isFavorite ? 'Remove Favorite' : 'Add Favorite'}
                        >
                          <Star className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-amber-400' : ''}`} />
                        </button>

                        {isAuthenticated && typeof item.id === 'number' && (
                          <button
                            onClick={(e) => handleDeleteStock(e, item.id)}
                            className="p-1 rounded text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove from Watchlist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-[var(--mm-ink-3)] flex flex-col items-center gap-3">
                <Eye className="w-8 h-8 text-[var(--mm-ink-3)]/50" />
                <span>No symbols in your watchlist</span>
                <button
                  onClick={() => setSidebarTab('add-symbols')}
                  className="px-3 py-1.5 rounded-lg bg-[var(--mm-accent)] text-black font-bold text-xs flex items-center gap-1 shadow-md hover:brightness-110 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Symbols
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW 2: ADD SYMBOLS (INLINE SIDEBAR) */}
      {sidebarTab === 'add-symbols' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[var(--mm-surface)]">
          {/* Header */}
          <div className="p-3 border-b border-[var(--mm-hairline)] space-y-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSidebarTab('watchlist')}
                className="text-xs font-bold text-[var(--mm-accent)] flex items-center gap-1 hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Watchlist
              </button>
            </div>
            <h3 className="text-xs font-bold text-[var(--mm-ink)] flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-[var(--mm-accent)]" /> Add Instrument to Watchlist
            </h3>

            {/* Search Input */}
            <div className="relative pt-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mm-ink-3)]" />
              <input
                type="text"
                placeholder="Search symbol (BTC, Gold, EUR)..."
                value={addSearchQuery}
                onChange={(e) => setAddSearchQuery(e.target.value)}
                className="w-full bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] text-xs rounded-lg pl-8 pr-3 py-1.5 text-[var(--mm-ink)] placeholder-[var(--mm-ink-3)] focus:outline-none focus:border-[var(--mm-accent)]"
              />
            </div>
          </div>

          {/* Instruments List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--mm-hairline)] no-scrollbar">
            {isLoadingAll ? (
              <div className="p-8 text-center text-xs text-[var(--mm-ink-3)] flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--mm-accent)]" />
                <span>Loading available symbols...</span>
              </div>
            ) : Array.isArray(allStocksData) && allStocksData.length > 0 ? (
              allStocksData
                .filter((st: any) =>
                  (st.symbol || '').toLowerCase().includes(addSearchQuery.toLowerCase()) ||
                  (st.description || st.name || '').toLowerCase().includes(addSearchQuery.toLowerCase())
                )
                .map((st: any) => {
                  const symbolClean = (st.symbol || '').toUpperCase();
                  const isAdded = addedSymbolSet.has(symbolClean);

                  return (
                    <div key={st.symbol} className="p-2.5 flex items-center justify-between hover:bg-[var(--mm-surface-2)]/60 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-[var(--mm-hairline)] font-bold text-[10px] text-amber-300 flex items-center justify-center shrink-0">
                          {symbolClean.substring(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-[var(--mm-ink)] truncate">{symbolClean}</div>
                          <div className="text-[10px] text-[var(--mm-ink-3)] truncate">
                            {st.description || st.name || st.currencyGroup || 'Instrument'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => handleToggleFav(e, symbolClean)}
                          className="p-1 rounded text-[var(--mm-ink-3)] hover:text-amber-400 transition-colors"
                          title="Favorite"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>

                        {isAdded ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Added
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddStock(symbolClean)}
                            disabled={isAdding}
                            className="px-2.5 py-1 rounded bg-[var(--mm-accent)] text-black hover:brightness-110 font-bold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="p-8 text-center text-xs text-[var(--mm-ink-3)]">No matching symbols found</div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: PROFILE (INLINE SIDEBAR) */}
      {sidebarTab === 'profile' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[var(--mm-surface)] p-3 overflow-y-auto no-scrollbar space-y-3.5">
          {/* Back Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[var(--mm-hairline)]">
            <button
              onClick={() => setSidebarTab('watchlist')}
              className="text-xs font-bold text-[var(--mm-accent)] flex items-center gap-1 hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Watchlist
            </button>
            <span className="text-xs font-bold text-[var(--mm-ink)]">Trader Profile</span>
          </div>

          {isAuthenticated ? (
            <>
              {/* Profile Card Header */}
              <div className="p-3 bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--mm-accent)] to-emerald-400 text-black font-extrabold text-lg flex items-center justify-center shadow-md shrink-0">
                  {accountData?.nickname?.[0] || profileData?.firstName?.[0] || 'T'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-xs font-bold text-[var(--mm-ink)] truncate">
                      {accountData?.nickname || (profileData?.firstName ? `${profileData.firstName} ${profileData.lastName || ''}` : 'Authenticated Trader')}
                    </h3>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                      (accountData?.accountType || '').toUpperCase() === 'REAL'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {accountData?.accountType || (accountData?.isDemo ? 'DEMO' : 'REAL')}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--mm-ink-2)] truncate flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3 text-[var(--mm-accent)] shrink-0" />
                    <span className="truncate">{profileData?.email || 'Connected Trading Session'}</span>
                  </p>
                </div>
              </div>

              {/* Account Metadata Details */}
              <div className="space-y-2">
                <div className="p-2.5 bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] rounded-xl">
                  <span className="text-[9px] font-bold text-[var(--mm-ink-3)] uppercase tracking-wider block mb-0.5">
                    Trading Account ID
                  </span>
                  <span className="text-xs font-mono font-bold text-[var(--mm-ink)] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--mm-accent)]" /> #{accountData?.tradingUsername || accountData?.accountNumber || tradingAccountNo || 'Connected'}
                  </span>
                </div>

                <div className="p-2.5 bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] rounded-xl">
                  <span className="text-[9px] font-bold text-[var(--mm-ink-3)] uppercase tracking-wider block mb-0.5">
                    Account Leverage
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" /> 1:{accountData?.leverage || 500}
                  </span>
                </div>

                <div className="p-2.5 bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] rounded-xl">
                  <span className="text-[9px] font-bold text-[var(--mm-ink-3)] uppercase tracking-wider block mb-0.5">
                    Base Currency
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> {accountData?.baseCurrency || accountData?.currency || 'USD'}
                  </span>
                </div>

                <div className="p-2.5 bg-[var(--mm-surface-2)] border border-[var(--mm-hairline)] rounded-xl">
                  <span className="text-[9px] font-bold text-[var(--mm-ink-3)] uppercase tracking-wider block mb-0.5">
                    Execution Server
                  </span>
                  <span className="text-xs font-mono font-bold text-[var(--mm-ink)] flex items-center gap-1 truncate">
                    <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate">{accountData?.serverName || accountData?.server || 'Live Execution Server'}</span>
                  </span>
                </div>
              </div>

              {/* Logout CTA */}
              <div className="pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Disconnect Account
                </button>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-xs text-[var(--mm-ink-2)] flex flex-col items-center gap-3 my-auto">
              <ShieldCheck className="w-10 h-10 text-[var(--mm-accent)]" />
              <div className="font-bold text-sm text-[var(--mm-ink)]">Not Logged In</div>
              <p className="text-[11px] text-[var(--mm-ink-3)]">
                Connect your live or demo trading account to access your account profile, balance, and server metrics.
              </p>
              <button
                onClick={() => setLoginModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-[var(--mm-accent)] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 transition-all cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" /> Login Trading Account
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
