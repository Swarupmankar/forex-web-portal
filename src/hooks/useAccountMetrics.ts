"use client";
import { useEffect } from "react";
import { useGetAccountDetailsQuery, useGetOpenOrdersQuery } from "@/store/api/tradingApi";
import { usePracticeStore } from "@/store/usePracticeStore";
import { useUIStore } from "@/store/useUIStore";
import { useAccountStore } from "@/store/useAccountStore";
import { practiceMetrics } from "@/lib/practice";
import { accountFigures, conversionSymbols } from "@/lib/positionPnl";
import { usePriceStore } from "@/store/usePriceStore";
import { subscribeSymbol, unsubscribeSymbol } from "@/services/priceSocket";

const value = (v: unknown) =>
  v === undefined || v === null || v === "" ? undefined : Number.isFinite(Number(v)) ? Number(v) : undefined;

export type AccountMetrics = {
  balance?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
  marginLevel?: number;
  loading: boolean;
  error: boolean;
  refetch: () => void;
};

// Account figures for the header and footer only, so per-tick practice updates re-render those
// two components instead of the whole terminal. Polling pauses while the tab is hidden.
export function useAccountMetrics({ syncAccount = false } = {}): AccountMetrics {
  const practice = usePracticeStore((s) => s.mode === "practice");
  const paper = usePracticeStore((s) => s.account);
  const quotes = usePracticeStore((s) => s.quotes);
  const authenticated = useUIStore((s) => s.isAuthenticated);
  const activeId = useAccountStore((s) => s.activeId);
  const skip = practice || !authenticated;
  const account = useGetAccountDetailsQuery(undefined, {
    skip,
    pollingInterval: 15000,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const orders = useGetOpenOrdersQuery(undefined, {
    skip,
    pollingInterval: 5000,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const data = account.currentData?.account ?? account.currentData;
  const prices = usePriceStore((s) => s.prices);
  useEffect(() => {
    if (syncAccount && !practice && data && activeId && authenticated) useAccountStore.getState().update(activeId, data);
  }, [syncAccount, data, practice, activeId, authenticated]);
  // Open positions are valued from live quotes, so their symbols and USD conversion pairs stay
  // subscribed even when no watchlist row or chart shows them. Owned by the footer instance.
  const open = orders.data?.openOrders;
  const feedSymbols = syncAccount && !skip && open?.length
    ? [...new Set([...open.map((o) => o.symbol), ...conversionSymbols(open)])].sort().join(",")
    : "";
  useEffect(() => {
    const symbols = feedSymbols.split(",").filter(Boolean);
    symbols.forEach(subscribeSymbol);
    return () => symbols.forEach(unsubscribeSymbol);
  }, [feedSymbols]);
  if (practice) {
    const m = practiceMetrics(paper, quotes);
    return { ...m, loading: false, error: false, refetch: () => {} };
  }
  const m = accountFigures(orders.data, orders.data?.balance ?? data?.fundsAvailable, prices);
  return {
    balance: value(m.balance),
    equity: value(m.equity),
    margin: value(m.margin),
    freeMargin: value(m.freeMargin),
    marginLevel: value(m.marginLevel),
    loading: account.isFetching,
    error: account.isError,
    refetch: () => void account.refetch(),
  };
}
