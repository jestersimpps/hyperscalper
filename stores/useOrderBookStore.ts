import { create } from 'zustand';
import type { OrderBookData } from '@/lib/websocket/exchange-websocket.interface';
import type { ExchangeWebSocketService } from '@/lib/websocket/exchange-websocket.interface';
import { useWebSocketStatusStore } from '@/stores/useWebSocketStatusStore';

interface OrderBookStore {
  orderBooks: Record<string, OrderBookData>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  subscriptions: Record<string, { subscriptionId: string; cleanup: () => void }>;
  wsService: ExchangeWebSocketService | null;

  fetchOrderBook: (coin: string, nSigFigs?: 2 | 3 | 4 | 5 | null, mantissa?: 2 | 5 | null) => Promise<void>;
  subscribeToOrderBook: (coin: string, nSigFigs?: 2 | 3 | 4 | 5 | null, mantissa?: 2 | 5 | null) => void;
  unsubscribeFromOrderBook: (coin: string, nSigFigs?: 2 | 3 | 4 | 5 | null) => void;
  cleanup: () => void;
}

const THROTTLE_MS = 333;
const lastUpdateTimes: Record<string, number> = {};

export const useOrderBookStore = create<OrderBookStore>((set, get) => ({
  orderBooks: {},
  loading: {},
  errors: {},
  subscriptions: {},
  wsService: null,

  fetchOrderBook: async (coin, nSigFigs, mantissa) => {
    const { loading, orderBooks } = get();
    const key = `${coin}${nSigFigs ? `_${nSigFigs}` : ''}`;

    if (loading[key] || orderBooks[key]) {
      return;
    }

    set((state) => ({
      loading: { ...state.loading, [key]: true },
      errors: { ...state.errors, [key]: null },
    }));

    try {
      const params = new URLSearchParams({ coin });
      if (nSigFigs) params.append('nSigFigs', nSigFigs.toString());
      if (mantissa) params.append('mantissa', mantissa.toString());

      const response = await fetch(`/api/orderbook?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch order book: ${response.statusText}`);
      }

      const data: OrderBookData = await response.json();

      set((state) => ({
        orderBooks: { ...state.orderBooks, [key]: data },
        loading: { ...state.loading, [key]: false },
      }));
    } catch (error) {
      set((state) => ({
        errors: { ...state.errors, [key]: error instanceof Error ? error.message : 'Unknown error' },
        loading: { ...state.loading, [key]: false },
      }));
    }
  },

  subscribeToOrderBook: (coin, nSigFigs, mantissa) => {
    const { subscriptions } = get();
    const key = `${coin}${nSigFigs ? `_${nSigFigs}` : ''}`;

    if (subscriptions[key]) {
      return;
    }

    const initWebSocket = async () => {
      const { useWebSocketService } = await import('@/lib/websocket/websocket-singleton');
      const { service, trackSubscription } = useWebSocketService('hyperliquid');

      const cleanup = trackSubscription();

      const subscriptionId = service.subscribeToOrderBook(
        { coin, nSigFigs, mantissa },
        (data) => {
          if (!data || !data.bids || !data.asks) {
            return;
          }

          const now = Date.now();
          const lastUpdate = lastUpdateTimes[key] || 0;

          if (now - lastUpdate < THROTTLE_MS) {
            return;
          }

          lastUpdateTimes[key] = now;

          set((state) => ({
            orderBooks: { ...state.orderBooks, [key]: data },
          }));
        }
      );

      set((state) => {
        const newSubscriptions = {
          ...state.subscriptions,
          [key]: { subscriptionId, cleanup }
        };
        const subscriptionCount = Object.keys(newSubscriptions).length;
        useWebSocketStatusStore.getState().setStreamSubscriptionCount('orderbook', subscriptionCount);

        return {
          wsService: service,
          subscriptions: newSubscriptions,
        };
      });
    };

    initWebSocket();
  },

  unsubscribeFromOrderBook: (coin, nSigFigs) => {
    const { subscriptions, wsService } = get();
    const key = `${coin}${nSigFigs ? `_${nSigFigs}` : ''}`;

    const subscription = subscriptions[key];
    if (!subscription) {
      return;
    }

    if (wsService) {
      wsService.unsubscribe(subscription.subscriptionId);
    }
    subscription.cleanup();

    const newSubscriptions = { ...subscriptions };
    delete newSubscriptions[key];
    const subscriptionCount = Object.keys(newSubscriptions).length;
    useWebSocketStatusStore.getState().setStreamSubscriptionCount('orderbook', subscriptionCount);

    set({ subscriptions: newSubscriptions });
  },

  cleanup: () => {
    const { subscriptions, wsService } = get();

    Object.entries(subscriptions).forEach(([coin, subscription]) => {
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
