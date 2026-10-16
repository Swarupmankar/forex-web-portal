import { create } from 'zustand';
import { CategoryType, OrderExecutionMode, OrderType } from '@/types/trading';
import { useAccountStore } from './useAccountStore';

interface UIState {
  resetOrderDraft: () => void;
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
  volumeInput: string;
  setVolumeInput:(value:string)=>void;
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
  // The terminal has no login of its own. 'checking' until a portal hand-off or a saved tab
  // session is found; 'ended' when the session expires or locks and the portal must reopen it.
  access: 'checking' | 'granted' | 'ended';
  accessMessage: string;
  grantAccess: () => void;
  endSession: (message: string) => void;
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
  resetOrderDraft: () => set({ orderMode: 'MARKET', selectedOrderSide: 'BUY', volumeInput: '0.01', volumeLots: 0.01, enableTPSL: false, takeProfit: '', stopLoss: '', oneClickTrading: false, bottomTab: 'positions', profileModalOpen: false }),
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
  volumeInput: "0.01",
  setVolumeInput: (value)=>set({volumeInput:value}),
  volumeLots: 0.01,
  setVolumeLots: (lots) => set({ volumeLots: Math.max(0.01, Number(lots.toFixed(2))),volumeInput:String(lots) }),
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
  access: 'checking',
  accessMessage: '',
  grantAccess: () => set({ access: 'granted', accessMessage: '' }),
  endSession: (message) => set({ access: 'ended', accessMessage: message, depositModalOpen: false, profileModalOpen: false }),
  profileModalOpen: false,
  setProfileModalOpen: (open) => set({ profileModalOpen: open }),

  isAuthenticated: false,
  setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),
  tradingAccountNo: '',
  setTradingAccountNo: (acc) => set({ tradingAccountNo: acc }),

  checkAuthSession: () => {
    if (typeof window === 'undefined') return;
    useAccountStore.getState().hydrate();
    const accounts = useAccountStore.getState();
    const account = accounts.accounts.find(a => a.id === accounts.activeId);
    if (account) {
      set({ isAuthenticated: true, tradingAccountNo: account.username });
    } else {
      set({ isAuthenticated: false, tradingAccountNo: '' });
    }
  },
}));
