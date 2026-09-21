import { create } from 'zustand';
import { CategoryType, OrderExecutionMode, OrderType } from '@/types/trading';

interface UIState {
  // Active Trading Symbol & Timeframe
  activeSymbol: string;
  setActiveSymbol: (symbol: string) => void;
  activeTimeframe: string;
  setActiveTimeframe: (tf: string) => void;
  chartType: 'candles' | 'line';
  setChartType: (type: 'candles' | 'line') => void;

  // Category filter & Search
  selectedCategory: CategoryType;
  setSelectedCategory: (cat: CategoryType) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Order ticket form state
  orderMode: OrderExecutionMode;
  setOrderMode: (mode: OrderExecutionMode) => void;
  selectedOrderSide: OrderType;
  setSelectedOrderSide: (side: OrderType) => void;
  volumeLots: number;
  setVolumeLots: (lots: number) => void;
  enableTPSL: boolean;
  setEnableTPSL: (enabled: boolean) => void;
  takeProfit: string;
  setTakeProfit: (tp: string) => void;
  stopLoss: string;
  setStopLoss: (sl: string) => void;

  // Bottom Table active tab
  bottomTab: 'positions' | 'pending' | 'history' | 'alerts';
  setBottomTab: (tab: 'positions' | 'pending' | 'history' | 'alerts') => void;

  // Sidebar Navigation (watchlist | add-symbols | profile)
  sidebarTab: 'watchlist' | 'add-symbols' | 'profile';
  setSidebarTab: (tab: 'watchlist' | 'add-symbols' | 'profile') => void;

  // Modals & Auth UI State
  oneClickTrading: boolean;
  setOneClickTrading: (enabled: boolean) => void;
  depositModalOpen: boolean;
  setDepositModalOpen: (open: boolean) => void;
  loginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
  profileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;

  // Session
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  tradingAccountNo: string;
  setTradingAccountNo: (acc: string) => void;

  // Initial Sync Check
  checkAuthSession: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeSymbol: 'XAUUSD',
  setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),
  activeTimeframe: '1m',
  setActiveTimeframe: (tf) => set({ activeTimeframe: tf }),
  chartType: 'candles',
  setChartType: (type) => set({ chartType: type }),

  selectedCategory: 'Popular',
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  orderMode: 'MARKET',
  setOrderMode: (mode) => set({ orderMode: mode }),
  selectedOrderSide: 'BUY',
  setSelectedOrderSide: (side) => set({ selectedOrderSide: side }),
  volumeLots: 0.01,
  setVolumeLots: (lots) => set({ volumeLots: Math.max(0.01, Number(lots.toFixed(2))) }),
  enableTPSL: false,
  setEnableTPSL: (enabled) => set({ enableTPSL: enabled }),
  takeProfit: '',
  setTakeProfit: (tp) => set({ takeProfit: tp }),
  stopLoss: '',
  setStopLoss: (sl) => set({ stopLoss: sl }),

  bottomTab: 'positions',
  setBottomTab: (tab) => set({ bottomTab: tab }),

  sidebarTab: 'watchlist',
  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  oneClickTrading: false,
  setOneClickTrading: (enabled) => set({ oneClickTrading: enabled }),
  depositModalOpen: false,
  setDepositModalOpen: (open) => set({ depositModalOpen: open }),
  loginModalOpen: false,
  setLoginModalOpen: (open) => set({ loginModalOpen: open }),
  profileModalOpen: false,
  setProfileModalOpen: (open) => set({ profileModalOpen: open }),

  isAuthenticated: false,
  setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),
  tradingAccountNo: '',
  setTradingAccountNo: (acc) => set({ tradingAccountNo: acc }),

  checkAuthSession: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('trading_token') || localStorage.getItem('access_token');
    const accNo = localStorage.getItem('trading_account_no') || '';
    if (token) {
      set({ isAuthenticated: true, tradingAccountNo: accNo });
    } else {
      set({ isAuthenticated: false, tradingAccountNo: '', loginModalOpen: true });
    }
  },
}));
