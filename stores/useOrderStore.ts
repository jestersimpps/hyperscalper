import { create } from 'zustand';
import { Order } from '@/models/Order';

interface OrderStore {
  orders: Record<string, Order[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  pollingIntervals: Record<string, NodeJS.Timeout>;

  fetchOrders: (coin: string) => Promise<void>;
  subscribeToOrders: (coin: string) => void;
  unsubscribeFromOrders: (coin: string) => void;
  startPolling: (coin: string, interval: number) => void;
  stopPolling: (coin: string) => void;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: {},
  loading: {},
  errors: {},
  pollingIntervals: {},

  fetchOrders: async (coin: string) => {
    set((state) => ({
      loading: { ...state.loading, [coin]: true },
      errors: { ...state.errors, [coin]: null },
    }));

    try {
      const response = await fetch(`/api/orders?coin=${coin}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch orders');
      }

      set((state) => ({
        orders: { ...state.orders, [coin]: data.orders || [] },
        loading: { ...state.loading, [coin]: false },
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error fetching orders for ${coin}:`, errorMessage);

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
}));
