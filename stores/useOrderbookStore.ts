import { create } from 'zustand';
import type { ExchangeWebSocketService, OrderbookData, OrderbookLevel } from '@/lib/websocket/exchange-websocket.interface';
import { useWebSocketStatusStore } from '@/stores/useWebSocketStatusStore';

interface OrderbookSnapshot {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  spreadBps: number | null;
  time: number;
}

interface OrderbookStore {
  books: Record<string, OrderbookSnapshot>;
  subscriptions: Record<string, { subscriptionId: string; cleanup: () => void }>;
  wsService: ExchangeWebSocketService | null;

  subscribeToOrderbook: (coin: string) => void;
  unsubscribeFromOrderbook: (coin: string) => void;
  cleanup: () => void;
}

const EMPTY: OrderbookSnapshot = {
  bids: [],
  asks: [],
  bestBid: null,
  bestAsk: null,
  spread: null,
  spreadBps: null,
  time: 0,
};

export const useOrderbookStore = create<OrderbookStore>((set, get) => ({
  books: {},
  subscriptions: {},
  wsService: null,

  subscribeToOrderbook: (coin) => {
    const { subscriptions } = get();

    if (subscriptions[coin]) {
      return;
    }

    const init = async () => {
      const { useWebSocketService } = await import('@/lib/websocket/websocket-singleton');
      const { service, trackSubscription } = useWebSocketService('hyperliquid');

      const cleanup = trackSubscription();

      const subscriptionId = service.subscribeToOrderbook(
        { coin },
        (data: OrderbookData) => {
          const bestBid = data.bids[0]?.price ?? null;
          const bestAsk = data.asks[0]?.price ?? null;
          const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
          const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null;
          const spreadBps = spread != null && mid != null && mid > 0 ? (spread / mid) * 10000 : null;

          set((state) => ({
            books: {
              ...state.books,
              [coin]: {
                bids: data.bids,
                asks: data.asks,
                bestBid,
                bestAsk,
                spread,
                spreadBps,
                time: data.time,
              },
            },
          }));
        }
      );

      set((state) => {
        const newSubscriptions = {
          ...state.subscriptions,
          [coin]: { subscriptionId, cleanup },
        };
        useWebSocketStatusStore.getState().setStreamSubscriptionCount(
          'orderbook',
          Object.keys(newSubscriptions).length
        );
        return {
          wsService: service,
          subscriptions: newSubscriptions,
        };
      });
    };

    init();
  },

  unsubscribeFromOrderbook: (coin) => {
    const { subscriptions, wsService, books } = get();
    const subscription = subscriptions[coin];
    if (!subscription) return;

    if (wsService) {
      wsService.unsubscribe(subscription.subscriptionId);
    }
    subscription.cleanup();

    const newSubscriptions = { ...subscriptions };
    delete newSubscriptions[coin];

    const newBooks = { ...books };
    delete newBooks[coin];

    useWebSocketStatusStore.getState().setStreamSubscriptionCount(
      'orderbook',
      Object.keys(newSubscriptions).length
    );

    set({ subscriptions: newSubscriptions, books: newBooks });
  },

  cleanup: () => {
    const { subscriptions, wsService } = get();
    Object.values(subscriptions).forEach((subscription) => {
      if (wsService) {
        wsService.unsubscribe(subscription.subscriptionId);
      }
      subscription.cleanup();
    });
    useWebSocketStatusStore.getState().setStreamSubscriptionCount('orderbook', 0);
    set({ subscriptions: {}, books: {}, wsService: null });
  },
}));

export const selectOrderbook = (coin: string) => (state: OrderbookStore): OrderbookSnapshot =>
  state.books[coin] ?? EMPTY;
