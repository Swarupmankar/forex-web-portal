import { useUIStore } from "@/store/useUIStore";
import { tradingToken, useAccountStore } from '@/store/useAccountStore';
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
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
    const publicRequest = api.endpoint === 'getHistoricalChart';
    const result = await rawQuery(args, api, extra);
    if (!publicRequest && generation !== useAccountStore.getState().generation)
      return { error: { status: 'CUSTOM_ERROR' as const, error: 'Account changed. The previous response was discarded.' } };
    if (
      result.error?.status === 401 &&
      !publicRequest &&
      typeof window !== "undefined" &&
      useUIStore.getState().isAuthenticated
    ) {
      // A single 401 on a background read can be transient: confirm once with the account endpoint first.
      if (api.type === "query" && api.endpoint !== "getAccountDetails") {
        const check = await rawQuery("/v1/users/trading/account", { ...api, endpoint: "getAccountDetails" }, extra);
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
      invalidatesTags: ["Orders", "Account"],
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
      }) => ({
        url: `/v1/users/order/modify/${orderId}`,
        method: "PUT",
        body: {
          cancelOrder: params.cancelOrder,
          ...(params.sl !== undefined && { sl: decimalString(params.sl) }),
          ...(params.tp !== undefined && { tp: decimalString(params.tp) }),
        },
        headers: { "Idempotency-Key": idempotencyKey },
      }),
      invalidatesTags: ["Orders"],
    }),
    exitOrder: builder.mutation({
      query: ({ idempotencyKey, orderId, exitLotSize }: { orderId: string | number; exitLotSize: number; idempotencyKey: string }) => ({
        url: "/v1/users/order/exit-order",
        method: "POST",
        body: { orderId: Number(orderId), exitLotSize: exitLotSize.toFixed(2) },
        headers: { "Idempotency-Key": idempotencyKey },
      }),
      invalidatesTags: ["Orders", "Account", "OrderHistory"],
    }),

    // Chart Historical
    getHistoricalChart: builder.query({
      query: ({
        symbol,
        interval = "daily",
        period = 1,
      }: {
        symbol: string;
        interval?: string;
        period?: number;
      }) =>
        `/v1/chart/historical?symbol=${encodeURIComponent(symbol.toUpperCase())}&interval=${encodeURIComponent(interval)}&period=${period}`,
    }),
  }),
});

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
} = tradingApi;
