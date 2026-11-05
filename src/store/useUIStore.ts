import { create } from 'zustand';
import { CategoryType, OrderExecutionMode, OrderType } from '@/types/trading';
import { useAccountStore } from './useAccountStore';

interface UIState {
  resetOrderDraft: () => void;
  // Active Trading Symbol & Timeframe
  activeSymbol: string;
  chartSymbols: string[];
  closeChartSymbol: (symbol: string) => void;
  prepareOrder: (symbol: string, side: OrderType, entry?: number) => void;
  orderDraftVersion: number;
  pendingEntry: string;
  setPendingEntry: (value: string) => void;
  pickingEntry: boolean;
  setPickingEntry: (value:boolean) => void;
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
  pendingOrderType: 'LIMIT' | 'STOP';
  setExecutionType: (type: 'MARKET' | 'LIMIT' | 'STOP') => void;
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
  oneClickClose: boolean;
  setOneClickClose: (enabled: boolean) => void;
  setOneClickTrading: (enabled: boolean) => void;
  depositModalOpen: boolean;
  setDepositModalOpen: (open: boolean) => void;
  // The terminal has no login of its own. 'checking' until a portal hand-off or a saved tab
  // session is found; 'ended' when the session expires or locks and the portal must reopen it.
  access: 'checking' | 'granted' | 'ended' | 'welcome';
  welcome: () => void;
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
  resetOrderDraft: () => set(s => ({ orderMode: 'MARKET', pendingOrderType:'LIMIT', pendingEntry:'', pickingEntry:false, selectedOrderSide: 'BUY', volumeInput: '0.01', volumeLots: 0.01, enableTPSL: false, takeProfit: '', stopLoss: '', oneClickTrading: false, oneClickClose: false, bottomTab: 'positions', profileModalOpen: false, orderDraftVersion:s.orderDraftVersion+1 })),
  activeSymbol: 'XAUUSD',
  chartSymbols: ['XAUUSD'],
  setActiveSymbol: (symbol) => set(s => ({activeSymbol:symbol,chartSymbols:s.chartSymbols.includes(symbol)?s.chartSymbols:[...s.chartSymbols.slice(-5),symbol],...(symbol !== s.activeSymbol && {pendingEntry:'',pickingEntry:false,orderMode:'MARKET',pendingOrderType:'LIMIT',stopLoss:'',takeProfit:'',enableTPSL:false})})),
  closeChartSymbol: symbol => {
    const s=get();
    if(s.chartSymbols.length<=1)return;
    const remaining=s.chartSymbols.filter(item=>item!==symbol);
    if(s.activeSymbol===symbol)get().setActiveSymbol(remaining[Math.max(0,s.chartSymbols.indexOf(symbol)-1)] ?? remaining[0]);
    set({chartSymbols:remaining});
  },
  pendingEntry:'',
  orderDraftVersion:0,
  setPendingEntry: value => set({pendingEntry:value}),
  pickingEntry:false,
  setPickingEntry:value=>set({pickingEntry:value}),
  prepareOrder: (symbol,side,entry) => {
    get().setActiveSymbol(symbol);
    get().setSelectedOrderSide(side);
    set(s=>({orderMode:entry == null?'MARKET':'PENDING',pendingEntry:entry == null?'':String(entry),pickingEntry:false,orderDraftVersion:s.orderDraftVersion+1}));
  },
  activeTimeframe: '1m',
  setActiveTimeframe: (tf) => set({ activeTimeframe: tf }),
  chartType: 'candles',
  setChartType: (type) => set({ chartType: type }),

  selectedCategory: 'Popular',
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  orderMode: 'MARKET',
  pendingOrderType: 'LIMIT',
  setExecutionType: type => set({orderMode:type==='MARKET'?'MARKET':'PENDING',...(type==='MARKET'?{pendingEntry:'',pickingEntry:false}:{pendingOrderType:type})}),
  setOrderMode: (mode) => set({ orderMode: mode,...(mode==='MARKET' && {pendingEntry:'',pickingEntry:false}) }),
  selectedOrderSide: 'BUY',
  setSelectedOrderSide: (side) => set(s=>({selectedOrderSide:side,...(side!==s.selectedOrderSide && {stopLoss:'',takeProfit:''})})),
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
  oneClickClose: false,
  setOneClickClose: (enabled) => set({oneClickClose: enabled}),
  setOneClickTrading: (enabled) => set({ oneClickTrading: enabled }),
  depositModalOpen: false,
  setDepositModalOpen: (open) => set({ depositModalOpen: open }),
  welcome: () => set({ access:'welcome',accessMessage:'' }),
  access: 'checking',
  accessMessage: '',
  grantAccess: () => set({ access: 'granted', accessMessage: '' }),
  endSession: (message) => set({ access: 'ended', accessMessage: message, oneClickTrading: false, oneClickClose: false, depositModalOpen: false, profileModalOpen: false }),
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
