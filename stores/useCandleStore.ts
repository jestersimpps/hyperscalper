import { create } from 'zustand';
import type { CandleData, TimeInterval } from '@/types';
import type { ExchangeWebSocketService } from '@/lib/websocket/exchange-websocket.interface';
import { useWebSocketStatusStore } from '@/stores/useWebSocketStatusStore';
import { formatCandle } from '@/lib/format-utils';
import { MAX_CANDLES } from '@/lib/constants';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';
import { downsampleCandles } from '@/lib/candle-utils';
import type { TransformedCandle } from '@/lib/services/types';
import { INTERVAL_TO_MS } from '@/lib/time-utils';

interface CandleStore {
  candles: Record<string, CandleData[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  subscriptions: Record<string, { subscriptionId: string; cleanup: () => void; refCount: number }>;
  wsService: ExchangeWebSocketService | null;
  service: HyperliquidService | null;
  lastFetchTimes: Record<string, number>;

  setService: (service: HyperliquidService) => void;
  fetchCandles: (coin: string, interval: TimeInterval, startTime: number, endTime: number) => Promise<void>;
  subscribeToCandles: (coin: string, interval: TimeInterval) => void;
  unsubscribeFromCandles: (coin: string, interval: TimeInterval) => void;
  cleanup: () => void;
  getCandlesSync: (coin: string, interval: TimeInterval) => TransformedCandle[] | null;
  getClosePrices: (coin: string, interval: TimeInterval, count: number) => number[] | null;
  isCacheFresh: (coin: string, interval: TimeInterval, maxAgeMs?: number) => boolean;
}

const getCandleKey = (coin: string, interval: string): string => `${coin}-${interval}`;

export const useCandleStore = create<CandleStore>((set, get) => ({
  candles: {},
  loading: {},
  errors: {},
  subscriptions: {},
  wsService: null,
  service: null,
  lastFetchTimes: {},

  setService: (service: HyperliquidService) => {
    set({ service });
  },

  fetchCandles: async (coin, interval, startTime, endTime) => {
    const key = getCandleKey(coin, interval);
    const { loading, candles, service, isCacheFresh } = get();

    if (!service) {
      return;
    }

    if (loading[key]) {
      return;
    }

    if (candles[key] && candles[key].length > 0 && isCacheFresh(coin, interval)) {
      set((state) => ({
        lastFetchTimes: { ...state.lastFetchTimes, [key]: Date.now() }
      }));
      return;
    }

    const existingCandles = candles[key] || [];
    const isIncrementalFetch = interval === '1m' && existingCandles.length >= 10;

    let actualStartTime = startTime;
    let actualEndTime = endTime;

    if (isIncrementalFetch) {
      const intervalMs = INTERVAL_TO_MS[interval];
      actualEndTime = Date.now();
      actualStartTime = actualEndTime - (5 * intervalMs);
    }

    set((state) => ({
      loading: { ...state.loading, [key]: true },
      errors: { ...state.errors, [key]: null },
    }));

    try {
      const data = await service.getCandles({
        coin,
        interval,
        startTime: actualStartTime,
        endTime: actualEndTime,
      });

      const formattedData = data.map((candle) => formatCandle(candle, coin));

      let finalCandles: CandleData[];

      if (isIncrementalFetch && formattedData.length > 0) {
        const earliestNewTime = Math.min(...formattedData.map(c => c.time));
        const nonOverlappingExisting = existingCandles.filter(c => c.time < earliestNewTime);
        const merged = [...nonOverlappingExisting, ...formattedData];
        finalCandles = merged.slice(-MAX_CANDLES);

        console.log(`[Fetch Candles] ${key} - Incremental: merged ${existingCandles.length} existing + ${formattedData.length} new = ${finalCandles.length} total`);
      } else {
        finalCandles = formattedData;
        console.log(`[Fetch Candles] ${key} - Full fetch: ${formattedData.length} candles`);
      }

      if (finalCandles.length > 1) {
        const timeDiff = finalCandles[1].time - finalCandles[0].time;
        console.log(`[Fetch Candles] ${key} - Time difference between first two candles: ${timeDiff}ms (${timeDiff / 60000} minutes)`);
      }

      set((state) => ({
        candles: { ...state.candles, [key]: finalCandles },
        loading: { ...state.loading, [key]: false },
        lastFetchTimes: { ...state.lastFetchTimes, [key]: Date.now() },
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
            const updatedCandles = [...existingCandles, formattedCandle];
            const limitedCandles = updatedCandles.length > MAX_CANDLES
              ? updatedCandles.slice(-MAX_CANDLES)
              : updatedCandles;

            set((state) => ({
              candles: { ...state.candles, [key]: limitedCandles },
            }));
          }
        }
      );

      set((state) => {
        const newSubscriptions = {
          ...state.subscriptions,
          [key]: { subscriptionId, cleanup, refCount: 1 }
        };
        const subscriptionCount = Object.keys(newSubscriptions).length;
        useWebSocketStatusStore.getState().setStreamSubscriptionCount('candles', subscriptionCount);

        return {
          wsService: service,
          subscriptions: newSubscriptions,
        };
      });
    };

    initWebSocket();
  },

  unsubscribeFromCandles: (coin, interval) => {
    const key = getCandleKey(coin, interval);
    const { subscriptions, wsService } = get();

    const subscription = subscriptions[key];
    if (!subscription) {
      return;
    }

    const newRefCount = subscription.refCount - 1;

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
      return;
    }

    if (wsService) {
      wsService.unsubscribe(subscription.subscriptionId);
    }
    subscription.cleanup();

    const newSubscriptions = { ...subscriptions };
    delete newSubscriptions[key];
    const subscriptionCount = Object.keys(newSubscriptions).length;
    useWebSocketStatusStore.getState().setStreamSubscriptionCount('candles', subscriptionCount);

    set({ subscriptions: newSubscriptions });
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

  getCandlesSync: (coin, interval) => {
    const key = getCandleKey(coin, interval);
    const { candles } = get();
    const cachedCandles = candles[key];

    if (!cachedCandles || cachedCandles.length === 0) {
      return null;
    }

    return cachedCandles as TransformedCandle[];
  },

  getClosePrices: (coin, interval, count) => {
    const key = getCandleKey(coin, interval);
    const { candles } = get();
    const cachedCandles = candles[key];

    if (!cachedCandles || cachedCandles.length === 0) {
      return null;
    }

    const closePrices = downsampleCandles(cachedCandles as TransformedCandle[], count);
    return closePrices;
  },

  isCacheFresh: (coin, interval, maxAgeMs?: number) => {
    const key = getCandleKey(coin, interval);
    const { candles, lastFetchTimes } = get();

    const cachedCandles = candles[key];
    const lastFetchTime = lastFetchTimes[key];

    if (!cachedCandles || cachedCandles.length === 0) {
      return false;
    }

    if (!lastFetchTime) {
      return false;
    }

    let cacheAgeMs = maxAgeMs;
    if (!cacheAgeMs) {
      const { useSettingsStore } = require('./useSettingsStore');
      const cacheDurationMinutes = useSettingsStore.getState().settings.scanner.candleCacheDuration;
      cacheAgeMs = cacheDurationMinutes * 60 * 1000;
    }

    const age = Date.now() - lastFetchTime;
    return age < cacheAgeMs;
  },
}));
