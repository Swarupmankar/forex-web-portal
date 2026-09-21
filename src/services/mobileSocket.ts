export type MobileNotificationEvent =
  | 'ORDER_FILLED'
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

class MobileSocketService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private onNotificationCallback?: (payload: MobileNotificationPayload) => void;
  private onStatusCallback?: (connected: boolean) => void;

  public setCallbacks(
    onNotification?: (payload: MobileNotificationPayload) => void,
    onStatusChange?: (connected: boolean) => void
  ) {
    this.onNotificationCallback = onNotification;
    this.onStatusCallback = onStatusChange;
  }

  public connect(token: string) {
    if (!token) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://aznxt-fx-ts-backend-server-1.onrender.com';
    let wsUrl = apiBase.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
    if (wsUrl.endsWith('/')) wsUrl = wsUrl.slice(0, -1);
    const fullUrl = `${wsUrl}/ws/mobile?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        console.log('✅ Mobile WebSocket connected to /ws/mobile');
        this.onStatusCallback?.(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'notification' && this.onNotificationCallback) {
            this.onNotificationCallback(payload);
          }
        } catch (e) {
          // ignore parsing errors
        }
      };

      this.ws.onclose = () => {
        this.onStatusCallback?.(false);
      };

      this.ws.onerror = () => {
        this.onStatusCallback?.(false);
      };
    } catch (e) {
      console.error('Error connecting mobile websocket:', e);
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const mobileSocketService = new MobileSocketService();
