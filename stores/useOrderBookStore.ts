import { create } from 'zustand';
import type { OrderBookData } from '@/lib/websocket/exchange-websocket.interface';
import type { ExchangeWebSocketService } from '@/lib/websocket/exchange-websocket.interface';

interface OrderBookStore {
  orderBooks: Record<string, OrderBookData>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  subscriptions: Record<string, { subscriptionId: string; cleanup: () => void }>;
  wsService: ExchangeWebSocketService | null;

  fetchOrderBook: (coin: string) => Promise<void>;
  subscribeToOrderBook: (coin: string) => void;
  unsubscribeFromOrderBook: (coin: string) => void;
  cleanup: () => void;
}

export const useOrderBookStore = create<OrderBookStore>((set, get) => ({
  orderBooks: {},
  loading: {},
  errors: {},
  subscriptions: {},
  wsService: null,

  fetchOrderBook: async (coin) => {
    const { loading, orderBooks } = get();

    if (loading[coin] || orderBooks[coin]) {
      return;
    }

    set((state) => ({
      loading: { ...state.loading, [coin]: true },
      errors: { ...state.errors, [coin]: null },
    }));

    try {
      const response = await fetch(`/api/orderbook?coin=${coin}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch order book: ${response.statusText}`);
      }

      const data: OrderBookData = await response.json();

      set((state) => ({
        orderBooks: { ...state.orderBooks, [coin]: data },
        loading: { ...state.loading, [coin]: false },
      }));
    } catch (error) {
      set((state) => ({
        errors: { ...state.errors, [coin]: error instanceof Error ? error.message : 'Unknown error' },
        loading: { ...state.loading, [coin]: false },
      }));
    }
  },

  subscribeToOrderBook: (coin) => {
    const { subscriptions } = get();

    if (subscriptions[coin]) {
      console.log(`[OrderBookStore] Already subscribed to ${coin}`);
      return;
    }

    console.log(`[OrderBookStore] Subscribing to ${coin}`);

    const initWebSocket = async () => {
      const { useWebSocketService } = await import('@/lib/websocket/websocket-singleton');
      const { service, trackSubscription } = useWebSocketService('hyperliquid');

      const cleanup = trackSubscription();

      const subscriptionId = service.subscribeToOrderBook(
        { coin },
        (data) => {
          if (!data || !data.bids || !data.asks) {
            console.warn('[OrderBookStore] Invalid order book data received');
            return;
          }

          set((state) => ({
            orderBooks: { ...state.orderBooks, [coin]: data },
          }));
        }
      );

      set((state) => ({
        wsService: service,
        subscriptions: {
          ...state.subscriptions,
          [coin]: { subscriptionId, cleanup }
        },
      }));

      console.log(`[OrderBookStore] Subscribed to ${coin} with ID: ${subscriptionId}`);
    };

    initWebSocket();
  },

  unsubscribeFromOrderBook: (coin) => {
    const { subscriptions, wsService } = get();

    const subscription = subscriptions[coin];
    if (!subscription) {
      console.warn(`[OrderBookStore] No subscription found for ${coin}`);
      return;
    }

    console.log(`[OrderBookStore] Unsubscribing from ${coin}`);

    if (wsService) {
      wsService.unsubscribe(subscription.subscriptionId);
    }
    subscription.cleanup();

    const newSubscriptions = { ...subscriptions };
    delete newSubscriptions[coin];

    set({ subscriptions: newSubscriptions });

    console.log(`[OrderBookStore] Unsubscribed from ${coin}`);
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
