"use client";
import { PREVIEW_FEED, SAMPLE_QUOTES } from "@/lib/market";
import { usePracticeStore } from "@/store/usePracticeStore";
import { usePriceStore } from "@/store/usePriceStore";
import type { PriceTick } from "@/types/trading";

// The one price the account can actually trade at: the live feed's bid and ask as received
// (or the practice / preview quote). Everything that displays, validates or classifies an
// order price must use this.
export function useExecutableQuote(symbol: string): PriceTick | undefined {
  const practice = usePracticeStore((s) => s.mode === "practice");
  const practiceQuote = usePracticeStore((s) => s.quotes[symbol]);
  const live = usePriceStore((s) => s.prices[symbol]);
  if (practice) return practiceQuote;
  if (PREVIEW_FEED) return SAMPLE_QUOTES[symbol];
  return live;
}

// Same rule outside React (submit path, bulk actions), read from the current store state.
export function executableQuote(symbol: string): PriceTick | undefined {
  if (usePracticeStore.getState().mode === "practice") return usePracticeStore.getState().quotes[symbol];
  if (PREVIEW_FEED) return SAMPLE_QUOTES[symbol];
  return usePriceStore.getState().prices[symbol];
}
