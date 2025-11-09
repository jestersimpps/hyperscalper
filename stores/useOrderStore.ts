import { create } from 'zustand';
import { Order } from '@/models/Order';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';
import { mapHyperliquidOrders } from '@/lib/utils/order-mapper';

interface OrderStore {
  orders: Record<string, Order[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  pollingIntervals: Record<string, NodeJS.Timeout>;
  service: HyperliquidService | null;

  setService: (service: HyperliquidService) => void;
  fetchOrders: (coin: string) => Promise<void>;
  subscribeToOrders: (coin: string) => void;
  unsubscribeFromOrders: (coin: string) => void;
  startPolling: (coin: string, interval: number) => void;
  stopPolling: (coin: string) => void;
  updateOrdersFromGlobalPoll: (allOrders: any[]) => void;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: {},
  loading: {},
  errors: {},
  pollingIntervals: {},
  service: null,

  setService: (service: HyperliquidService) => {
    set({ service });
  },

  fetchOrders: async (coin: string) => {
    const { service } = get();
    if (!service) {
      return;
    }

    set((state) => ({
      loading: { ...state.loading, [coin]: true },
      errors: { ...state.errors, [coin]: null },
    }));

    try {
      const allOrders = await service.getOpenOrders();
      const coinOrders = allOrders.filter((order: any) => order.coin === coin);
      const mappedOrders = mapHyperliquidOrders(coinOrders);

      set((state) => ({
        orders: { ...state.orders, [coin]: mappedOrders },
        loading: { ...state.loading, [coin]: false },
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      set((state) => ({
        loading: { ...state.loading, [coin]: false },
        errors: { ...state.errors, [coin]: errorMessage },
      }));
    }
  },

  startPolling: (coin: string, interval: number = 5000) => {
    const { stopPolling, fetchOrders, pollingIntervals } = get();

    if (pollingIntervals[coin]) {
      stopPolling(coin);
    }

    fetchOrders(coin);

    const intervalId = setInterval(() => {
      fetchOrders(coin);
    }, interval);

    set((state) => ({
      pollingIntervals: { ...state.pollingIntervals, [coin]: intervalId },
    }));
  },

  stopPolling: (coin: string) => {
    const { pollingIntervals } = get();
    const intervalId = pollingIntervals[coin];

    if (intervalId) {
      clearInterval(intervalId);

      const { [coin]: _, ...remainingIntervals } = pollingIntervals;
      set({ pollingIntervals: remainingIntervals });
    }
  },

  subscribeToOrders: (coin: string) => {
    const { startPolling } = get();
    startPolling(coin, 5000);
  },

  unsubscribeFromOrders: (coin: string) => {
    const { stopPolling } = get();
    stopPolling(coin);
  },

  updateOrdersFromGlobalPoll: (allOrders: any[]) => {
    const ordersByCoin: Record<string, Order[]> = {};

    allOrders.forEach((order: any) => {
      const coin = order.coin;
      if (!ordersByCoin[coin]) {
        ordersByCoin[coin] = [];
      }
      ordersByCoin[coin].push(order);
    });

    const mappedOrders: Record<string, Order[]> = {};
    Object.keys(ordersByCoin).forEach(coin => {
      mappedOrders[coin] = mapHyperliquidOrders(ordersByCoin[coin]);
    });

    set((state) => ({
      orders: { ...state.orders, ...mappedOrders },
    }));
  },
}));
