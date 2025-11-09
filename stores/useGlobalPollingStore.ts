import { create } from 'zustand';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';
import { useOrderStore } from './useOrderStore';
import { usePositionStore } from './usePositionStore';
import { useSymbolVolatilityStore } from './useSymbolVolatilityStore';
import { useTopSymbolsStore } from './useTopSymbolsStore';

interface GlobalPollingStore {
  service: HyperliquidService | null;
  fastPollingInterval: NodeJS.Timeout | null;
  slowPollingInterval: NodeJS.Timeout | null;
  isPolling: boolean;
  lastFastPollTime: number | null;
  lastSlowPollTime: number | null;

  setService: (service: HyperliquidService) => void;
  startGlobalPolling: () => void;
  stopGlobalPolling: () => void;
  fetchFastData: () => Promise<void>;
  fetchSlowData: () => Promise<void>;
}

export const useGlobalPollingStore = create<GlobalPollingStore>((set, get) => ({
  service: null,
  fastPollingInterval: null,
  slowPollingInterval: null,
  isPolling: false,
  lastFastPollTime: null,
  lastSlowPollTime: null,

  setService: (service: HyperliquidService) => {
    set({ service });
    get().startGlobalPolling();
  },

  fetchFastData: async () => {
    const { service } = get();
    if (!service) {
      return;
    }

    try {
      const [ordersData, positionsData] = await Promise.all([
        service.getOpenOrders().catch(err => {
          console.error('[GlobalPolling] Error fetching orders:', err);
          return [];
        }),
        service.getOpenPositions().catch(err => {
          console.error('[GlobalPolling] Error fetching positions:', err);
          return [];
        }),
      ]);

      const orderStore = useOrderStore.getState();
      const positionStore = usePositionStore.getState();

      if (ordersData) {
        orderStore.updateOrdersFromGlobalPoll(ordersData);
      }

      if (positionsData) {
        positionStore.updatePositionsFromGlobalPoll(positionsData);
      }

      set({ lastFastPollTime: Date.now() });
    } catch (error) {
      console.error('[GlobalPolling] Error in fetchFastData:', error);
    }
  },

  fetchSlowData: async () => {
    const { service } = get();
    if (!service) {
      return;
    }

    try {
      const metaData = await service.getMetaAndAssetCtxs().catch(err => {
        console.error('[GlobalPolling] Error fetching meta:', err);
        return null;
      });

      if (metaData) {
        const volatilityStore = useSymbolVolatilityStore.getState();
        const topSymbolsStore = useTopSymbolsStore.getState();

        volatilityStore.updateFromGlobalPoll(metaData);
        topSymbolsStore.updateFromGlobalPoll(metaData);
      }

      set({ lastSlowPollTime: Date.now() });
    } catch (error) {
      console.error('[GlobalPolling] Error in fetchSlowData:', error);
    }
  },

  startGlobalPolling: () => {
    const { fastPollingInterval, slowPollingInterval, fetchFastData, fetchSlowData } = get();

    if (fastPollingInterval || slowPollingInterval) {
      return;
    }

    fetchFastData();
    fetchSlowData();

    const fastIntervalId = setInterval(() => {
      fetchFastData();
    }, 3000);

    const slowIntervalId = setInterval(() => {
      fetchSlowData();
    }, 60000);

    set({
      fastPollingInterval: fastIntervalId,
      slowPollingInterval: slowIntervalId,
      isPolling: true
    });
  },

  stopGlobalPolling: () => {
    const { fastPollingInterval, slowPollingInterval } = get();

    if (fastPollingInterval) {
      clearInterval(fastPollingInterval);
    }

    if (slowPollingInterval) {
      clearInterval(slowPollingInterval);
    }

    set({
      fastPollingInterval: null,
      slowPollingInterval: null,
      isPolling: false
    });
  },
}));

if (typeof window !== 'undefined') {
  const cleanup = () => {
    const { stopGlobalPolling } = useGlobalPollingStore.getState();
    stopGlobalPolling();
  };

  window.addEventListener('beforeunload', cleanup);
}
