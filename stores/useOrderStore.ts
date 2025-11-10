import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
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
      },

      stopPolling: (coin: string) => {
      },

      subscribeToOrders: (coin: string) => {
      },

      unsubscribeFromOrders: (coin: string) => {
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

        set({ orders: mappedOrders });
      },
    }),
    {
      name: 'hyperscalper-orders',
      partialize: (state) => ({ orders: state.orders }),
    }
  )
);
