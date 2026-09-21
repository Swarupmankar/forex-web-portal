import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { OrderlistResponseDTO, OrderHistoryResponseDTO, SymbolItem } from '@/types/trading';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://aznxt-fx-ts-backend-server-1.onrender.com';

export const tradingApi = createApi({
  reducerPath: 'tradingApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('trading_token') || localStorage.getItem('access_token');
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }
      return headers;
    },
  }),
  tagTypes: ['Account', 'Watchlist', 'Orders', 'OrderHistory', 'Profile', 'Brokers', 'Servers'],
  endpoints: (builder) => ({
    // Auth & Accounts
    loginTrading: builder.mutation({
      query: (credentials: { tradingUsername: string; tradingPassword: string; brokerId: number | string; serverId: number | string }) => ({
        url: '/v1/users/trading/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Account', 'Profile', 'Orders', 'Watchlist'],
    }),
    createDemoAccount: builder.mutation({
      query: (data: { name: string; email: string; phoneNumber: string; password: string; amount?: number; nickname?: string }) => ({
        url: '/v1/users/trading/create-demo-account',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Account'],
    }),
    getAccountDetails: builder.query({
      query: () => '/v1/users/trading/account',
      providesTags: ['Account'],
    }),

    // Brokers & Servers
    getBrokers: builder.query({
      query: () => '/v1/users/auth/brokers',
      providesTags: ['Brokers'],
    }),
    getServers: builder.query({
      query: () => '/v1/users/auth/servers',
      providesTags: ['Servers'],
    }),

    // User Profile
    getUserProfile: builder.query({
      query: () => '/users/user-profile',
      providesTags: ['Profile'],
    }),

    // Watchlist & Instruments
    getWatchlist: builder.query<SymbolItem[], void>({
      query: () => '/v1/users/watchlist/added-stocks',
      providesTags: ['Watchlist'],
    }),
    getAllStocks: builder.query<SymbolItem[], void>({
      query: () => '/v1/users/watchlist/all-stocks',
    }),
    addStockWatchlist: builder.mutation({
      query: (stock: { symbol: string; stockId?: number }) => ({
        url: '/v1/users/watchlist/add-stock',
        method: 'POST',
        body: stock,
      }),
      invalidatesTags: ['Watchlist'],
    }),
    deleteStockWatchlist: builder.mutation({
      query: (stockId: number) => ({
        url: `/v1/users/watchlist/delete-stock/${stockId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Watchlist'],
    }),
    toggleFavoriteWatchlist: builder.mutation({
      query: (data: { symbol: string }) => ({
        url: '/v1/users/watchlist/add-favorite',
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Watchlist'],
    }),

    // Orders
    getOpenOrders: builder.query<OrderlistResponseDTO, void>({
      query: () => '/v1/users/order/orders',
      providesTags: ['Orders'],
    }),
    getOrderHistory: builder.query<OrderHistoryResponseDTO, void>({
      query: () => '/v1/users/order/orders-history',
      providesTags: ['OrderHistory'],
    }),
    placeOrder: builder.mutation({
      query: (orderData: {
        symbol: string;
        orderType: 'BUY' | 'SELL';
        volume: number;
        stopLoss?: number;
        takeProfit?: number;
        executionMode?: 'MARKET' | 'PENDING';
        price?: number;
      }) => ({
        url: '/v1/users/order/place-order',
        method: 'POST',
        body: orderData,
      }),
      invalidatesTags: ['Orders', 'Account'],
    }),
    modifyOrder: builder.mutation({
      query: (params: { orderId: string | number; stopLoss?: number; takeProfit?: number }) => ({
        url: '/v1/users/order/modify',
        method: 'POST',
        body: params,
      }),
      invalidatesTags: ['Orders'],
    }),
    exitOrder: builder.mutation({
      query: (params: { orderId: string | number }) => ({
        url: '/v1/users/order/exit-order',
        method: 'POST',
        body: params,
      }),
      invalidatesTags: ['Orders', 'Account', 'OrderHistory'],
    }),

    // Chart Historical
    getHistoricalChart: builder.query({
      query: ({ symbol, interval = 'daily', period = 1 }: { symbol: string; interval?: string; period?: number }) =>
        `/v1/chart/historical?symbol=${symbol.toUpperCase()}&interval=${interval}&period=${period}`,
    }),
  }),
});

export const {
  useLoginTradingMutation,
  useCreateDemoAccountMutation,
  useGetAccountDetailsQuery,
  useGetBrokersQuery,
  useGetServersQuery,
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
