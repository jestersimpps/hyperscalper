import { create } from 'zustand';
import type { CandleData, TimeInterval } from '@/types';
import type { ExchangeWebSocketService } from '@/lib/websocket/exchange-websocket.interface';
import { formatCandle } from '@/lib/format-utils';

interface CandleStore {
  candles: Record<string, CandleData[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  subscriptions: Record<string, { subscriptionId: string; cleanup: () => void; refCount: number }>;
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
      const formattedData = data.map((candle: CandleData) => formatCandle(candle, coin));

      set((state) => ({
        candles: { ...state.candles, [key]: formattedData },
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
      console.log(`[Store] Already subscribed to ${key}, incrementing refCount (${subscriptions[key].refCount} -> ${subscriptions[key].refCount + 1})`);
      set((state) => ({
        subscriptions: {
          ...state.subscriptions,
          [key]: {
            ...state.subscriptions[key],
            refCount: state.subscriptions[key].refCount + 1
          }
        }
      }));
      return;
    }

    console.log(`[Store] Subscribing to ${key} (refCount: 1)`);

    const initWebSocket = async () => {
      const { useWebSocketService } = await import('@/lib/websocket/websocket-singleton');
      const { service, trackSubscription } = useWebSocketService('hyperliquid');

      const cleanup = trackSubscription();

      const subscriptionId = service.subscribeToCandles(
        { coin, interval },
        (candle) => {
          const state = get();
          const existingCandles = state.candles[key];

          if (!existingCandles || existingCandles.length === 0) return;

          const formattedCandle = formatCandle(candle, coin);
          const lastCandle = existingCandles[existingCandles.length - 1];

          if (candle.time === lastCandle.time) {
            const updatedCandles = existingCandles.slice();
            updatedCandles[updatedCandles.length - 1] = formattedCandle;

            set((state) => ({
              candles: { ...state.candles, [key]: updatedCandles },
            }));
          } else if (candle.time > lastCandle.time) {
            set((state) => ({
              candles: { ...state.candles, [key]: [...state.candles[key], formattedCandle] },
            }));
          }
        }
      );

      set((state) => ({
        wsService: service,
        subscriptions: {
          ...state.subscriptions,
          [key]: { subscriptionId, cleanup, refCount: 1 }
        },
      }));

      console.log(`[Store] Subscribed to ${key} with ID: ${subscriptionId}`);
    };

    initWebSocket();
  },

  unsubscribeFromCandles: (coin, interval) => {
    const key = getCandleKey(coin, interval);
    const { subscriptions, wsService } = get();

    const subscription = subscriptions[key];
    if (!subscription) {
      console.warn(`[Store] No subscription found for ${key}`);
      return;
    }

    const newRefCount = subscription.refCount - 1;
    console.log(`[Store] Unsubscribing from ${key}, decrementing refCount (${subscription.refCount} -> ${newRefCount})`);

    if (newRefCount > 0) {
      set((state) => ({
        subscriptions: {
          ...state.subscriptions,
          [key]: {
            ...state.subscriptions[key],
            refCount: newRefCount
          }
        }
      }));
      console.log(`[Store] Keeping subscription to ${key} alive (refCount: ${newRefCount})`);
      return;
    }

    console.log(`[Store] Fully unsubscribing from ${key} (refCount reached 0)`);

    if (wsService) {
      wsService.unsubscribe(subscription.subscriptionId);
    }
    subscription.cleanup();

    const newSubscriptions = { ...subscriptions };
    delete newSubscriptions[key];

    set({ subscriptions: newSubscriptions });

    console.log(`[Store] Fully unsubscribed from ${key}`);
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
