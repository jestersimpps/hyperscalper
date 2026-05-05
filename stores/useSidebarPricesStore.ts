import { create } from 'zustand';
import type { ExchangeWebSocketService } from '@/lib/websocket/exchange-websocket.interface';
import { useWebSocketStatusStore } from '@/stores/useWebSocketStatusStore';

interface SidebarPricesStore {
  prices: Record<string, number>;
  lastUpdate: number;
  isSubscribed: boolean;
  subscriptionId: string | null;
  wsService: ExchangeWebSocketService | null;
  cleanup: (() => void) | null;

  subscribe: () => void;
  unsubscribe: () => void;
  getPrice: (coin: string) => number | null;
}

export const useSidebarPricesStore = create<SidebarPricesStore>((set, get) => ({
  prices: {},
  lastUpdate: 0,
  isSubscribed: false,
  subscriptionId: null,
  wsService: null,
  cleanup: null,

  subscribe: () => {
    const { isSubscribed } = get();

    if (isSubscribed) {
      return;
    }

    const init = async () => {
      const { useWebSocketService } = await import('@/lib/websocket/websocket-singleton');
      const { service, trackSubscription } = useWebSocketService('hyperliquid');
      const cleanup = trackSubscription();

      const subscriptionId = service.subscribeToAllMids((mids) => {
        set({ prices: mids, lastUpdate: Date.now() });
      });

      useWebSocketStatusStore.getState().setStreamSubscriptionCount('prices', 1);
      set({ isSubscribed: true, subscriptionId, wsService: service, cleanup });
    };

    init();
  },

  unsubscribe: () => {
    const { subscriptionId, wsService, isSubscribed, cleanup } = get();

    if (!isSubscribed || !subscriptionId) {
      return;
    }

    if (wsService) wsService.unsubscribe(subscriptionId);
    if (cleanup) cleanup();
    useWebSocketStatusStore.getState().setStreamSubscriptionCount('prices', 0);
    set({ isSubscribed: false, subscriptionId: null, wsService: null, cleanup: null, prices: {} });
  },

  getPrice: (coin: string) => {
    return get().prices[coin] || null;
  },
}));
