import { create } from 'zustand';
import type { CandleData, TimeInterval } from '@/types';
import type { ExchangeWebSocketService } from '@/lib/websocket/exchange-websocket.interface';
import { useWebSocketStatusStore } from '@/stores/useWebSocketStatusStore';
import { useSidebarPricesStore } from '@/stores/useSidebarPricesStore';
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
  activeSymbol: string | null;

  setService: (service: HyperliquidService) => void;
  setActiveSymbol: (coin: string | null) => void;
  fetchCandles: (coin: string, interval: TimeInterval, startTime: number, endTime: number) => Promise<void>;
  subscribeToCandles: (coin: string, interval: TimeInterval) => void;
  unsubscribeFromCandles: (coin: string, interval: TimeInterval) => void;
  backfillGap: (coin: string, interval: TimeInterval) => Promise<void>;
  backfillAllActive: () => Promise<void>;
  clearCandles: (coin: string, interval?: TimeInterval) => void;
  cleanup: () => void;
  getCandlesSync: (coin: string, interval: TimeInterval) => TransformedCandle[] | null;
  getClosePrices: (coin: string, interval: TimeInterval, count: number) => number[] | null;
}

const getCandleKey = (coin: string, interval: string): string => `${coin}-${interval}`;

const MAX_CANDLE_KEYS = 80;
const lastAccess: Map<string, number> = new Map();

const touch = (key: string): void => {
  lastAccess.set(key, Date.now());
};

const evictIfNeeded = (
  candles: Record<string, CandleData[]>,
  subscriptions: Record<string, unknown>,
  activeSymbol: string | null,
): Record<string, CandleData[]> | null => {
  const keys = Object.keys(candles);
  if (keys.length <= MAX_CANDLE_KEYS) {
    return null;
  }

  const evictable = keys.filter(key => {
    if (subscriptions[key]) return false;
    if (activeSymbol && key.startsWith(`${activeSymbol}-`)) return false;
    return true;
  });

  if (evictable.length === 0) {
    return null;
  }

  evictable.sort((a, b) => (lastAccess.get(a) ?? 0) - (lastAccess.get(b) ?? 0));

  const toEvict = keys.length - MAX_CANDLE_KEYS;
  const victims = evictable.slice(0, toEvict);

  if (victims.length === 0) {
    return null;
  }

  const next = { ...candles };
  victims.forEach(key => {
    delete next[key];
    lastAccess.delete(key);
  });
  return next;
};

export const useCandleStore = create<CandleStore>((set, get) => ({
  candles: {},
  loading: {},
  errors: {},
  subscriptions: {},
  wsService: null,
  service: null,
  activeSymbol: null,

  setService: (service: HyperliquidService) => {
    set({ service });
  },

  setActiveSymbol: (coin: string | null) => {
    set({ activeSymbol: coin });
  },

  fetchCandles: async (coin, interval, _startTime, _endTime) => {
    const key = getCandleKey(coin, interval);
    const { loading, service } = get();

    if (!service) {
      return;
    }

    if (loading[key]) {
      return;
    }

    const intervalMs = INTERVAL_TO_MS[interval];
    const actualEndTime = Date.now();
    const actualStartTime = actualEndTime - (1200 * intervalMs);

    set((state) => ({
      loading: { ...state.loading, [key]: true },
      errors: { ...state.errors, [key]: null },
    }));

    const attempt = async () => {
      const data = await service.getCandles({
        coin,
        interval,
        startTime: actualStartTime,
        endTime: actualEndTime,
      });
      return data.map((candle) => formatCandle(candle, coin));
    };

    try {
      let formattedData: CandleData[];
      try {
        formattedData = await attempt();
      } catch {
        // Transient blip on chart open is common; one retry covers it.
        await new Promise((r) => setTimeout(r, 500));
        formattedData = await attempt();
      }

      touch(key);
      set((state) => {
        const nextCandles = { ...state.candles, [key]: formattedData };
        const afterEvict = evictIfNeeded(nextCandles, state.subscriptions, state.activeSymbol);
        return {
          candles: afterEvict ?? nextCandles,
          loading: { ...state.loading, [key]: false },
        };
      });
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
      const { getWebSocketService } = await import('@/lib/websocket/websocket-singleton');
      const { service, trackSubscription } = getWebSocketService('hyperliquid');

      const cleanup = trackSubscription();

      const subscriptionId = service.subscribeToCandles(
        { coin, interval },
        (candle) => {
          const state = get();
          const existingCandles = state.candles[key] || [];
          const formattedCandle = formatCandle(candle, coin);

          // Drop WS ticks that arrive before REST history lands. Writing a
          // single-candle array here causes the chart to render only that
          // one bar if the REST fetch later fails or is skipped. The
          // in-progress bar this tick represents will be in the REST
          // response anyway, and subsequent ticks will update it.
          if (existingCandles.length === 0) {
            return;
          }

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

  backfillGap: async (coin, interval) => {
    const key = getCandleKey(coin, interval);
    const { service, candles, loading } = get();
    if (!service || loading[key]) return;

    const existing = candles[key];
    if (!existing || existing.length === 0) return;

    const intervalMs = INTERVAL_TO_MS[interval];
    const lastTime = existing[existing.length - 1].time;
    const now = Date.now();
    if (now - lastTime < intervalMs) return;

    set((state) => ({ loading: { ...state.loading, [key]: true } }));

    try {
      const data = await service.getCandles({
        coin,
        interval,
        startTime: lastTime,
        endTime: now,
      });
      if (data.length === 0) return;

      const formatted = data.map((c) => formatCandle(c, coin));

      set((state) => {
        const current = state.candles[key] ?? [];
        const byTime = new Map<number, CandleData>();
        current.forEach((c) => byTime.set(c.time, c));
        formatted.forEach((c) => byTime.set(c.time, c));
        const merged = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
        const limited = merged.length > MAX_CANDLES ? merged.slice(-MAX_CANDLES) : merged;
        return { candles: { ...state.candles, [key]: limited } };
      });
      touch(key);
    } catch {
      // Swallow — next WS tick or next reconnect will retry
    } finally {
      set((state) => ({ loading: { ...state.loading, [key]: false } }));
    }
  },

  backfillAllActive: async () => {
    const { subscriptions } = get();
    const keys = Object.keys(subscriptions);
    await Promise.all(
      keys.map((key) => {
        const dashIdx = key.lastIndexOf('-');
        if (dashIdx <= 0) return Promise.resolve();
        const coin = key.slice(0, dashIdx);
        const interval = key.slice(dashIdx + 1) as TimeInterval;
        return get().backfillGap(coin, interval);
      })
    );
  },

  clearCandles: (coin, interval?) => {
    const { candles, loading, errors } = get();
    const newCandles = { ...candles };
    const newLoading = { ...loading };
    const newErrors = { ...errors };

    if (interval) {
      const key = getCandleKey(coin, interval);
      delete newCandles[key];
      delete newLoading[key];
      delete newErrors[key];
      lastAccess.delete(key);
    } else {
      const intervals: TimeInterval[] = ['1m', '5m', '15m', '1h'];
      intervals.forEach(int => {
        const key = getCandleKey(coin, int);
        delete newCandles[key];
        delete newLoading[key];
        delete newErrors[key];
        lastAccess.delete(key);
      });
    }

    set({
      candles: newCandles,
      loading: newLoading,
      errors: newErrors,
    });
  },

  cleanup: () => {
    const { subscriptions, wsService } = get();

    Object.entries(subscriptions).forEach(([, subscription]) => {
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

    touch(key);
    return cachedCandles as TransformedCandle[];
  },

  getClosePrices: (coin, interval, count) => {
    const key = getCandleKey(coin, interval);
    const { candles } = get();
    const cachedCandles = candles[key];

    if (!cachedCandles || cachedCandles.length === 0) {
      return null;
    }

    touch(key);
    const closePrices = downsampleCandles(cachedCandles as TransformedCandle[], count);
    return closePrices;
  },
}));

// Shared cooldown across both triggers (WS reconnect + visibility flip).
// Without it, a lid-open that also flips the socket can fire two full sweeps
// back-to-back; tab thrash can fire many. HL info endpoint is 1200 weight/min
// and a sweep is N_subs × 20, so a few bursts can chew through the budget.
let lastResyncAt = 0;
const RESYNC_COOLDOWN_MS = 5000;
const resync = () => {
  if (Date.now() - lastResyncAt < RESYNC_COOLDOWN_MS) return;
  lastResyncAt = Date.now();

  const state = useCandleStore.getState();
  state.backfillAllActive();

  const service = state.service;
  if (service) {
    service.getAllMids().then((mids) => {
      const parsed: Record<string, number> = {};
      for (const [coin, px] of Object.entries(mids)) {
        const n = parseFloat(px as string);
        if (n > 0) parsed[coin] = n;
      }
      useSidebarPricesStore.setState({ prices: parsed, lastUpdate: Date.now() });
    }).catch(() => {});
  }
};

// On WebSocket reconnect (any transition INTO 'connected' that wasn't already
// connected), backfill any candle gap that opened while the socket was down.
// The HL WS only streams live candles forward — closed bars during the outage
// are never replayed, so we re-fetch from the last known time to now.
let prevWsStatus: string | null = null;
useWebSocketStatusStore.subscribe((state) => {
  const next = state.overallStatus;
  if (next === 'connected' && prevWsStatus && prevWsStatus !== 'connected') {
    resync();
  }
  prevWsStatus = next;
});

// Lid-close / tab-suspend handler. The WS may not emit a 'close' on resume,
// so the reconnect hook above doesn't fire — but candles still missed bars
// and the cached mid is stale.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    resync();
  });
}
