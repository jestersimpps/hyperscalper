import { create } from 'zustand';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';
import { useOrderStore } from './useOrderStore';
import { usePositionStore } from './usePositionStore';
import { useSymbolVolatilityStore } from './useSymbolVolatilityStore';
import { useTopSymbolsStore } from './useTopSymbolsStore';

interface GlobalPollingStore {
  service: HyperliquidService | null;
  pollingInterval: NodeJS.Timeout | null;
  isPolling: boolean;
  lastPollTime: number | null;

  setService: (service: HyperliquidService) => void;
  startGlobalPolling: () => void;
  stopGlobalPolling: () => void;
  fetchAllData: () => Promise<void>;
}

export const useGlobalPollingStore = create<GlobalPollingStore>((set, get) => ({
  service: null,
  pollingInterval: null,
  isPolling: false,
  lastPollTime: null,

  setService: (service: HyperliquidService) => {
    set({ service });
    get().startGlobalPolling();
  },

  fetchAllData: async () => {
    const { service } = get();
    if (!service) {
      return;
    }

    try {
      const [ordersData, positionsData, metaData] = await Promise.all([
        service.getOpenOrders().catch(err => {
          console.error('[GlobalPolling] Error fetching orders:', err);
          return [];
        }),
        service.getOpenPositions().catch(err => {
          console.error('[GlobalPolling] Error fetching positions:', err);
          return [];
        }),
        service.getMetaAndAssetCtxs().catch(err => {
          console.error('[GlobalPolling] Error fetching meta:', err);
          return null;
        }),
      ]);

      const orderStore = useOrderStore.getState();
      const positionStore = usePositionStore.getState();
      const volatilityStore = useSymbolVolatilityStore.getState();
      const topSymbolsStore = useTopSymbolsStore.getState();

      if (ordersData) {
        orderStore.updateOrdersFromGlobalPoll(ordersData);
      }

      if (positionsData) {
        positionStore.updatePositionsFromGlobalPoll(positionsData);
      }

      if (metaData) {
        volatilityStore.updateFromGlobalPoll(metaData);
        topSymbolsStore.updateFromGlobalPoll(metaData);
      }

      set({ lastPollTime: Date.now() });
    } catch (error) {
      console.error('[GlobalPolling] Error in fetchAllData:', error);
    }
  },

  startGlobalPolling: () => {
    const { pollingInterval, fetchAllData } = get();

    if (pollingInterval) {
      return;
    }

    fetchAllData();

    const intervalId = setInterval(() => {
      fetchAllData();
    }, 3000);

    set({ pollingInterval: intervalId, isPolling: true });
  },

  stopGlobalPolling: () => {
    const { pollingInterval } = get();

    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null, isPolling: false });
    }
  },
}));

if (typeof window !== 'undefined') {
  const cleanup = () => {
    const { stopGlobalPolling } = useGlobalPollingStore.getState();
    stopGlobalPolling();
  };

  window.addEventListener('beforeunload', cleanup);
}
