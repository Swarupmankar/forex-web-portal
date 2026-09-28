"use client";
import { accountQuote } from "@/lib/contracts";
import { PREVIEW_FEED, SAMPLE_QUOTES } from "@/lib/market";
import { store } from "@/store";
import { tradingApi, useGetWatchlistQuery } from "@/store/api/tradingApi";
import { usePracticeStore } from "@/store/usePracticeStore";
import { usePriceStore } from "@/store/usePriceStore";
import { useUIStore } from "@/store/useUIStore";
import type { PriceTick } from "@/types/trading";

// The one price the account can actually trade at. Connected accounts may carry a spread
// markup (watchlist spreadPips), so the raw feed ask is never shown or checked on its own.
// Everything that displays, validates or classifies an order price must use this.
export function useExecutableQuote(symbol: string): PriceTick | undefined {
  const practice = usePracticeStore((s) => s.mode === "practice");
  const authenticated = useUIStore((s) => s.isAuthenticated);
  const practiceQuote = usePracticeStore((s) => s.quotes[symbol]);
  const live = usePriceStore((s) => s.prices[symbol]);
  const watchlist = useGetWatchlistQuery(undefined, { skip: practice || !authenticated });
  if (practice) return practiceQuote;
  if (PREVIEW_FEED) return SAMPLE_QUOTES[symbol];
  return accountQuote(live, watchlist.data?.find((i) => i.symbol === symbol));
}

// Same rule outside React (submit path, bulk actions), read from the current store state.
export function executableQuote(symbol: string): PriceTick | undefined {
  if (usePracticeStore.getState().mode === "practice") return usePracticeStore.getState().quotes[symbol];
  if (PREVIEW_FEED) return SAMPLE_QUOTES[symbol];
  const watchlist = tradingApi.endpoints.getWatchlist.select()(store.getState()).data;
  return accountQuote(usePriceStore.getState().prices[symbol], watchlist?.find((i) => i.symbol === symbol));
}
