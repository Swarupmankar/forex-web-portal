export type CategoryType = 'Popular' | 'Forex' | 'Crypto' | 'Metals' | 'Indices' | 'Energies' | 'All';

export interface SymbolItem {
  id: string | number;
  symbol: string;
  name: string;
  category: CategoryType;
  baseCurrency?: string;
  quoteCurrency?: string;
  digits?: number;
  pipSize?: number;
  contractSize?: number;
  minLots?: number;
  maxLots?: number;
  lotStep?: number;
  icon?: string;
  isFavorite?: boolean;
  stockId?: number;
  added?: boolean;
  isAdded?: boolean;
}

export interface PriceTick {
  symbol: string;
  bid: number;
  ask: number;
  mid?: number;
  change24h?: number;
  direction?: 'up' | 'down' | 'same';
  // Local time the quote arrived (ms). Freshness is measured from this.
  timestamp?: number | string;
  // The feed's own time for the quote (ms), when the feed sends one. Candles are bucketed by this.
  sourceTs?: number;
  // How late the quote arrived relative to the feed's clock, after removing the estimated clock offset.
  lagMs?: number;
}

export type OrderType = 'BUY' | 'SELL';
export type OrderExecutionMode = 'MARKET' | 'PENDING';
export type PendingOrderType = 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';
export type PositionStatus = 'OPEN' | 'CLOSED' | 'CANCELLED' | 'PENDING';

export interface OrderDetailsDTO {
  id?: number;
  orderId?: number;
  entryPrice?: string | number | null;
  price?: string | number | null;
  exitPrice?: string | number | null;
  entrylimit?: string | number | null;
  limitPrice?: string | number | null;
  entryExecutionType?: string;
  orderExitEntries?: { id?: number | string; exitPrice?: string | number | null; exitLotSize?: string | number; pnl?: string | number | null; swap?: string | number | null; closeReason?: string; createdAt?: string }[];
  entryLeverage?: number;
  entryBid?: string | number | null;
}

export interface Order {
  id: string | number;
  /** Lots originally requested; lotSize is what is open now ("0" while SENDING). */
  lotSizeStore?: string;
  tradingAccountId?: number;
  accountId?: number;
  symbol: string;
  orderType: OrderType | string;
  executionType?: string;
  limitPrice?: string | number;
  exitRowId?: string;
  updatedAt?: string;
  executionMode?: OrderExecutionMode | string;
  pendingType?: PendingOrderType | string;
  lotSize?: string | number;
  volume?: number; // Normalized Lot size
  contractSize?: string | number;
  currencyBase?: string;
  currencyQuote?: string;
  currency_base?: string;
  currency_quote?: string;
  entryPrice?: string | number | null;
  openPrice?: number;
  currentPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  sl?: string | number | null;
  tp?: string | number | null;
  swap?: string | number | null;
  closeReason?: string;
  commission?: number;
  marginRequired?: string | number;
  marginInUse?: string | number;
  profit?: number;
  pnl?: string | number | null;
  status?: PositionStatus | string;
  orderStatus?: string;
  createdAt?: string;
  closedAt?: string;
  orderDetails?: OrderDetailsDTO;
}

export interface OrderlistResponseDTO {
  openOrders?: Order[];
  pendingOrders?: Order[];
  balance?: string | number;
  marginUsed?: string | number;
  freeMargin?: string | number;
  marginLevel?: string | number | null;
}

export interface CompletedOrderDTO {
  accountId?: number;
  swap?: string | number | null;
  commission?: number;
  closeReason?: string;
  closedAt?: string;
  updatedAt?: string;
  id: number;
  tradingAccountId: number;
  orderType: string;
  symbol: string;
  lotSize: string | number;
  lotSizeStore?: string;
  pnl: string | number | null;
  pnlPips?: string | number | null;
  marginRequired?: string | number;
  sl: string | number | null;
  tp: string | number | null;
  orderStatus: string;
  createdAt: string;
  orderDetails?: OrderDetailsDTO;
}

export interface OrderHistoryResponseDTO {
  fullyCompletedOrders?: CompletedOrderDTO[];
  partiallyCompletedOrders?: CompletedOrderDTO[];
  cancelledOrders?: CompletedOrderDTO[];
  completedOrders?: CompletedOrderDTO[];
  transactions?: any[];
}

export interface AccountDetails {
  id: number;
  accountNumber: string;
  nickname: string;
  isDemo: boolean;
  leverage: number;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number | null;
}
