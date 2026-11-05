import { queueNotification, type Toast, type ToastKind, type ToastOptions } from '@/lib/notifications';
export type { Toast, ToastKind } from '@/lib/notifications';
import { activityHeight, ACTIVITY_DEFAULT } from '@/lib/workspaceLayout';
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
export type WorkspacePanel = "markets" | "chart" | "trade" | "activity";
export interface PriceAlert {
  mode?: "practice" | "connected";
  id: string;
  symbol: string;
  target: number;
  direction: "above" | "below";
  triggeredAt?: number;
}
interface Workspace {
  density: 'compact' | 'comfortable';
  setDensity: (value: 'compact' | 'comfortable') => void;
  watchlistReveal: {symbol: string; revision: number} | null;
  revealWatchlist: (symbol: string) => void;
  practiceFavorites: string[];
  setPracticeFavorites: (values:string[]) => void;
  instrumentPickerOpen: boolean;
  setInstrumentPickerOpen: (value:boolean) => void;
  openOrderTicket: () => void;
  closeOrderTicket: () => void;
  marketsOpen: boolean;
  ticketOpen: boolean;
  ticketDismissed: boolean;
  activityHeight: number;
  setMarketsOpen: (value: boolean) => void;
  setTicketOpen: (value: boolean) => void;
  setActivityHeight: (value: number) => void;
  resetLayout: () => void;
  selectedTradeId: string;
  selectTrade: (id:string)=>void;
  tradeSounds: boolean;
  setTradeSounds:(v:boolean)=>void;
  // Practice-only; connected one-click consent lives in useUIStore and resets on every account switch.
  oneClickPractice: boolean;
  oneClickClosePractice: boolean;
  setOneClickClosePractice:(v:boolean)=>void;
  setOneClickPractice:(v:boolean)=>void;
  activityMaximized: boolean;
  setActivityMaximized: (v:boolean)=>void;
  activityExpanded: boolean;
  setActivityExpanded: (v:boolean)=>void;
  panel: WorkspacePanel;
  focusChart: boolean;
  showGrid: boolean;
  showAverage: boolean;
  showTrades: boolean;
  alerts: PriceAlert[];
  alertOpen: boolean;
  helpOpen: boolean;
  settingsOpen: boolean;
  toasts: Toast[];
  notificationsOpen: boolean;
  setNotificationsOpen: (value:boolean) => void;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
  setPanel: (v: WorkspacePanel) => void;
  setFocus: (v: boolean) => void;
  setGrid: (v: boolean) => void;
  setAverage: (v: boolean) => void;
  setTrades: (v: boolean) => void;
  setAlertOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  // Queues a toast. An identical message already on screen gets a "×N" counter instead of a duplicate.
  notify: (v: string, kind?: ToastKind, options?: ToastOptions) => void;
  addAlert: (v: Omit<PriceAlert, "id">) => void;
  removeAlert: (id: string) => void;
  triggerAlert: (id: string) => void;
}
export const useWorkspaceStore = create<Workspace>()(
  persist(
    (set) => ({
      density:'compact',
      setDensity:value=>set({density:value}),
      watchlistReveal:null,
      revealWatchlist:symbol=>set(s=>({watchlistReveal:{symbol,revision:(s.watchlistReveal?.revision??0)+1},marketsOpen:true,focusChart:false,instrumentPickerOpen:false,panel:'markets'})),
      practiceFavorites:['XAUUSD','EURUSD','BTCUSD'],
      setPracticeFavorites:values=>set({practiceFavorites:values}),
      instrumentPickerOpen:false,
      setInstrumentPickerOpen:value=>set({instrumentPickerOpen:value}),
      openOrderTicket:()=>set({ticketOpen:true,ticketDismissed:false,focusChart:false,activityMaximized:false,panel:'trade'}),
      closeOrderTicket:()=>set({ticketOpen:false,ticketDismissed:true,panel:'chart'}),
      marketsOpen: true,
      ticketOpen: false,
      ticketDismissed: false,
      activityHeight: ACTIVITY_DEFAULT,
      setMarketsOpen: value => set({marketsOpen:value,...(value && {focusChart:false,panel:'markets'})}),
      setTicketOpen: value => set({ticketOpen:value,ticketDismissed:!value}),
      setActivityHeight: value => set({activityHeight:activityHeight(value)}),
      resetLayout: () => set({marketsOpen:true,ticketOpen:false,ticketDismissed:false,activityHeight:ACTIVITY_DEFAULT,activityExpanded:true,activityMaximized:false,focusChart:false,panel:'chart'}),
      selectedTradeId: "",
      selectTrade: (id)=>set({selectedTradeId:id,showTrades:true}),
      tradeSounds: true,
      setTradeSounds: (v)=>set({tradeSounds:v}),
      oneClickPractice: false,
      oneClickClosePractice: false,
      setOneClickClosePractice: (v)=>set({oneClickClosePractice:v}),
      setOneClickPractice: (v)=>set({oneClickPractice:v}),
      activityExpanded: true,
      activityMaximized: false,
      setActivityMaximized: (v)=>set({activityMaximized:v,activityExpanded:true,focusChart:false}),
      setActivityExpanded: (v)=>set({activityExpanded:v,...(!v && {activityMaximized:false})}),
      panel: "markets",
      focusChart: false,
      showGrid: true,
      showAverage: false,
      showTrades: true,
      alerts: [],
      alertOpen: false,
      helpOpen: false,
      settingsOpen: false,
      toasts: [],
      notificationsOpen: false,
      setNotificationsOpen: value => set({notificationsOpen:value}),
      setPanel: (v) => set({ panel: v, ...(v !== "activity" && {activityMaximized:false}), ...(v === "markets" && {marketsOpen:true}), ...(v === "trade" && {ticketOpen:true,ticketDismissed:false}) }),
      setFocus: (v) => set({ focusChart: v }),
      setGrid: (v) => set({ showGrid: v }),
      setAverage: (v) => set({ showAverage: v }),
      setTrades: (v) => set({ showTrades: v }),
      setAlertOpen: (v) => set({ alertOpen: v }),
      setHelpOpen: (v) => set({ helpOpen: v }),
      setSettingsOpen: (v) => set({ settingsOpen: v }),
      notify: (text, kind = "success", options = {}) =>
        set(s => ({toasts:queueNotification(s.toasts,text,kind,options,crypto.randomUUID(),Date.now())})),
      dismissToast: id => set(s => ({toasts:s.toasts.map(t=>t.id===id?{...t,active:false}:t)})),
      clearToasts: () => set({ toasts: [] }),
      addAlert: (v) =>
        set((s) => ({
          alerts: [...s.alerts, { ...v, id: crypto.randomUUID() }],
        })),
      removeAlert: (id) =>
        set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
      triggerAlert: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, triggeredAt: Date.now() } : a,
          ),
        })),
    }),
    {
      name: "mm-terminal-workspace-v1",
      storage: createJSONStorage(() => localStorage),
      merge: (saved, current) => {
        const value = (saved && typeof saved === 'object' ? saved : {}) as Partial<Workspace>;
        let favorites=value.practiceFavorites;
        if(!favorites)try{favorites=JSON.parse(localStorage.getItem('mm-terminal-favorites')??'null');}catch{}
        return {
          ...current, ...value,
          marketsOpen: typeof value.marketsOpen === 'boolean' ? value.marketsOpen : true,
          ticketOpen: false,
          ticketDismissed: false,
          density: value.density === 'comfortable' ? 'comfortable' : 'compact',
          watchlistReveal: null,
          activityHeight: activityHeight(value.activityHeight ?? ACTIVITY_DEFAULT),
          practiceFavorites:Array.isArray(favorites)&&favorites.every(s=>typeof s==='string')?favorites:current.practiceFavorites,
        };
      },
      partialize: (s) => ({
        density:s.density,
        practiceFavorites:s.practiceFavorites,
        marketsOpen: s.marketsOpen,
        activityHeight: activityHeight(s.activityHeight),
        alerts: s.alerts,
        tradeSounds: s.tradeSounds,
        oneClickPractice: s.oneClickPractice,
        oneClickClosePractice: s.oneClickClosePractice,
        showGrid: s.showGrid,
        showAverage: s.showAverage,
        showTrades: s.showTrades,
      }),
    },
  ),
);
