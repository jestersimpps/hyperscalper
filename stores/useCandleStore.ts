import { create } from 'zustand';
import type { CandleData, TimeInterval } from '@/types';
import type { ExchangeWebSocketService } from '@/lib/websocket/exchange-websocket.interface';

interface CandleStore {
  candles: Record<string, CandleData[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  subscriptions: Record<string, { subscriptionId: string; cleanup: () => void }>;
  wsService: ExchangeWebSocketService | null;

  fetchCandles: (coin: string, interval: TimeInterval, startTime: number, endTime: number) => Promise<void>;
  subscribeToCandles: (coin: string, interval: TimeInterval) => void;
  unsubscribeFromCandles: (coin: string, interval: TimeInterval) => void;
  cleanup: () => void;
}

const getCandleKey = (coin: string, interval: string): string => `${coin}-${interval}`;

export const useCandleStore = create<CandleStore>((set, get) => ({
  candles: {},
  loading: {},
  errors: {},
  subscriptions: {},
  wsService: null,

  fetchCandles: async (coin, interval, startTime, endTime) => {
    const key = getCandleKey(coin, interval);
    const { loading, candles } = get();

    if (loading[key] || candles[key]) {
      return;
    }

    set((state) => ({
      loading: { ...state.loading, [key]: true },
      errors: { ...state.errors, [key]: null },
    }));

    try {
      const response = await fetch(
        `/api/candles?coin=${coin}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch candles: ${response.statusText}`);
      }

      const data = await response.json();

      set((state) => ({
        candles: { ...state.candles, [key]: data },
        loading: { ...state.loading, [key]: false },
      }));
    } catch (error) {
      set((state) => ({
        errors: { ...state.errors, [key]: error instanceof Error ? error.message : 'Unknown error' },
        loading: { ...state.loading, [key]: false },
      }));
    }
  },

  subscribeToCandles: (coin, interval) => {
    const key = getCandleKey(coin, interval);
    const { subscriptions } = get();

    if (subscriptions[key]) {
      return;
    }

    const initWebSocket = async () => {
      const { useWebSocketService } = await import('@/lib/websocket/websocket-singleton');
      const { service, trackSubscription } = useWebSocketService('hyperliquid');

      const cleanup = trackSubscription();

      const subscriptionId = service.subscribeToCandles(
        { coin, interval },
        (candle) => {
          const state = get();
          const existingCandles = state.candles[key] || [];

          if (existingCandles.length === 0) return;

          const lastCandle = existingCandles[existingCandles.length - 1];

          if (candle.time === lastCandle.time) {
            const updatedCandles = [...existingCandles];
            updatedCandles[updatedCandles.length - 1] = candle;

            set((state) => ({
              candles: { ...state.candles, [key]: updatedCandles },
            }));
          } else if (candle.time > lastCandle.time) {
            const updatedCandles = [...existingCandles, candle];

            set((state) => ({
              candles: { ...state.candles, [key]: updatedCandles },
            }));
          }
        }
      );

      set((state) => ({
        wsService: service,
        subscriptions: {
          ...state.subscriptions,
          [key]: { subscriptionId, cleanup }
        },
      }));
    };

    initWebSocket();
  },

  unsubscribeFromCandles: (coin, interval) => {
    const key = getCandleKey(coin, interval);
    const { subscriptions, wsService } = get();

    const subscription = subscriptions[key];
    if (subscription && wsService) {
      wsService.unsubscribe(subscription.subscriptionId);
      subscription.cleanup();

      const newSubscriptions = { ...subscriptions };
      delete newSubscriptions[key];

      set({ subscriptions: newSubscriptions });
    }
  },

  cleanup: () => {
    const { subscriptions, wsService } = get();

    Object.entries(subscriptions).forEach(([key, subscription]) => {
      if (wsService) {
        wsService.unsubscribe(subscription.subscriptionId);
      }
      subscription.cleanup();
    });

    set({
      subscriptions: {},
      wsService: null,
    });
  },
}));
