import { create } from 'zustand';
import { Position } from '@/models/Position';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';

function mapHyperliquidPosition(rawPosition: any): Position {
  const szi = parseFloat(rawPosition.position.szi);
  const entryPrice = parseFloat(rawPosition.position.entryPx || '0');
  const unrealizedPnl = parseFloat(rawPosition.position.unrealizedPnl || '0');
  const positionValue = parseFloat(rawPosition.position.positionValue || '0');
  const leverage = parseFloat(rawPosition.position.leverage?.value || '1');

  return {
    symbol: rawPosition.position.coin,
    side: szi > 0 ? 'long' : 'short',
    size: Math.abs(szi),
    entryPrice,
    currentPrice: positionValue !== 0 ? Math.abs(positionValue) / Math.abs(szi) : entryPrice,
    pnl: unrealizedPnl,
    pnlPercentage: positionValue !== 0 ? (unrealizedPnl / Math.abs(positionValue)) * 100 : 0,
    leverage,
  };
}

interface PositionStore {
  positions: Record<string, Position | null>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  pollingIntervals: Record<string, NodeJS.Timeout>;
  batchPollingInterval: NodeJS.Timeout | null;
  batchPollingCoins: string[];
  service: HyperliquidService | null;

  setService: (service: HyperliquidService) => void;
  fetchPosition: (coin: string) => Promise<void>;
  fetchAllPositions: (coins?: string[]) => Promise<void>;
  fetchAndStoreAllOpenPositions: () => Promise<string[]>;
  subscribeToPosition: (coin: string) => void;
  unsubscribeFromPosition: (coin: string) => void;
  startPolling: (coin: string, interval: number) => void;
  stopPolling: (coin: string) => void;
  startPollingMultiple: (coins: string[], interval?: number) => void;
  stopPollingMultiple: (coins: string[]) => void;
  getPosition: (coin: string) => Position | null;
}

export const usePositionStore = create<PositionStore>((set, get) => ({
  positions: {},
  loading: {},
  errors: {},
  pollingIntervals: {},
  batchPollingInterval: null,
  batchPollingCoins: [],
  service: null,

  setService: (service: HyperliquidService) => {
    set({ service });
  },

  fetchPosition: async (coin: string) => {
    const { service } = get();
    if (!service) {
      console.warn('Service not initialized yet, skipping position fetch');
      return;
    }

    set((state) => ({
      loading: { ...state.loading, [coin]: true },
      errors: { ...state.errors, [coin]: null },
    }));

    try {
      const allPositions = await service.getOpenPositions();
      const rawPosition = allPositions.find(p => p.position.coin === coin);

      const position = rawPosition ? mapHyperliquidPosition(rawPosition) : null;

      set((state) => ({
        positions: { ...state.positions, [coin]: position },
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

  fetchAllPositions: async (coins?: string[]) => {
    const { service } = get();
    if (!service) {
      console.warn('Service not initialized yet, skipping positions fetch');
      return;
    }

    const targetCoins = coins || get().batchPollingCoins;

    if (targetCoins.length === 0) return;

    const loadingState = targetCoins.reduce((acc, coin) => ({ ...acc, [coin]: true }), {});
    const errorState = targetCoins.reduce((acc, coin) => ({ ...acc, [coin]: null }), {});

    set((state) => ({
      loading: { ...state.loading, ...loadingState },
      errors: { ...state.errors, ...errorState },
    }));

    try {
      const allPositions = await service.getOpenPositions();

      const positionMap: Record<string, Position | null> = {};
      const positionLoadingState: Record<string, boolean> = {};

      targetCoins.forEach(coin => {
        const rawPosition = allPositions.find((p: any) => p.position.coin === coin);
        positionMap[coin] = rawPosition ? mapHyperliquidPosition(rawPosition) : null;
        positionLoadingState[coin] = false;
      });

      set((state) => ({
        positions: { ...state.positions, ...positionMap },
        loading: { ...state.loading, ...positionLoadingState },
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStateUpdate = targetCoins.reduce((acc, coin) => ({ ...acc, [coin]: errorMessage }), {});
      const loadingStateUpdate = targetCoins.reduce((acc, coin) => ({ ...acc, [coin]: false }), {});

      set((state) => ({
        loading: { ...state.loading, ...loadingStateUpdate },
        errors: { ...state.errors, ...errorStateUpdate },
      }));
    }
  },

  fetchAndStoreAllOpenPositions: async () => {
    const { service } = get();
    if (!service) {
      console.warn('Service not initialized yet, skipping open positions fetch');
      return [];
    }

    try {
      const allPositions = await service.getOpenPositions();
      const positionMap: Record<string, Position | null> = {};
      const symbols: string[] = [];

      allPositions.forEach((rawPosition: any) => {
        const position = mapHyperliquidPosition(rawPosition);
        positionMap[position.symbol] = position;
        symbols.push(position.symbol);
      });

      set((state) => ({
        positions: { ...state.positions, ...positionMap },
      }));

      return symbols;
    } catch (error) {
      console.error('Failed to fetch open positions:', error);
      return [];
    }
  },

  startPolling: (coin: string, interval: number = 5000) => {
    const { stopPolling, fetchPosition, pollingIntervals } = get();

    if (pollingIntervals[coin]) {
      stopPolling(coin);
    }

    fetchPosition(coin);

    const intervalId = setInterval(() => {
      fetchPosition(coin);
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

  subscribeToPosition: (coin: string) => {
    const { batchPollingCoins, startPolling } = get();

    if (batchPollingCoins.includes(coin)) {
      return;
    }

    startPolling(coin, 5000);
  },

  unsubscribeFromPosition: (coin: string) => {
    const { stopPolling } = get();
    stopPolling(coin);
  },

  startPollingMultiple: (coins: string[], interval: number = 5000) => {
    const { batchPollingInterval, fetchAllPositions } = get();

    if (batchPollingInterval) {
      clearInterval(batchPollingInterval);
    }

    set({ batchPollingCoins: coins });

    fetchAllPositions(coins);

    const intervalId = setInterval(() => {
      fetchAllPositions(coins);
    }, interval);

    set({ batchPollingInterval: intervalId });
  },

  stopPollingMultiple: (coins: string[]) => {
    const { batchPollingInterval } = get();

    if (batchPollingInterval) {
      clearInterval(batchPollingInterval);
      set({ batchPollingInterval: null, batchPollingCoins: [] });
    }
  },

  getPosition: (coin: string) => {
    return get().positions[coin] || null;
  },
}));
