import { useUIStore } from "@/store/useUIStore";
import { useAccountValuation } from '@/store/useAccountValuation';
import { tradingToken, useAccountStore } from '@/store/useAccountStore';
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryApi } from '@reduxjs/toolkit/query';
import { createExecutionRefresh } from '@/lib/executionRefresh';
import { decimalString, engineOrder, normalizeInstruments, normalizeOrderlist, type TradeRequest } from "@/lib/contracts";
import {
  OrderlistResponseDTO,
  OrderHistoryResponseDTO,
  SymbolItem,
} from "@/types/trading";

const API_BASE_URL = "/api/trading";

const rawQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    if (typeof window !== "undefined") {
      const token = tradingToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }
    return headers;
  },
});

export const tradingApi = createApi({
  reducerPath: "tradingApi",
  baseQuery: async (args, api, extra) => {
    const generation = useAccountStore.getState().generation;
    const result = await rawQuery(args, api, extra);
    if (generation !== useAccountStore.getState().generation)
      return { error: { status: 'CUSTOM_ERROR' as const, error: 'Account changed. The previous response was discarded.' } };
    if (
      result.error?.status === 401 &&
      typeof window !== "undefined" &&
      useUIStore.getState().isAuthenticated
    ) {
      // A single 401 on a background read can be transient: confirm once with the account endpoint first.
      if (api.type === "query" && api.endpoint !== "getAccountDetails") {
        const check = await rawQuery("/v1/users/trading/account", { ...api, endpoint: "getAccountDetails" }, extra);
        if (generation !== useAccountStore.getState().generation)
          return { error: { status: 'CUSTOM_ERROR' as const, error: 'Account changed. The previous session check was discarded.' } };
        if (check.error?.status !== 401) return result;
      }
      const accounts = useAccountStore.getState();
      // Keep the account listed (marked expired); one-click consent is revoked. A new session
      // can only come from the client portal, so the terminal shows the session-ended screen.
      accounts.expire(accounts.activeId);
      useUIStore.getState().setOneClickTrading(false);
      useUIStore.getState().setIsAuthenticated(false);
      useUIStore.getState().setTradingAccountNo("");
      useUIStore.getState().endSession("Your trading session expired. Open the account again from your client portal to continue.");
      api.dispatch(tradingApi.util.resetApiState());
    }
    return result;
  },
  tagTypes: [
    "Account",
    "Watchlist",
    "Orders",
    "OrderHistory",
    "Profile",
  ],
  endpoints: (builder) => ({
    // Accounts. Sign-in happens only in the client portal (see lib/portalHandoff).
    getAccountDetails: builder.query({
      query: () => "/v1/users/trading/account",
      providesTags: ["Account"],
    }),

    // User Profile
    getUserProfile: builder.query({
      query: () => "/users/user-profile",
      providesTags: ["Profile"],
    }),

    // Watchlist & Instruments
    getWatchlist: builder.query<SymbolItem[], void>({
      query: () => "/v1/users/watchlist/added-stocks",
      transformResponse: normalizeInstruments,
      providesTags: ["Watchlist"],
    }),
    getAllStocks: builder.query<SymbolItem[], void>({
      query: () => "/v1/users/watchlist/all-stocks",
      transformResponse: normalizeInstruments,
    }),
    addStockWatchlist: builder.mutation({
      query: (stock: { symbol: string; stockId?: number }) => ({
        url: "/v1/users/watchlist/add-stock",
        method: "POST",
        body: stock,
      }),
      invalidatesTags: ["Watchlist"],
    }),
    deleteStockWatchlist: builder.mutation({
      query: (stockId: number) => ({
        url: `/v1/users/watchlist/delete-stock/${stockId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Watchlist"],
    }),
    toggleFavoriteWatchlist: builder.mutation({
      query: (data: { symbol: string }) => ({
        url: "/v1/users/watchlist/add-favorite",
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Watchlist"],
    }),

    // Orders
    getOpenOrders: builder.query<OrderlistResponseDTO, void>({
      query: () => "/v1/users/order/orders",
      transformResponse: normalizeOrderlist,
      providesTags: ["Orders"],
      async onQueryStarted(_, { queryFulfilled }) {
        const generation = useAccountStore.getState().generation;
        try {
          const { data } = await queryFulfilled;
          const accounts = useAccountStore.getState();
          if (accounts.generation !== generation) return;
          const accountId = accounts.accounts.find(a => a.id === accounts.activeId)?.tradingAccountId;
          useAccountValuation.getState().observe(data, generation, accountId);
        } catch { /* Keep the last confirmed snapshot; the query exposes its error. */ }
      },
    }),
    getOrderHistory: builder.query<OrderHistoryResponseDTO, void>({
      query: () => "/v1/users/order/orders-history",
      providesTags: ["OrderHistory"],
    }),
    // Every order-changing call carries an Idempotency-Key, created once per confirmed action,
    // so a retried or duplicated request can be recognised instead of executed twice.
    placeOrder: builder.mutation({
      query: ({ order, idempotencyKey }: { order: TradeRequest; idempotencyKey: string }) => ({
        url: "/v1/users/order/place-order",
        method: "POST",
        body: engineOrder(order),
        headers: { "Idempotency-Key": idempotencyKey },
      }),
      transformResponse: (data: any, meta) => meta?.response?.status === 202 ? { ...data, accepted: true } : data,
      onQueryStarted: refreshAfterExecution,
    }),
    modifyOrder: builder.mutation({
      query: ({
        orderId,
        idempotencyKey,
        ...params
      }: {
        orderId: string | number;
        idempotencyKey: string;
        cancelOrder: boolean;
        sl?: number;
        tp?: number;
        limitPrice?: number;
      }) => ({
        url: `/v1/users/order/modify/${orderId}`,
        method: "PUT",
        body: {
          cancelOrder: params.cancelOrder,
          ...(params.limitPrice !== undefined && { limitPrice: decimalString(params.limitPrice) }),
          ...(params.sl !== undefined && { sl: decimalString(params.sl) }),
          ...(params.tp !== undefined && { tp: decimalString(params.tp) }),
        },
        headers: { "Idempotency-Key": idempotencyKey },
      }),
      onQueryStarted: refreshAfterExecution,
      invalidatesTags: ["OrderHistory"],
    }),
    exitOrder: builder.mutation({
      query: ({ idempotencyKey, orderId, exitLotSize }: { orderId: string | number; exitLotSize: number; idempotencyKey: string }) => ({
        url: "/v1/users/order/exit-order",
        method: "POST",
        body: { orderId: Number(orderId), exitLotSize: exitLotSize.toFixed(2) },
        headers: { "Idempotency-Key": idempotencyKey },
      }),
      onQueryStarted: refreshAfterExecution,
      invalidatesTags: ["OrderHistory"],
    }),

    // Candles follow the active account's price feed, using the mobile history contract.
    getHistoricalChart: builder.query<unknown, { symbol: string; tf: string; limit?: number; to?: number }>({
      query: ({ symbol, tf, limit = 500, to }) =>
        `/chart/history?symbol=${encodeURIComponent(symbol.toUpperCase())}&tf=${encodeURIComponent(tf)}&limit=${limit}${to ? `&to=${to}` : ''}`,
      keepUnusedDataFor: 0,
    }),
  }),
});

type Dispatch = BaseQueryApi['dispatch'];
const executionReaders = new WeakMap<Dispatch, () => void>();

/** Bypass delayed tag invalidation: an unrelated chart request must not hold up positions. */
export const refreshTradingState = () => (dispatch: Dispatch) => {
  let refresh = executionReaders.get(dispatch);
  if (!refresh) {
    refresh = createExecutionRefresh(async generation => {
      await Promise.all((['getOpenOrders', 'getAccountDetails'] as const).map(async endpoint => {
        // RTK deduplicates a force-refetch with an in-flight GET. Wait for that
        // possibly pre-order snapshot, then explicitly request a newer one.
        const running = dispatch(tradingApi.util.getRunningQueryThunk(endpoint, undefined));
        if (running) await running;
        if (generation !== useAccountStore.getState().generation) return;
        await dispatch(tradingApi.endpoints[endpoint].initiate(undefined, { subscribe: false, forceRefetch: true }));
      }));
    }, () => useAccountStore.getState().generation);
    executionReaders.set(dispatch, refresh);
  }
  refresh();
};

async function refreshAfterExecution(_: unknown, { dispatch, queryFulfilled }: { dispatch: Dispatch; queryFulfilled: PromiseLike<unknown> }) {
  const generation = useAccountStore.getState().generation;
  try { await queryFulfilled; }
  catch { /* An ambiguous transport failure still needs reconciliation, never a mutation retry. */ }
  if (generation === useAccountStore.getState().generation) dispatch(refreshTradingState());
}

export const {
  useGetAccountDetailsQuery,
  useGetUserProfileQuery,
  useGetWatchlistQuery,
  useGetAllStocksQuery,
  useAddStockWatchlistMutation,
  useDeleteStockWatchlistMutation,
  useToggleFavoriteWatchlistMutation,
  useGetOpenOrdersQuery,
  useGetOrderHistoryQuery,
  usePlaceOrderMutation,
  useModifyOrderMutation,
  useExitOrderMutation,
  useGetHistoricalChartQuery,
  useLazyGetHistoricalChartQuery,
} = tradingApi;
