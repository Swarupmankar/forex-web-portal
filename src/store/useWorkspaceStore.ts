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
export type ToastKind = "success" | "error" | "info" | "warning";
export interface Toast {
  id: string;
  text: string;
  kind: ToastKind;
  count: number;
  at: number;
  // Errors stay until dismissed; everything else times out.
  sticky: boolean;
}
const MAX_TOASTS = 3;
interface Workspace {
  selectedTradeId: string;
  selectTrade: (id:string)=>void;
  tradeSounds: boolean;
  setTradeSounds:(v:boolean)=>void;
  // Practice-only; connected one-click consent lives in useUIStore and resets on every account switch.
  oneClickPractice: boolean;
  setOneClickPractice:(v:boolean)=>void;
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
  notify: (v: string, kind?: ToastKind, options?: { sticky?: boolean }) => void;
  addAlert: (v: Omit<PriceAlert, "id">) => void;
  removeAlert: (id: string) => void;
  triggerAlert: (id: string) => void;
}
export const useWorkspaceStore = create<Workspace>()(
  persist(
    (set) => ({
      selectedTradeId: "",
      selectTrade: (id)=>set({selectedTradeId:id,showTrades:true}),
      tradeSounds: true,
      setTradeSounds: (v)=>set({tradeSounds:v}),
      oneClickPractice: true,
      setOneClickPractice: (v)=>set({oneClickPractice:v}),
      activityExpanded: true,
      setActivityExpanded: (v)=>set({activityExpanded:v}),
      panel: "chart",
      focusChart: false,
      showGrid: true,
      showAverage: false,
      showTrades: true,
      alerts: [],
      alertOpen: false,
      helpOpen: false,
      settingsOpen: false,
      toasts: [],
      setPanel: (v) => set({ panel: v }),
      setFocus: (v) => set({ focusChart: v }),
      setGrid: (v) => set({ showGrid: v }),
      setAverage: (v) => set({ showAverage: v }),
      setTrades: (v) => set({ showTrades: v }),
      setAlertOpen: (v) => set({ alertOpen: v }),
      setHelpOpen: (v) => set({ helpOpen: v }),
      setSettingsOpen: (v) => set({ settingsOpen: v }),
      notify: (text, kind = "success", options) =>
        set((s) => {
          if (!text) return {};
          const existing = s.toasts.find((t) => t.text === text && t.kind === kind);
          if (existing)
            return { toasts: s.toasts.map((t) => (t === existing ? { ...t, count: t.count + 1, at: Date.now() } : t)) };
          const toast: Toast = { id: crypto.randomUUID(), text, kind, count: 1, at: Date.now(), sticky: options?.sticky ?? kind === "error" };
          let toasts = [...s.toasts, toast];
          // Over the limit, drop the oldest non-sticky toast first.
          while (toasts.length > MAX_TOASTS) {
            const drop = toasts.findIndex((t) => !t.sticky);
            toasts.splice(drop === -1 ? 0 : drop, 1);
          }
          return { toasts };
        }),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
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
      partialize: (s) => ({
        alerts: s.alerts,
        tradeSounds: s.tradeSounds,
        oneClickPractice: s.oneClickPractice,
        showGrid: s.showGrid,
        showAverage: s.showAverage,
        showTrades: s.showTrades,
      }),
    },
  ),
);
