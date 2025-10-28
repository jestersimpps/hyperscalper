import { create } from 'zustand';
import type { CandleData, TimeInterval } from '@/types';
import type { ExchangeWebSocketService } from '@/lib/websocket/exchange-websocket.interface';

interface GlobalBTCStore {
  candles: Record<TimeInterval, CandleData[]>;
  loading: Record<TimeInterval, boolean>;
  errors: Record<TimeInterval, string | null>;
  subscriptions: Record<TimeInterval, { subscriptionId: string; cleanup: () => void }>;
  wsService: ExchangeWebSocketService | null;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  cleanup: () => void;
}

const COIN = 'BTC';
const INTERVALS: TimeInterval[] = ['1m', '5m', '15m', '1h'];

const getHistoricalRange = (): { startTime: number; endTime: number } => {
  const endTime = Date.now();
  const startTime = endTime - (24 * 60 * 60 * 1000); // 24 hours ago

  return { startTime, endTime };
};

export const useGlobalBTCStore = create<GlobalBTCStore>((set, get) => ({
  candles: {
    '1m': [],
    '5m': [],
    '15m': [],
    '1h': [],
    '4h': [],
    '1d': [],
  },
  loading: {
    '1m': false,
    '5m': false,
    '15m': false,
    '1h': false,
    '4h': false,
    '1d': false,
  },
  errors: {
    '1m': null,
    '5m': null,
    '15m': null,
    '1h': null,
    '4h': null,
    '1d': null,
  },
  subscriptions: {},
  wsService: null,
  isInitialized: false,

  initialize: async () => {
    const { isInitialized, subscriptions } = get();

    if (isInitialized) {
      console.log('[GlobalBTCStore] Already initialized');
      return;
    }

    console.log('[GlobalBTCStore] Initializing global BTC subscriptions');

    // Fetch historical data for all intervals
    const { startTime, endTime } = getHistoricalRange();
    const fetchPromises = INTERVALS.map(async (interval) => {

      set((state) => ({
        loading: { ...state.loading, [interval]: true },
        errors: { ...state.errors, [interval]: null },
      }));

      try {
        const response = await fetch(
          `/api/candles?coin=${COIN}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch candles: ${response.statusText}`);
        }

        const data = await response.json();

        set((state) => ({
          candles: { ...state.candles, [interval]: data },
          loading: { ...state.loading, [interval]: false },
        }));
      } catch (error) {
        set((state) => ({
          errors: { ...state.errors, [interval]: error instanceof Error ? error.message : 'Unknown error' },
          loading: { ...state.loading, [interval]: false },
        }));
      }
    });

    await Promise.all(fetchPromises);

    // Subscribe to real-time updates for all intervals
    const { useWebSocketService } = await import('@/lib/websocket/websocket-singleton');
    const { service, trackSubscription } = useWebSocketService('hyperliquid');

    INTERVALS.forEach((interval) => {
      if (subscriptions[interval]) {
        console.log(`[GlobalBTCStore] Already subscribed to ${interval}`);
        return;
      }

      const cleanup = trackSubscription();

      const subscriptionId = service.subscribeToCandles(
        { coin: COIN, interval },
        (candle) => {
          const state = get();
          const existingCandles = state.candles[interval] || [];

          if (existingCandles.length === 0) return;

          const lastCandle = existingCandles[existingCandles.length - 1];

          if (candle.time === lastCandle.time) {
            const updatedCandles = [...existingCandles];
            updatedCandles[updatedCandles.length - 1] = candle;

            set((state) => ({
              candles: { ...state.candles, [interval]: updatedCandles },
            }));
          } else if (candle.time > lastCandle.time) {
            const updatedCandles = [...existingCandles, candle];

            set((state) => ({
              candles: { ...state.candles, [interval]: updatedCandles },
            }));
          }
        }
      );

      set((state) => ({
        wsService: service,
        subscriptions: {
          ...state.subscriptions,
          [interval]: { subscriptionId, cleanup }
        },
      }));

      console.log(`[GlobalBTCStore] Subscribed to ${COIN} ${interval} with ID: ${subscriptionId}`);
    });

    set({ isInitialized: true });
    console.log('[GlobalBTCStore] Initialization complete');
  },

  cleanup: () => {
    const { subscriptions, wsService } = get();

    console.log('[GlobalBTCStore] Cleaning up subscriptions');

    Object.entries(subscriptions).forEach(([interval, subscription]) => {
      if (wsService) {
        wsService.unsubscribe(subscription.subscriptionId);
      }
      subscription.cleanup();
    });

    set({
      subscriptions: {},
      wsService: null,
      isInitialized: false,
    });

    console.log('[GlobalBTCStore] Cleanup complete');
  },
}));
