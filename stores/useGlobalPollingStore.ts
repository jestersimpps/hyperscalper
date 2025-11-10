import { create } from 'zustand';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';
import { useOrderStore } from './useOrderStore';
import { usePositionStore } from './usePositionStore';
import { useSymbolVolatilityStore } from './useSymbolVolatilityStore';
import { useTopSymbolsStore } from './useTopSymbolsStore';
import { useCandleStore } from './useCandleStore';

interface GlobalPollingStore {
  service: HyperliquidService | null;
  fastPollingInterval: NodeJS.Timeout | null;
  slowPollingInterval: NodeJS.Timeout | null;
  candlePollingInterval: NodeJS.Timeout | null;
  isPolling: boolean;
  lastFastPollTime: number | null;
  lastSlowPollTime: number | null;
  lastCandlePollTime: number | null;
  isFirstCandleFetch: boolean;

  setService: (service: HyperliquidService) => void;
  startGlobalPolling: () => void;
  stopGlobalPolling: () => void;
  fetchFastData: () => Promise<void>;
  fetchSlowData: () => Promise<void>;
  fetchCandleData: () => Promise<void>;
}

export const useGlobalPollingStore = create<GlobalPollingStore>((set, get) => ({
  service: null,
  fastPollingInterval: null,
  slowPollingInterval: null,
  candlePollingInterval: null,
  isPolling: false,
  lastFastPollTime: null,
  lastSlowPollTime: null,
  lastCandlePollTime: null,
  isFirstCandleFetch: true,

  setService: (service: HyperliquidService) => {
    console.log('[GlobalPolling] setService called, starting global polling');
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
      const topSymbolsStore = useTopSymbolsStore.getState();
      const symbolsBeforeUpdate = topSymbolsStore.symbols.length;

      const metaData = await service.getMetaAndAssetCtxs().catch(err => {
        console.error('[GlobalPolling] Error fetching meta:', err);
        return null;
      });

      if (metaData) {
        const volatilityStore = useSymbolVolatilityStore.getState();

        volatilityStore.updateFromGlobalPoll(metaData);
        topSymbolsStore.updateFromGlobalPoll(metaData);

        const symbolsAfterUpdate = topSymbolsStore.symbols.length;

        if (symbolsBeforeUpdate === 0 && symbolsAfterUpdate > 0) {
          console.log('[GlobalPolling] Top symbols just loaded, triggering immediate candle fetch');
          get().fetchCandleData();
        }
      }

      set({ lastSlowPollTime: Date.now() });
    } catch (error) {
      console.error('[GlobalPolling] Error in fetchSlowData:', error);
    }
  },

  fetchCandleData: async () => {
    const { service, isFirstCandleFetch } = get();
    if (!service) {
      console.log('[GlobalPolling] fetchCandleData: no service, skipping');
      return;
    }

    try {
      const candleStore = useCandleStore.getState();
      const topSymbolsStore = useTopSymbolsStore.getState();
      const topSymbols = topSymbolsStore.symbols.slice(0, 20);

      if (topSymbols.length === 0) {
        console.log('[GlobalPolling] fetchCandleData: no symbols loaded yet, skipping');
        return;
      }

      console.log(`[GlobalPolling] fetchCandleData: fetching for ${topSymbols.length} symbols`);

      for (const symbol of topSymbols) {
        const symbolName = symbol.name;

        if (candleStore.activeSymbol === symbolName) {
          console.log(`[GlobalPolling] Skipping active symbol: ${symbolName}`);
          continue;
        }

        const existingCandles = candleStore.candles[`${symbolName}-1m`];
        const hasData = existingCandles && existingCandles.length >= 10;

        const endTime = Date.now();
        let startTime: number;

        if (isFirstCandleFetch) {
          startTime = endTime - (1200 * 60 * 1000);
        } else if (hasData) {
          startTime = endTime - (10 * 60 * 1000);
        } else {
          startTime = endTime - (1200 * 60 * 1000);
        }

        await candleStore.fetchCandles(symbolName, '1m', startTime, endTime);
      }

      console.log('[GlobalPolling] fetchCandleData: completed, updating lastCandlePollTime');
      set({
        lastCandlePollTime: Date.now(),
        isFirstCandleFetch: false
      });
    } catch (error) {
      console.error('[GlobalPolling] Error in fetchCandleData:', error);
    }
  },

  startGlobalPolling: () => {
    const { fastPollingInterval, slowPollingInterval, candlePollingInterval, fetchFastData, fetchSlowData, fetchCandleData } = get();

    if (fastPollingInterval || slowPollingInterval || candlePollingInterval) {
      console.log('[GlobalPolling] startGlobalPolling: already running, skipping');
      return;
    }

    console.log('[GlobalPolling] startGlobalPolling: starting all polling intervals');
    fetchFastData();
    fetchSlowData();
    fetchCandleData();

    const fastIntervalId = setInterval(() => {
      fetchFastData();
    }, 3000);

    const slowIntervalId = setInterval(() => {
      fetchSlowData();
    }, 60000);

    const candleIntervalId = setInterval(() => {
      fetchCandleData();
    }, 60000);

    set({
      fastPollingInterval: fastIntervalId,
      slowPollingInterval: slowIntervalId,
      candlePollingInterval: candleIntervalId,
      isPolling: true
    });
    console.log('[GlobalPolling] startGlobalPolling: all intervals started');
  },

  stopGlobalPolling: () => {
    const { fastPollingInterval, slowPollingInterval, candlePollingInterval } = get();

    if (fastPollingInterval) {
      clearInterval(fastPollingInterval);
    }

    if (slowPollingInterval) {
      clearInterval(slowPollingInterval);
    }

    if (candlePollingInterval) {
      clearInterval(candlePollingInterval);
    }

    set({
      fastPollingInterval: null,
      slowPollingInterval: null,
      candlePollingInterval: null,
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
