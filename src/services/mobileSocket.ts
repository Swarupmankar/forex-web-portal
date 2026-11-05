import { eventNotification } from '@/lib/tradeNotifications';
import { eventSound } from '@/lib/executionSounds';
import { playTradeSoundOnce } from '@/lib/tradeSound';
import { useTradeManagement } from '@/store/useTradeManagement';
// Trading-engine notifications: wss://<engine>/ws/mobile?token=<trading token>
// (MOBILE-TRADING-INTEGRATION.md §8). Under A-book this is the only place an order's fill or the
// venue's rejection is reported. Nothing is replayed, so every (re)connect re-fetches orders.
import { useSessionServices } from "@/store/useSessionServices";
import { store } from "@/store";
import { refreshTradingState, tradingApi } from "@/store/api/tradingApi";
import { tradingToken } from "@/store/useAccountStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useOrderFlow } from '@/store/useOrderFlow';

export type MobileNotificationEvent =
  | 'ORDER_FILLED'
  | 'ORDER_REJECTED'
  | 'ORDER_CANCELLED'
  | 'STOP_LOSS_HIT'
  | 'TAKE_PROFIT_HIT'
  | 'MARGIN_CALL'
  | 'POSITION_LIQUIDATED'
  | 'STOP_OUT';

export interface MobileNotificationPayload {
  type: 'notification';
  tradingAccountId: number;
  event: MobileNotificationEvent;
  severity: 'INFORMATIONAL' | 'ACTION_REQUIRED' | 'CRITICAL';
  title: string;
  description: string;
  data: Record<string, any>;
  ts: string;
}



const refetchAccount = () => {
  store.dispatch(refreshTradingState());
  store.dispatch(tradingApi.util.invalidateTags(["OrderHistory"]));
};

function show(p: MobileNotificationPayload) {
  const notice=eventNotification(p);
  useWorkspaceStore.getState().notify(notice.text,notice.kind,notice.options);
  if(useWorkspaceStore.getState().tradeSounds){
    const cue=eventSound(p,useTradeManagement.getState().results[String(p.data?.orderId)]);
    if(cue)void playTradeSoundOnce(cue.key,cue.kind);
  }
}

class MobileSocketService {
  private ws: WebSocket | null = null;
  private token = "";
  private attempt = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private authRejected = false;

  /** Connects for the active account's token. Call again after an account switch. */
  public start() {
    this.stop();
    this.token = tradingToken() ?? "";
    this.authRejected = false;
    this.open();
  }

  public stop() {
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.token = "";
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = ws.onmessage = ws.onerror = null;
      ws.close(1000);
    }
  }

  /** Before placing an order: a fill raised while disconnected is lost, so reconnect now. */
  public ensureConnected() {
    if (!this.token || this.authRejected) return;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.open();
  }

  private open() {
    const ENGINE_URL = useSessionServices.getState().binding?.engineBase;
    if (!this.token || !ENGINE_URL || typeof WebSocket === "undefined") return;
    const ws = new WebSocket(`${ENGINE_URL.replace(/^http/i, "ws")}/ws/mobile?token=${encodeURIComponent(this.token)}`);
    this.ws = ws;
    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      let payload: any;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (payload?.type === "connected") {
        this.attempt = 0;
        refetchAccount();
      } else if (payload?.type === "auth_error") {
        // The token was refused; the server closes next. Retrying the same token cannot help.
        this.authRejected = true;
      } else if (payload?.type === "notification") {
        if(payload.data && typeof payload.data==='object' && Number.isFinite(payload.tradingAccountId)) useOrderFlow.getState().receive(payload);
        show(payload as MobileNotificationPayload);
        refetchAccount();
      }
    };
    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.authRejected || !this.token) return;
      // 1001 is a deliberate server shutdown (a deploy): a short, quiet backoff.
      const delay = event.code === 1001 ? 1500 : Math.min(1000 * 2 ** this.attempt++, 15000) * (0.5 + Math.random() / 2);
      this.retry = setTimeout(() => {
        this.retry = null;
        this.open();
      }, delay);
    };
  }
}

export const mobileSocketService = new MobileSocketService();
