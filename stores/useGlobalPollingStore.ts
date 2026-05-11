import { create } from 'zustand';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';
import { useOrderStore } from './useOrderStore';
import { usePositionStore } from './usePositionStore';
import { useSymbolVolatilityStore } from './useSymbolVolatilityStore';
import { useTopSymbolsStore } from './useTopSymbolsStore';
import { useCandleStore } from './useCandleStore';
import { useScannerStore } from './useScannerStore';
import { useSettingsStore } from './useSettingsStore';
import type { TimeInterval } from '@/types';
import type { PerpsMeta } from '@nktkas/hyperliquid';
import type { AssetCtx } from '@/lib/services/types';

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
  fastFetchInFlight: boolean;
  slowFetchInFlight: boolean;
  candleFetchInFlight: boolean;
  lastMetaSnapshot: { meta: PerpsMeta; assetCtxs: AssetCtx[] } | null;
  lastHigherTfFetch: Record<string, number>;

  setService: (service: HyperliquidService) => void;
  startGlobalPolling: () => void;
  stopGlobalPolling: () => void;
  pauseBackgroundPolling: () => void;
  resumeBackgroundPolling: () => void;
  fetchFastData: () => Promise<void>;
  fetchSlowData: () => Promise<void>;
  fetchCandleData: () => Promise<void>;
  triggerSlowPoll: () => Promise<void>;
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
  fastFetchInFlight: false,
  slowFetchInFlight: false,
  candleFetchInFlight: false,
  lastMetaSnapshot: null,
  lastHigherTfFetch: {},

  setService: (service: HyperliquidService) => {
    set({ service });
    get().startGlobalPolling();
  },

  fetchFastData: async () => {
    const { service, fastFetchInFlight } = get();
    if (!service || fastFetchInFlight) {
      return;
    }

    set({ fastFetchInFlight: true });
    try {
      const [ordersData, positionsData] = await Promise.all([
        service.getOpenOrders().catch(() => []),
        service.getOpenPositions().catch(() => []),
      ]);

      const orderStore = useOrderStore.getState();
      const positionStore = usePositionStore.getState();

      if (ordersData) {
        orderStore.updateOrdersFromGlobalPoll(ordersData);
      }

      if (positionsData) {
        positionStore.updatePositionsFromGlobalPoll(positionsData);
        // Seed leverage cache so subsequent setLeverage calls for these
        // coins skip the signed updateLeverage HTTP roundtrip.
        service.seedLeverageFromPositions(positionsData);
      }

      set({ lastFastPollTime: Date.now() });
    } catch {
      // swallow - next tick will retry
    } finally {
      set({ fastFetchInFlight: false });
    }
  },

  fetchSlowData: async () => {
    const { service, slowFetchInFlight } = get();
    if (!service || slowFetchInFlight) {
      return;
    }

    set({ slowFetchInFlight: true });
    try {
      const topSymbolsStore = useTopSymbolsStore.getState();
      const symbolsBeforeUpdate = topSymbolsStore.symbols.length;

      const metaData = await service.getMetaAndAssetCtxs().catch(() => null);

      if (metaData) {
        const volatilityStore = useSymbolVolatilityStore.getState();

        volatilityStore.updateFromGlobalPoll(metaData);
        topSymbolsStore.updateFromGlobalPoll(metaData);

        const symbolsAfterUpdate = topSymbolsStore.symbols.length;

        if (symbolsBeforeUpdate === 0 && symbolsAfterUpdate > 0) {
          get().fetchCandleData();
        }
      }

      set({ lastSlowPollTime: Date.now(), lastMetaSnapshot: metaData ?? get().lastMetaSnapshot });
    } catch {
      // swallow - next tick will retry
    } finally {
      set({ slowFetchInFlight: false });
    }
  },

  fetchCandleData: async () => {
    const { service, isFirstCandleFetch, candleFetchInFlight } = get();
    if (!service || candleFetchInFlight) {
      return;
    }

    set({ candleFetchInFlight: true });
    try {
      const candleStore = useCandleStore.getState();
      const topSymbolsStore = useTopSymbolsStore.getState();
      const topSymbols = topSymbolsStore.symbols.slice(0, 20);

      if (topSymbols.length === 0) {
        return;
      }

      const staggerDelay = 200;
      let index = 0;

      for (const symbol of topSymbols) {
        const symbolName = symbol.name;

        if (candleStore.activeSymbol === symbolName) {
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

        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, staggerDelay));
        }

        candleStore.fetchCandles(symbolName, '1m', startTime, endTime).catch(() => {
          // individual symbol failure is non-fatal
        });

        index++;
      }

      // Higher-timeframe prefetch for any scanner with 15m/1h enabled.
      // Cadence: 15m every 5min, 1h every 30min — there's no value polling
      // faster than the bar resolution.
      const scannerSettings = useSettingsStore.getState().settings.scanner;
      const enabledTfs = new Set<TimeInterval>();
      const collect = (tfs: readonly string[] | undefined) => {
        if (!tfs) return;
        for (const tf of tfs) {
          if (tf === '15m' || tf === '1h') enabledTfs.add(tf as TimeInterval);
        }
      };
      collect(scannerSettings?.cupAndHandleScanner?.timeframes);
      collect(scannerSettings?.ascendingTriangleScanner?.timeframes);
      collect(scannerSettings?.stochasticScanner?.timeframes);
      collect(scannerSettings?.emaAlignmentScanner?.timeframes);
      collect(scannerSettings?.channelScanner?.timeframes);
      collect(scannerSettings?.divergenceScanner?.timeframes);
      collect(scannerSettings?.macdReversalScanner?.timeframes);
      collect(scannerSettings?.rsiReversalScanner?.timeframes);
      collect(scannerSettings?.volumeSpikeScanner?.timeframes);
      collect(scannerSettings?.supportResistanceScanner?.timeframes);

      const tfMinIntervalMs: Record<string, number> = {
        '15m': 5 * 60 * 1000,
        '1h': 30 * 60 * 1000,
      };
      const tfBarMs: Record<string, number> = {
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
      };

      const lastFetchMap = { ...get().lastHigherTfFetch };
      const now = Date.now();

      for (const tf of enabledTfs) {
        const lastFetch = lastFetchMap[tf] ?? 0;
        if (now - lastFetch < tfMinIntervalMs[tf]) continue;

        for (const symbol of topSymbols) {
          const symbolName = symbol.name;
          if (candleStore.activeSymbol === symbolName) continue;

          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, staggerDelay));
          }

          const endTime = Date.now();
          const startTime = endTime - 1200 * tfBarMs[tf];

          candleStore.fetchCandles(symbolName, tf, startTime, endTime).catch(() => {});
          index++;
        }

        lastFetchMap[tf] = now;
      }

      set({
        lastCandlePollTime: Date.now(),
        isFirstCandleFetch: false,
        lastHigherTfFetch: lastFetchMap,
      });
    } catch {
      // swallow - next tick will retry
    } finally {
      set({ candleFetchInFlight: false });
    }
  },

  triggerSlowPoll: async () => {
    await get().fetchSlowData();
  },

  startGlobalPolling: () => {
    const { fastPollingInterval, slowPollingInterval, candlePollingInterval, fetchFastData, fetchSlowData, fetchCandleData } = get();

    if (fastPollingInterval || slowPollingInterval || candlePollingInterval) {
      return;
    }

    fetchFastData();
    fetchSlowData();
    fetchCandleData();

    const fastIntervalId = setInterval(() => {
      fetchFastData();
    }, 5000);

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

  pauseBackgroundPolling: () => {
    const { slowPollingInterval, candlePollingInterval } = get();
    const scannerRunning = useScannerStore.getState().status.isRunning;

    if (slowPollingInterval) {
      clearInterval(slowPollingInterval);
    }

    const updates: Partial<GlobalPollingStore> = {
      slowPollingInterval: null,
    };

    if (!scannerRunning && candlePollingInterval) {
      clearInterval(candlePollingInterval);
      updates.candlePollingInterval = null;
    }

    set(updates);
  },

  resumeBackgroundPolling: () => {
    const { service, slowPollingInterval, candlePollingInterval, fetchSlowData, fetchCandleData } = get();

    if (!service) {
      return;
    }

    const updates: Partial<GlobalPollingStore> = {};

    if (!slowPollingInterval) {
      fetchSlowData();
      updates.slowPollingInterval = setInterval(() => {
        fetchSlowData();
      }, 60000);
    }

    if (!candlePollingInterval) {
      fetchCandleData();
      updates.candlePollingInterval = setInterval(() => {
        fetchCandleData();
      }, 60000);
    }

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },
}));

if (typeof window !== 'undefined') {
  const cleanup = () => {
    const { stopGlobalPolling } = useGlobalPollingStore.getState();
    stopGlobalPolling();
  };

  window.addEventListener('beforeunload', cleanup);

  document.addEventListener('visibilitychange', () => {
    const { isPolling, pauseBackgroundPolling, resumeBackgroundPolling } = useGlobalPollingStore.getState();
    if (!isPolling) {
      return;
    }
    if (document.hidden) {
      pauseBackgroundPolling();
    } else {
      resumeBackgroundPolling();
    }
  });
}
