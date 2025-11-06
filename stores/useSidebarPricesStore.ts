import { create } from 'zustand';
import type { ExchangeWebSocketService } from '@/lib/websocket/exchange-websocket.interface';
import { HyperliquidWebSocketService } from '@/lib/websocket/hyperliquid-websocket.service';
import { useWebSocketStatusStore } from '@/stores/useWebSocketStatusStore';

interface SidebarPricesStore {
  prices: Record<string, number>;
  isSubscribed: boolean;
  subscriptionId: string | null;
  wsService: ExchangeWebSocketService;

  subscribe: () => void;
  unsubscribe: () => void;
  getPrice: (coin: string) => number | null;
}

export const useSidebarPricesStore = create<SidebarPricesStore>((set, get) => ({
  prices: {},
  isSubscribed: false,
  subscriptionId: null,
  wsService: new HyperliquidWebSocketService(false),

  subscribe: () => {
    const { isSubscribed, wsService } = get();

    if (isSubscribed) {
      return;
    }

    const subscriptionId = wsService.subscribeToAllMids((mids) => {
      set({ prices: mids });
    });

    useWebSocketStatusStore.getState().setStreamSubscriptionCount('prices', 1);
    set({ isSubscribed: true, subscriptionId });
  },

  unsubscribe: () => {
    const { subscriptionId, wsService, isSubscribed } = get();

    if (!isSubscribed || !subscriptionId) {
      return;
    }

    wsService.unsubscribe(subscriptionId);
    useWebSocketStatusStore.getState().setStreamSubscriptionCount('prices', 0);
    set({ isSubscribed: false, subscriptionId: null, prices: {} });
  },

  getPrice: (coin: string) => {
    return get().prices[coin] || null;
  },
}));
