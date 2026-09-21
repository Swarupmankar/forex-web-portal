import { io, Socket } from 'socket.io-client';
import { usePriceStore } from '@/store/usePriceStore';

const PRICE_WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'https://mock-ws-chart.onrender.com';

let socket: Socket | null = null;
const subscribedSymbols = new Set<string>();

export const initPriceSocket = () => {
  if (socket) return socket;

  socket = io(PRICE_WS_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('✅ Price Socket.IO connected');
    subscribedSymbols.forEach((sym) => {
      socket?.emit('subscribeSymbol', sym);
    });
  });

  socket.on('disconnect', () => {
    console.warn('⚠️ Price Socket.IO disconnected');
  });

  socket.on('price', (msg: unknown) => {
    if (typeof msg !== 'string') return;
    try {
      // Format: "SYMBOL BID ASK MID TIMESTAMP"
      const parts = msg.trim().split(' ');
      if (parts.length >= 3) {
        const symbol = parts[0];
        const bid = parseFloat(parts[1]);
        const ask = parseFloat(parts[2]);
        const mid = parts[3] ? parseFloat(parts[3]) : undefined;
        const ts = parts[4] ? parts[4] : Date.now();

        if (!isNaN(bid) && !isNaN(ask)) {
          usePriceStore.getState().updateTick(symbol, bid, ask, mid, ts);
        }
      }
    } catch (e) {
      // handle parse error silently
    }
  });

  return socket;
};

export const subscribeSymbol = (symbol: string) => {
  subscribedSymbols.add(symbol);
  if (socket && socket.connected) {
    socket.emit('subscribeSymbol', symbol);
  }
};

export const unsubscribeSymbol = (symbol: string) => {
  subscribedSymbols.delete(symbol);
  if (socket && socket.connected) {
    socket.emit('unsubscribeSymbol', symbol);
  }
};
