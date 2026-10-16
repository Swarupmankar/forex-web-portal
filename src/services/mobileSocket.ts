// Trading-engine notifications: wss://<engine>/ws/mobile?token=<trading token>
// (MOBILE-TRADING-INTEGRATION.md §8). Under A-book this is the only place an order's fill or the
// venue's rejection is reported. Nothing is replayed, so every (re)connect re-fetches orders.
import { store } from "@/store";
import { tradingApi } from "@/store/api/tradingApi";
import { tradingToken } from "@/store/useAccountStore";
import { useWorkspaceStore, type ToastKind } from "@/store/useWorkspaceStore";

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

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL?.trim().replace(/\/+$/, "") ?? "";

const refetchAccount = () =>
  store.dispatch(tradingApi.util.invalidateTags(["Orders", "Account", "OrderHistory"]));

function toastKind(p: MobileNotificationPayload): ToastKind {
  if (p.event === 'ORDER_REJECTED' || p.severity === 'CRITICAL') return "error";
  if (p.severity === 'ACTION_REQUIRED') return "warning";
  return p.event === 'ORDER_FILLED' ? "success" : "info";
}

function show(p: MobileNotificationPayload) {
  // title and description are written to be shown as-is. ORDER_REJECTED's reason is the venue's
  // own free text: display it, never branch on it.
  const reason = p.event === 'ORDER_REJECTED' && typeof p.data?.reason === "string" ? p.data.reason : "";
  const text = [p.title, p.description].filter(Boolean).join(" — ");
  useWorkspaceStore.getState().notify(reason && !text.includes(reason) ? `${text} (${reason})` : text, toastKind(p));
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
    if (!this.token || !ENGINE_URL || typeof WebSocket === "undefined") return;
    const ws = new WebSocket(`${ENGINE_URL.replace(/^http/i, "ws")}/ws/mobile?token=${encodeURIComponent(this.token)}`);
    this.ws = ws;
    ws.onmessage = (event) => {
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
