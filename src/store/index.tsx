'use client';

import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { tradingApi } from './api/tradingApi';
import { Provider } from 'react-redux';
import { ReactNode } from 'react';

export const store = configureStore({
  reducer: {
    [tradingApi.reducerPath]: tradingApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(tradingApi.middleware),
});

setupListeners(store.dispatch);

export function StoreProvider({ children }: { children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
