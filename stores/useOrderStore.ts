import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Order } from '@/models/Order';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';
import { mapHyperliquidOrders } from '@/lib/utils/order-mapper';

interface OrderStore {
  orders: Record<string, Order[]>;
  optimisticOrders: Record<string, Order[]>;
  pendingCancellations: Set<string>;
  recentlyCancelled: Map<string, number>;
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
  addOptimisticOrder: (coin: string, order: Partial<Order>) => void;
  addOptimisticOrders: (coin: string, orders: Partial<Order>[]) => void;
  confirmOptimisticOrder: (coin: string, tempId: string, realOid: string) => void;
  rollbackOptimisticOrder: (coin: string, tempId: string) => void;
  updateOptimisticOrder: (coin: string, tempId: string, patch: Partial<Order>) => void;
  markPendingCancellation: (coin: string, oid: string) => void;
  clearPendingCancellation: (coin: string, oid: string) => void;
  confirmCancellation: (coin: string, oid: string) => void;
  removeOrders: (coin: string, oids: string[]) => void;
  restoreOrders: (coin: string, restored: Order[]) => void;
  getAllOrders: (coin: string) => Order[];
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      orders: {},
      optimisticOrders: {},
      pendingCancellations: new Set<string>(),
      recentlyCancelled: new Map<string, number>(),
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
        const { optimisticOrders, pendingCancellations, recentlyCancelled } = get();

        const now = Date.now();
        const liveCancelled = new Map<string, number>();
        recentlyCancelled.forEach((expiry, oid) => {
          if (expiry > now) liveCancelled.set(oid, expiry);
        });

        const ordersByCoin: Record<string, Order[]> = {};

        allOrders.forEach((order: any) => {
          const oidStr = String(order.oid);
          if (liveCancelled.has(oidStr)) return;
          const coin = order.coin;
          if (!ordersByCoin[coin]) {
            ordersByCoin[coin] = [];
          }
          ordersByCoin[coin].push(order);
        });

        const mappedOrders: Record<string, Order[]> = {};
        Object.keys(ordersByCoin).forEach(coin => {
          mappedOrders[coin] = mapHyperliquidOrders(ordersByCoin[coin]).map(order =>
            pendingCancellations.has(order.oid)
              ? { ...order, isPendingCancellation: true }
              : order
          );
        });

        const newOptimisticOrders = { ...optimisticOrders };
        Object.keys(mappedOrders).forEach(coin => {
          const realOrders = mappedOrders[coin];
          const optimistic = optimisticOrders[coin] || [];

          const confirmedOptimistic = optimistic.filter(opt => {
            return !realOrders.some(real =>
              Math.abs(real.price - opt.price) < 0.01 &&
              Math.abs(real.size - opt.size) < 0.01 &&
              real.side === opt.side
            );
          });

          const recentOptimistic = confirmedOptimistic.filter(opt =>
            Date.now() - opt.timestamp < 10000
          );

          if (recentOptimistic.length > 0) {
            newOptimisticOrders[coin] = recentOptimistic;
          } else {
            delete newOptimisticOrders[coin];
          }
        });

        set({ orders: mappedOrders, optimisticOrders: newOptimisticOrders, recentlyCancelled: liveCancelled });
      },

      addOptimisticOrder: (coin: string, order: Partial<Order>) => {
        const { optimisticOrders } = get();
        const coinOrders = optimisticOrders[coin] || [];

        const newOrder: Order = {
          oid: order.oid || '',
          coin: order.coin || coin,
          side: order.side || 'buy',
          price: order.price || 0,
          size: order.size || 0,
          orderType: order.orderType || 'limit',
          timestamp: order.timestamp || Date.now(),
          isOptimistic: true,
          tempId: order.tempId,
        };

        set({
          optimisticOrders: {
            ...optimisticOrders,
            [coin]: [...coinOrders, newOrder],
          },
        });
      },

      addOptimisticOrders: (coin: string, orders: Partial<Order>[]) => {
        const { optimisticOrders } = get();
        const coinOrders = optimisticOrders[coin] || [];

        const newOrders: Order[] = orders.map(order => ({
          oid: order.oid || '',
          coin: order.coin || coin,
          side: order.side || 'buy',
          price: order.price || 0,
          size: order.size || 0,
          orderType: order.orderType || 'limit',
          timestamp: order.timestamp || Date.now(),
          isOptimistic: true,
          tempId: order.tempId,
        }));

        set({
          optimisticOrders: {
            ...optimisticOrders,
            [coin]: [...coinOrders, ...newOrders],
          },
        });
      },

      confirmOptimisticOrder: (coin: string, tempId: string, realOid: string) => {
        const { orders, optimisticOrders } = get();
        const coinOptimistic = optimisticOrders[coin] || [];
        const coinOrders = orders[coin] || [];

        const optimisticOrder = coinOptimistic.find(o => o.tempId === tempId);
        if (!optimisticOrder) return;

        const confirmedOrder: Order = {
          ...optimisticOrder,
          oid: realOid,
          isOptimistic: false,
          tempId: undefined,
        };

        const remainingOptimistic = coinOptimistic.filter(o => o.tempId !== tempId);
        const newOptimisticOrders = { ...optimisticOrders };

        if (remainingOptimistic.length > 0) {
          newOptimisticOrders[coin] = remainingOptimistic;
        } else {
          delete newOptimisticOrders[coin];
        }

        set({
          orders: {
            ...orders,
            [coin]: [...coinOrders, confirmedOrder],
          },
          optimisticOrders: newOptimisticOrders,
        });
      },

      rollbackOptimisticOrder: (coin: string, tempId: string) => {
        const { optimisticOrders } = get();
        const coinOptimistic = optimisticOrders[coin] || [];

        const remainingOptimistic = coinOptimistic.filter(o => o.tempId !== tempId);
        const newOptimisticOrders = { ...optimisticOrders };

        if (remainingOptimistic.length > 0) {
          newOptimisticOrders[coin] = remainingOptimistic;
        } else {
          delete newOptimisticOrders[coin];
        }

        set({ optimisticOrders: newOptimisticOrders });
      },

      updateOptimisticOrder: (coin: string, tempId: string, patch: Partial<Order>) => {
        const { optimisticOrders } = get();
        const coinOptimistic = optimisticOrders[coin] || [];

        const next = coinOptimistic.map(o =>
          o.tempId === tempId ? { ...o, ...patch } : o
        );

        set({
          optimisticOrders: {
            ...optimisticOrders,
            [coin]: next,
          },
        });
      },

      markPendingCancellation: (coin: string, oid: string) => {
        const { orders, pendingCancellations } = get();
        const coinOrders = orders[coin] || [];

        const updatedOrders = coinOrders.map(order =>
          order.oid === oid
            ? { ...order, isPendingCancellation: true }
            : order
        );

        const newPendingCancellations = new Set(pendingCancellations);
        newPendingCancellations.add(oid);

        set({
          orders: { ...orders, [coin]: updatedOrders },
          pendingCancellations: newPendingCancellations,
        });
      },

      clearPendingCancellation: (coin: string, oid: string) => {
        const { orders, pendingCancellations } = get();
        if (!pendingCancellations.has(oid)) return;

        const coinOrders = orders[coin] || [];
        const updatedOrders = coinOrders.map(order =>
          order.oid === oid
            ? { ...order, isPendingCancellation: false }
            : order
        );

        const newPendingCancellations = new Set(pendingCancellations);
        newPendingCancellations.delete(oid);

        set({
          orders: { ...orders, [coin]: updatedOrders },
          pendingCancellations: newPendingCancellations,
        });
      },

      confirmCancellation: (coin: string, oid: string) => {
        const { orders, pendingCancellations, recentlyCancelled } = get();
        const coinOrders = orders[coin] || [];

        const updatedOrders = coinOrders.filter(order => order.oid !== oid);
        const newPendingCancellations = new Set(pendingCancellations);
        newPendingCancellations.delete(oid);

        const newRecentlyCancelled = new Map(recentlyCancelled);
        newRecentlyCancelled.set(String(oid), Date.now() + 5000);

        set({
          orders: { ...orders, [coin]: updatedOrders },
          pendingCancellations: newPendingCancellations,
          recentlyCancelled: newRecentlyCancelled,
        });
      },

      removeOrders: (coin: string, oids: string[]) => {
        if (oids.length === 0) return;
        const { orders, pendingCancellations, recentlyCancelled } = get();
        const coinOrders = orders[coin] || [];
        const oidSet = new Set(oids);

        const updatedOrders = coinOrders.filter(order => !oidSet.has(order.oid));
        const newPendingCancellations = new Set(pendingCancellations);
        oids.forEach(oid => newPendingCancellations.delete(oid));

        const newRecentlyCancelled = new Map(recentlyCancelled);
        const expiry = Date.now() + 5000;
        oids.forEach(oid => newRecentlyCancelled.set(String(oid), expiry));

        set({
          orders: { ...orders, [coin]: updatedOrders },
          pendingCancellations: newPendingCancellations,
          recentlyCancelled: newRecentlyCancelled,
        });
      },

      restoreOrders: (coin: string, restored: Order[]) => {
        if (restored.length === 0) return;
        const { orders, recentlyCancelled } = get();
        const coinOrders = orders[coin] || [];
        const existingOids = new Set(coinOrders.map(o => o.oid));
        const toAdd = restored
          .filter(o => !existingOids.has(o.oid))
          .map(o => ({ ...o, isPendingCancellation: false }));

        const newRecentlyCancelled = new Map(recentlyCancelled);
        restored.forEach(o => newRecentlyCancelled.delete(String(o.oid)));

        if (toAdd.length === 0) {
          set({ recentlyCancelled: newRecentlyCancelled });
          return;
        }

        set({
          orders: { ...orders, [coin]: [...coinOrders, ...toAdd] },
          recentlyCancelled: newRecentlyCancelled,
        });
      },

      getAllOrders: (coin: string): Order[] => {
        const { orders, optimisticOrders } = get();
        const coinOrders = orders[coin] || [];
        const coinOptimistic = optimisticOrders[coin] || [];

        return [...coinOrders, ...coinOptimistic];
      },
    }),
    {
      name: 'hyperscalper-orders',
      partialize: (state) => ({ orders: state.orders }),
    }
  )
);
