"use client";
import { useShallow } from "zustand/react/shallow";
import { usePracticeStore } from "@/store/usePracticeStore";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Star,
  Plus,
  ArrowUpRight,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
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
import {
  INSTRUMENTS,
  SAMPLE_QUOTES,
  PREVIEW_FEED,
  formatPrice,
  errorMessage,
} from "@/lib/market";
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
}: {
  item: SymbolItem;
  preview: boolean;
  selected: boolean;
  onSelect: () => void;
  onFavorite: () => void;
  onAdd?: () => void;
  onRemove?: () => void;
  adding?: boolean;
}) {
  const live = usePriceStore((s) => s.prices[item.symbol]);
  const practice=usePracticeStore(s=>s.mode === "practice");
  const demoTick=usePracticeStore(s=>s.quotes[item.symbol]);
  const tick = practice ? demoTick : preview ? SAMPLE_QUOTES[item.symbol] : live;
  return (
    <div className={`market-row ${selected ? "selected" : ""}`}>
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
          <strong>{formatPrice(tick?.bid, item.symbol)}</strong>
          <small
            className={
              tick?.change24h === undefined
                ? "muted"
                : tick.change24h >= 0
                  ? "positive"
                  : "negative"
            }
          >
            {tick?.change24h === undefined
              ? "Bid"
              : `${tick.change24h >= 0 ? "+" : ""}${tick.change24h.toFixed(2)}%`}
          </small>
        </span>
      </button>
      {onRemove ? (
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
          onClick={onFavorite}
        >
          <Star />
        </button>
      )}
    </div>
  );
}
export function MarketWatch() {
  const practice=usePracticeStore(s=>s.mode === "practice");
  const u = useUIStore(useShallow(s => ({ isAuthenticated:s.isAuthenticated, sidebarTab:s.sidebarTab, setSidebarTab:s.setSidebarTab, searchQuery:s.searchQuery, setSearchQuery:s.setSearchQuery, activeSymbol:s.activeSymbol, setActiveSymbol:s.setActiveSymbol })));
  const w = useWorkspaceStore(useShallow(s => ({ notify:s.notify, setPanel:s.setPanel })));
  const [category, setCategory] = useState("All");
  const [managing, setManaging] = useState(false);
  const [remove, { isLoading: removing }] = useDeleteStockWatchlistMutation();
  const [localFavorites, setLocalFavorites] = useState([
    "XAUUSD",
    "EURUSD",
    "BTCUSD",
  ]);
  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("mm-terminal-favorites") || "null",
      );
      if (Array.isArray(stored) && stored.every((x) => typeof x === "string"))
        setLocalFavorites(stored);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        "mm-terminal-favorites",
        JSON.stringify(localFavorites),
      );
    } catch {}
  }, [localFavorites]);
  const watch = useGetWatchlistQuery(undefined, { skip: !(u.isAuthenticated && !practice) });
  const all = useGetAllStocksQuery(undefined, {
    skip: !(u.isAuthenticated && !practice) || u.sidebarTab !== "add-symbols",
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
  const items = useMemo(
    () =>
      (u.isAuthenticated && !practice)
        ? extract(u.sidebarTab === "add-symbols" ? all.data : watch.data)
        : INSTRUMENTS.map((i) => ({
            ...i,
            isFavorite: localFavorites.includes(i.symbol),
          })),
    [(u.isAuthenticated && !practice), u.sidebarTab, all.data, watch.data, localFavorites],
  );
  const subscriptionKey = items
    .map((i) => i.symbol)
    .sort()
    .join(",");
  useEffect(() => {
    if (preview) return;
    const symbols = subscriptionKey.split(",").filter(Boolean);
    symbols.forEach(subscribeSymbol);
    return () => symbols.forEach(unsubscribeSymbol);
  }, [subscriptionKey, preview]);
  const filtered = items.filter(
    (i) =>
      (category === "All" ||
        (category === "Favorites" && i.isFavorite) ||
        i.category?.toLowerCase() === category.toLowerCase()) &&
      `${i.symbol} ${i.name}`
        .toLowerCase()
        .includes(u.searchQuery.toLowerCase()),
  );
  const current = u.sidebarTab === "add-symbols" ? all : watch;
  async function favorite(item: SymbolItem) {
    if (!(u.isAuthenticated && !practice)) {
      setLocalFavorites((s) =>
        s.includes(item.symbol)
          ? s.filter((x) => x !== item.symbol)
          : [...s, item.symbol],
      );
      return;
    }
    try {
      await toggle({ symbol: item.symbol }).unwrap();
    } catch (e) {
      w.notify(errorMessage(e, "Could not update favorite. Please try again."), "error");
    }
  }
  return (
    <aside className="markets-panel panel">
      <div className="panel-heading">
        <div>

          <h2>
            Watchlist <span className="count">{items.length}</span>
          </h2>
        </div>
        <div style={{ display: "flex" }}>
          {(u.isAuthenticated && !practice) && u.sidebarTab === "watchlist" && (
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
              u.sidebarTab === "add-symbols"
                ? "Show watchlist"
                : "Browse instruments"
            }
            onClick={() => {
              u.setSidebarTab(
                u.sidebarTab === "add-symbols" ? "watchlist" : "add-symbols",
              );
              setCategory("All");
              u.setSearchQuery("");
            }}
          >
            {u.sidebarTab === "add-symbols" ? <ChevronRight /> : <Plus />}
          </button>
        </div>
      </div>
      <div className="market-search-wrap">
        <Search />
        <input
          id="market-search"
          type="search"
          aria-label="Search instruments"
          placeholder="Search markets"
          value={u.searchQuery}
          onChange={(e) => u.setSearchQuery(e.target.value)}
        />
        <kbd>/</kbd>
      </div>
      <div className="market-filters" aria-label="Filter instruments">
        {["All", "Favorites", "Forex", "Metals", "Crypto", "Indices"].map(
          (c) => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c === "Favorites" ? <Star aria-label="Favorites" /> : c}
            </button>
          ),
        )}
      </div>
      <div className="market-columns">
        <span>
          {u.sidebarTab === "add-symbols"
            ? "Explore instruments"
            : "Instrument"}
        </span>
        <span>{preview ? practice ? "Practice bid" : "Illustrative bid" : "Bid price"}</span>
      </div>
      <div className="market-list">
        {current.isFetching && (u.isAuthenticated && !practice) && !items.length ? (
          <div className="empty-state">
            <RefreshCw className="spin" />
            <p>Loading instruments…</p>
          </div>
        ) : current.isError && (u.isAuthenticated && !practice) ? (
          <div className="empty-state">
            <p>Markets couldn’t be loaded.</p>
            <button className="text-button" onClick={() => current.refetch()}>
              Try again
            </button>
          </div>
        ) : filtered.length ? (
          filtered.map((item) => (
            <MarketRow
              key={item.symbol}
              item={item}
              preview={preview}
              selected={u.activeSymbol === item.symbol}
              onSelect={() => {
                u.setActiveSymbol(item.symbol);
                w.setPanel("chart");
              }}
              onFavorite={() => favorite(item)}
              adding={adding || removing}
              onRemove={
                managing &&
                (u.isAuthenticated && !practice) &&
                u.sidebarTab === "watchlist" &&
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
                u.sidebarTab === "add-symbols" &&
                !extract(watch.data).some((s) => s.symbol === item.symbol)
                  ? async () => {
                      try {
                        await add({
                          symbol: item.symbol,
                          stockId:
                            item.stockId ??
                            (typeof item.id === "number" ? item.id : undefined),
                        }).unwrap();
                        w.notify(`${item.symbol} added to watchlist.`);
                      } catch (e) {
                        w.notify(errorMessage(e, "Could not add instrument."), "error");
                      }
                    }
                  : undefined
              }
            />
          ))
        ) : (
          <div className="empty-state">
            <Search />
            <strong>No instruments found</strong>
            <p>Try a symbol or choose another category.</p>
            <button
              className="text-button"
              onClick={() => {
                u.setSearchQuery("");
                setCategory("All");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
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
