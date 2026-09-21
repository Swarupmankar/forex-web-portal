export type CategoryType = 'Popular' | 'Forex' | 'Crypto' | 'Metals' | 'Indices' | 'All';

export interface SymbolItem {
  id: string | number;
  symbol: string;
  name: string;
  category: CategoryType;
  baseCurrency?: string;
  quoteCurrency?: string;
  digits?: number;
  spreadPips?: number;
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
  spread?: number;
  change24h?: number;
  direction?: 'up' | 'down' | 'same';
  timestamp?: number | string;
}

export type OrderType = 'BUY' | 'SELL';
export type OrderExecutionMode = 'MARKET' | 'PENDING';
export type PendingOrderType = 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';
export type PositionStatus = 'OPEN' | 'CLOSED' | 'CANCELLED' | 'PENDING';

export interface OrderDetailsDTO {
  id?: number;
  orderId?: number;
  entryPrice?: string | number | null;
  exitPrice?: string | number | null;
  entrySpread?: string | number | null;
  entryLeverage?: number;
  entryBid?: string | number | null;
}

export interface Order {
  id: string | number;
  tradingAccountId?: number;
  symbol: string;
  orderType: OrderType | string;
  executionMode?: OrderExecutionMode | string;
  pendingType?: PendingOrderType | string;
  lotSize?: string | number;
  volume?: number; // Normalized Lot size
  contractSize?: string | number;
  openPrice?: number;
  currentPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  sl?: string | number | null;
  tp?: string | number | null;
  swap?: number;
  commission?: number;
  marginRequired?: string | number;
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
