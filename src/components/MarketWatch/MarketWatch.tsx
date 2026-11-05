"use client";
import { composeOrder, inspectInstrument, viewInstrument } from '@/lib/tradingWorkflow';
import {useAccountStore} from '@/store/useAccountStore';
import {enrichWatchlist,filterWatchlist,watchlistCategory,WATCHLIST_CATEGORIES,type WatchlistCategory} from '@/lib/watchlistView';
import { quoteSpread } from '@/lib/marketPresentation';
import { useMarketDisplay } from '@/hooks/useMarketDisplay';
import { useShallow } from "zustand/react/shallow";
import { usePracticeStore } from "@/store/usePracticeStore";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Search,
  Star,
  Plus,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  Check,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { usePriceStore } from "@/store/usePriceStore";
import {
  useGetWatchlistQuery,
  useGetAllStocksQuery,
  useAddStockWatchlistMutation,
  useToggleFavoriteWatchlistMutation,
  useDeleteStockWatchlistMutation,
} from "@/store/api/tradingApi";
import { subscribeSymbol, unsubscribeSymbol } from "@/services/priceSocket";
import { INSTRUMENTS, SAMPLE_QUOTES, PREVIEW_FEED, errorMessage } from "@/lib/market";
import { InstrumentIcon } from "@/components/terminal/InstrumentIcon";
import { QUOTE_STALE_MS } from "@/lib/freshness";
import type { SymbolItem } from "@/types/trading";
function extract(data: unknown): SymbolItem[] {
  if (Array.isArray(data)) return data;
  const r = data as { stocks?: SymbolItem[]; data?: SymbolItem[] };
  return r?.stocks || r?.data || [];
}
function MarketRow({
  item,
  preview,
  selected,
  onSelect,
  onFavorite,
  onAdd,
  onRemove,
  adding,
  saved,
  revealed,
  fullPage = false,
}: {
  item: SymbolItem;
  preview: boolean;
  selected: boolean;
  onSelect: () => void;
  onFavorite: () => void;
  onAdd?: () => void;
  onRemove?: () => void;
  adding?: boolean;
  saved?: boolean;
  revealed?: boolean;
  fullPage?: boolean;
}) {
  const { formatPrice } = useMarketDisplay();
  const live = usePriceStore((s) => s.prices[item.symbol]);
  const practice=usePracticeStore(s=>s.mode === "practice");
  const demoTick=usePracticeStore(s=>s.quotes[item.symbol]);
  const tick = practice ? demoTick : preview ? SAMPLE_QUOTES[item.symbol] : live;
  if (fullPage) return <tr className={selected ? 'selected' : ''}>
    <td><button className={`row-action favorite ${item.isFavorite ? 'is-favorite' : ''}`}
      aria-label={`${item.isFavorite ? 'Unfavorite' : 'Favorite'} ${item.symbol}`}
      aria-pressed={!!item.isFavorite} disabled={adding} onClick={onFavorite}><Star /></button></td>
    <td><button className="watchlist-instrument" aria-pressed={selected} aria-label={`Inspect ${item.symbol}`} onClick={onSelect}>
      <InstrumentIcon symbol={item.symbol} /><span><strong>{item.symbol}</strong><small>{item.name || item.symbol}</small></span>
    </button></td>
    <td className="watchlist-bid">{formatPrice(tick?.bid, item.symbol)}</td>
    <td className="watchlist-ask">{formatPrice(tick?.ask, item.symbol)}</td>
    <td className="watchlist-spread">{formatPrice(quoteSpread(tick), item.symbol)}</td>
    <td><div className="watchlist-row-actions">
      <button onClick={() => composeOrder(item.symbol)} aria-label={`Trade ${item.symbol}`}>Trade</button>
      <button onClick={() => viewInstrument(item.symbol)} aria-label={`Chart for ${item.symbol}`}>Chart</button>
      {onRemove && <button className="row-action" aria-label={`Remove ${item.symbol} from watchlist`} disabled={adding} onClick={onRemove}><Trash2 /></button>}
    </div></td>
  </tr>;
  return (
    <div data-symbol={item.symbol} className={`market-row ${selected ? "selected" : ""} ${revealed ? "is-revealed" : ""}`}>
      <button
        className="market-select"
        onClick={onSelect}
        aria-label={`View ${item.symbol}`}
        aria-pressed={selected}
      >
        <InstrumentIcon symbol={item.symbol} />
        <span className="market-name">
          <strong>{item.symbol}</strong>
          <small>{item.name || item.symbol}</small>
        </span>
        <span className="market-price">
          <strong><span>Bid</span> {formatPrice(tick?.bid, item.symbol)}</strong>
          <small><span>Ask</span> {formatPrice(tick?.ask, item.symbol)}</small>
        </span>
      </button>
      {saved ? <span className="watchlist-saved" title="In your watchlist"><Check/><span className="sr-only">Added to watchlist</span></span> : onRemove ? (
        <button
          className="row-action"
          aria-label={`Remove ${item.symbol} from watchlist`}
          disabled={adding}
          onClick={onRemove}
        >
          <Trash2 />
        </button>
      ) : onAdd ? (
        <button
          className="row-action"
          aria-label={`Add ${item.symbol} to watchlist`}
          disabled={adding}
          onClick={onAdd}
        >
          <Plus />
        </button>
      ) : (
        <button
          className={`row-action favorite ${item.isFavorite ? "is-favorite" : ""}`}
          aria-label={`${item.isFavorite ? "Unfavorite" : "Favorite"} ${item.symbol}`}
          aria-pressed={!!item.isFavorite}
          disabled={adding}
          onClick={onFavorite}
        >
          <Star />
        </button>
      )}
    </div>
  );
}
export function MarketWatch({picker=false, fullPage=false, active=true}: {picker?:boolean; fullPage?:boolean; active?:boolean}) {
  const practice=usePracticeStore(s=>s.mode === "practice");
  const u = useUIStore(useShallow(s => ({ isAuthenticated:s.isAuthenticated, sidebarTab:s.sidebarTab, setSidebarTab:s.setSidebarTab, searchQuery:s.searchQuery, setSearchQuery:s.setSearchQuery, activeSymbol:s.activeSymbol, setActiveSymbol:s.setActiveSymbol })));
  const w = useWorkspaceStore(useShallow(s => ({ notify:s.notify, setPanel:s.setPanel })));
  const [pickerQuery,setPickerQuery]=useState("");
  const searchQuery=picker?pickerQuery:u.searchQuery;
  const setSearchQuery=picker?setPickerQuery:u.setSearchQuery;
  const browsing=picker;
  const [category, setCategory] = useState<WatchlistCategory>("All");
  const [favoritesOnly,setFavoritesOnly]=useState(false);
  const reveal=useWorkspaceStore(s=>s.watchlistReveal);
  const listRef=useRef<HTMLDivElement>(null);
  const revealedRevision=useRef(0);
  const [page, setPage] = useState(0);
  const favoriteInFlight = useRef(new Set<string>());
  const [favoriting, setFavoriting] = useState<string[]>([]);
  useEffect(() => { setPage(0);if(listRef.current)listRef.current.scrollTop=0; }, [category, favoritesOnly, searchQuery, browsing]);
  useEffect(()=>{if(!picker&&reveal){setCategory('All');setFavoritesOnly(false);setPage(0);setManaging(false);useUIStore.getState().setSearchQuery('');}},[picker,reveal]);
  const [managing, setManaging] = useState(false);
  const [remove, { isLoading: removing }] = useDeleteStockWatchlistMutation();
  const localFavorites=useWorkspaceStore(s=>s.practiceFavorites);
  const watch = useGetWatchlistQuery(undefined, { skip: !(u.isAuthenticated && !practice) });
  const all = useGetAllStocksQuery(undefined, {
    skip: !(u.isAuthenticated && !practice),
  });
  const [add, { isLoading: adding }] = useAddStockWatchlistMutation();
  const [toggle] = useToggleFavoriteWatchlistMutation();
  const preview = practice || PREVIEW_FEED;
  const connection = usePriceStore((s) => s.connection);
  // Re-evaluated every 5s so a silent feed turns the dot off; the boolean selector avoids a render per tick.
  const [, setClock] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const feedFresh = usePriceStore((s) => s.connection === "connected" && !!s.lastReceivedAt && Date.now() - s.lastReceivedAt < QUOTE_STALE_MS);
  const feedLive = practice || feedFresh;
  const savedItems = useMemo(() => new Map(extract(watch.data).map(item => [item.symbol.trim().toUpperCase(),item])), [watch.data]);
  const items = useMemo(
    () =>
      (u.isAuthenticated && !practice)
        ? (browsing ? extract(all.data) : enrichWatchlist(extract(watch.data),extract(all.data))).map(item => {
            const saved = savedItems.get(item.symbol.trim().toUpperCase());
            return {...item,isFavorite:saved?.isFavorite ?? false};
          })
        : INSTRUMENTS.map((i) => ({
            ...i,
            isFavorite: localFavorites.includes(i.symbol),
          })),
    [(u.isAuthenticated && !practice), browsing, all.data, watch.data, localFavorites, savedItems],
  );
  const filtered = filterWatchlist(items,category,favoritesOnly,searchQuery,picker?undefined:reveal?.symbol);
  const categoryCounts = new Map(WATCHLIST_CATEGORIES.map(c=>[c,items.filter(item=>(!favoritesOnly||item.isFavorite)&&(c==='All'||watchlistCategory(item)===c)).length]));
  const currentPage = Math.min(page,Math.max(0,Math.ceil(filtered.length/50)-1));
  const visible = filtered.slice(currentPage*50,(currentPage+1)*50);
  const visibleKey=visible.map(item=>item.symbol).join(',');
  useEffect(()=>{
    if(picker||!reveal||revealedRevision.current===reveal.revision||category!=='All'||favoritesOnly||searchQuery)return;
    const row=Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-symbol]')??[]).find(node=>node.dataset.symbol===reveal.symbol);
    if(!row)return;
    const frame=requestAnimationFrame(()=>{
      if(listRef.current)listRef.current.scrollTop=0;
      row.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
      revealedRevision.current=reveal.revision;
    });
    return ()=>cancelAnimationFrame(frame);
  },[picker,reveal,visibleKey,category,favoritesOnly,searchQuery]);
  const subscriptionKey = visible
    .map((i) => i.symbol)
    .sort()
    .join(",");
  useEffect(() => {
    if (preview || !active) return;
    const symbols = subscriptionKey.split(",").filter(Boolean);
    symbols.forEach(subscribeSymbol);
    return () => symbols.forEach(unsubscribeSymbol);
  }, [subscriptionKey, preview, active]);
  const current = browsing ? all : watch;
  async function favorite(item: SymbolItem) {
    if (!(u.isAuthenticated && !practice)) {
      const saved=useWorkspaceStore.getState();
      saved.setPracticeFavorites(saved.practiceFavorites.includes(item.symbol)?saved.practiceFavorites.filter(s=>s!==item.symbol):[...saved.practiceFavorites,item.symbol]);
      return;
    }
    if (favoriteInFlight.current.has(item.symbol)) return;
    favoriteInFlight.current.add(item.symbol);
    setFavoriting([...favoriteInFlight.current]);
    try {
      await toggle({ symbol: item.symbol }).unwrap();
    } catch (e) {
      w.notify(errorMessage(e, "Could not update favorite. Please try again."), "error");
    } finally {
      favoriteInFlight.current.delete(item.symbol);
      setFavoriting([...favoriteInFlight.current]);
    }
  }
  return (
    <aside className={`markets-panel panel ${picker ? "instrument-picker-list" : ""} ${fullPage ? 'watchlist-table-panel' : ''}`}>
      {!picker && <div className="panel-heading">
        <div>

          <h2>
            {fullPage ? 'My instruments' : browsing ? 'Instruments' : 'Watchlist'} <span className="count">{items.length}</span>
          </h2>
        </div>
        <div style={{ display: "flex" }}>
          {(u.isAuthenticated && !practice) && !browsing && (
            <button
              className="icon-button"
              aria-label="Manage watchlist"
              aria-pressed={managing}
              onClick={() => setManaging(!managing)}
            >
              <SlidersHorizontal />
            </button>
          )}
          <button
            className="icon-button"
            aria-label={
              browsing
                ? "Show watchlist"
                : "Browse instruments"
            }
            onClick={() => {
              useWorkspaceStore.getState().setInstrumentPickerOpen(true);
            }}
          >
            {browsing ? <ChevronRight /> : <Plus />}
          </button>
        </div>
      </div>}
      <div className="market-search-wrap">
        <Search />
        <input
          id={picker ? "instrument-picker-search" : "market-search"}
          type="search"
          aria-label="Search instruments"
          placeholder="Search markets"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <kbd>/</kbd>
      </div>
      <div className="market-filter-controls" aria-label="Filter instruments">
        <label className="sr-only" htmlFor={picker?'picker-category':'watchlist-category'}>Instrument category</label>
        <select id={picker?'picker-category':'watchlist-category'} aria-label="Instrument category" value={category} onChange={e=>setCategory(e.target.value as WatchlistCategory)}>
          {WATCHLIST_CATEGORIES.map(c=><option key={c} value={c}>{c==='All'?'All instruments':c} ({categoryCounts.get(c)??0})</option>)}
        </select>
        <button className="watchlist-favorites-filter" aria-label="Show favorite instruments" aria-pressed={favoritesOnly} onClick={()=>setFavoritesOnly(!favoritesOnly)}><Star/><span>Favorites</span></button>
      </div>
      {!fullPage && <div className="market-columns">
        <span>
          {browsing
            ? "Explore instruments"
            : "Instrument"}
        </span>
        <span>{preview ? practice ? "Practice quotes" : "Illustrative quotes" : "Bid / Ask"}</span>
      </div>}
      {current.isError && items.length > 0 && <button className="watchlist-retry" onClick={()=>current.refetch()}>Refresh failed. Tap to retry.</button>}
      <div className="market-list" ref={listRef}>
        {current.isFetching && (u.isAuthenticated && !practice) && !items.length ? (
          <div className="empty-state">
            <RefreshCw className="spin" />
            <p>Loading instruments…</p>
          </div>
        ) : current.isError && !items.length && (u.isAuthenticated && !practice) ? (
          <div className="empty-state">
            <p>Markets couldn’t be loaded.</p>
            <button className="text-button" onClick={() => current.refetch()}>
              Try again
            </button>
          </div>
        ) : filtered.length ? (
          <MarketRows fullPage={fullPage}>{visible.map((item) => (
            <MarketRow
              key={item.symbol}
              item={item}
              saved={picker && savedItems.has(item.symbol.trim().toUpperCase())}
              revealed={!picker && reveal?.symbol===item.symbol}
              fullPage={fullPage}
              preview={preview}
              selected={u.activeSymbol === item.symbol}
              onSelect={() => {
                if (fullPage) inspectInstrument(item.symbol);
                else viewInstrument(item.symbol);
              }}
              onFavorite={() => favorite(item)}
              adding={adding || removing || favoriting.includes(item.symbol)}
              onRemove={
                managing &&
                (u.isAuthenticated && !practice) &&
                !browsing &&
                typeof item.id === "number"
                  ? async () => {
                      try {
                        await remove(Number(item.id)).unwrap();
                        w.notify(`${item.symbol} removed from watchlist.`);
                      } catch (e) {
                        w.notify(errorMessage(e, "Could not remove instrument."), "error");
                      }
                    }
                  : undefined
              }
              onAdd={
                (u.isAuthenticated && !practice) &&
                browsing &&
                !savedItems.has(item.symbol.trim().toUpperCase())
                  ? async () => {
                      const generation=useAccountStore.getState().generation;
                      try {
                        await add({
                          symbol: item.symbol,
                          stockId:
                            item.stockId ??
                            (typeof item.id === "number" ? item.id : undefined),
                        }).unwrap();
                        if(generation!==useAccountStore.getState().generation)return;
                        // Refresh the confirmed list; never invent a saved row from the catalogue.
                        try { await watch.refetch().unwrap(); } catch { /* The list exposes a refresh/retry state. */ }
                        if(generation!==useAccountStore.getState().generation)return;
                        useUIStore.getState().setSearchQuery('');
                        useWorkspaceStore.getState().revealWatchlist(item.symbol);
                        w.notify(`${item.symbol} added to watchlist.`);
                      } catch (e) {
                        w.notify(errorMessage(e, "Could not add instrument."), "error");
                      }
                    }
                  : undefined
              }
            />
          ))}</MarketRows>
        ) : (
          <div className="empty-state">
            <Search />
            <strong>No instruments found</strong>
            <p>Try a symbol or choose another category.</p>
            <button
              className="text-button"
              onClick={() => {
                setSearchQuery("");
                setCategory("All");
                setFavoritesOnly(false);
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        {filtered.length > 50 && <div className="watchlist-pagination"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous</button><span>{currentPage*50+1}–{Math.min((currentPage+1)*50,filtered.length)} of {filtered.length}</span><button disabled={(currentPage+1)*50>=filtered.length} onClick={()=>setPage(currentPage+1)}>Next</button></div>}
      </div>
      <div className="markets-bottom">
        <div className="preview-label">
          <span className={`status-dot ${feedLive ? "connected" : ""}`} />
          {preview
            ? practice ? "Practice · simulated prices" : "Preview · illustrative quotes"
            : feedLive ? "Prices from connected feed" : connection === "connecting" ? "Reconnecting to prices…" : "Prices paused"}
        </div>
      </div>
    </aside>
  );
}

function MarketRows({ fullPage, children }: { fullPage: boolean; children: ReactNode }) {
  if (!fullPage) return <>{children}</>;
  return <table className="watchlist-table">
    <caption className="sr-only">Watchlist bid and ask prices</caption>
    <thead><tr><th scope="col"><span className="sr-only">Favorite</span></th><th scope="col">Instrument</th><th scope="col">Bid</th><th scope="col">Ask</th><th scope="col" title="Ask price minus bid price">Spread</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
    <tbody>{children}</tbody>
  </table>;
}
