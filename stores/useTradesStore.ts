import { create } from 'zustand';
import type { Trade } from '@/types';
import type { ExchangeWebSocketService } from '@/lib/websocket/exchange-websocket.interface';
import { useSymbolMetaStore } from './useSymbolMetaStore';

interface TradesStore {
  trades: Record<string, Trade[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  subscriptions: Record<string, { subscriptionId: string; cleanup: () => void }>;
  wsService: ExchangeWebSocketService | null;

  subscribeToTrades: (coin: string) => void;
  unsubscribeFromTrades: (coin: string) => void;
  cleanup: () => void;
}

const MAX_TRADES = 1000;

const formatPrice = (value: number, decimals: number): string => {
  return parseFloat(value.toFixed(decimals)).toString();
};

const formatTrade = (trade: Omit<Trade, 'priceFormatted' | 'sizeFormatted'>, coin: string): Trade => {
  const decimals = useSymbolMetaStore.getState().getDecimals(coin);
  return {
    ...trade,
    priceFormatted: formatPrice(trade.price, decimals.price),
    sizeFormatted: trade.size.toFixed(decimals.size),
  };
};

export const useTradesStore = create<TradesStore>((set, get) => ({
  trades: {},
  loading: {},
  errors: {},
  subscriptions: {},
  wsService: null,

  subscribeToTrades: (coin) => {
    const { subscriptions } = get();

    if (subscriptions[coin]) {
      console.log(`[TradesStore] Already subscribed to ${coin}`);
      return;
    }

    console.log(`[TradesStore] Subscribing to ${coin}`);

    const initWebSocket = async () => {
      const { useWebSocketService } = await import('@/lib/websocket/websocket-singleton');
      const { service, trackSubscription } = useWebSocketService('hyperliquid');

      const cleanup = trackSubscription();

      const subscriptionId = service.subscribeToTrades(
        { coin },
        (tradeBatch) => {
          set((state) => {
            const existingTrades = state.trades[coin] || [];
            const trades = Array.isArray(tradeBatch) ? tradeBatch : [tradeBatch];

            const existingTradeKeys = new Set(
              existingTrades.map(t => `${t.time}-${t.price}-${t.size}`)
            );

            const newTrades = trades
              .filter(trade => !existingTradeKeys.has(`${trade.time}-${trade.price}-${trade.size}`))
              .map(trade => formatTrade(trade, coin));

            const updatedTrades = [...newTrades, ...existingTrades].slice(0, MAX_TRADES);

            return {
              trades: { ...state.trades, [coin]: updatedTrades },
            };
          });
        }
      );

      set((state) => ({
        wsService: service,
        subscriptions: {
          ...state.subscriptions,
          [coin]: { subscriptionId, cleanup }
        },
      }));

      console.log(`[TradesStore] Subscribed to ${coin} with ID: ${subscriptionId}`);
    };

    initWebSocket();
  },

  unsubscribeFromTrades: (coin) => {
    const { subscriptions, wsService } = get();

    const subscription = subscriptions[coin];
    if (!subscription) {
      console.warn(`[TradesStore] No subscription found for ${coin}`);
      return;
    }

    console.log(`[TradesStore] Unsubscribing from ${coin}`);

    if (wsService) {
      wsService.unsubscribe(subscription.subscriptionId);
    }
    subscription.cleanup();

    const newSubscriptions = { ...subscriptions };
    delete newSubscriptions[coin];

    set({ subscriptions: newSubscriptions });

    console.log(`[TradesStore] Unsubscribed from ${coin}`);
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
