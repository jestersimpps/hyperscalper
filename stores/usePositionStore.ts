import { create } from 'zustand';
import { Position } from '@/models/Position';

interface PositionStore {
  positions: Record<string, Position | null>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  pollingIntervals: Record<string, NodeJS.Timeout>;
  batchPollingInterval: NodeJS.Timeout | null;
  batchPollingCoins: string[];

  fetchPosition: (coin: string) => Promise<void>;
  fetchAllPositions: (coins?: string[]) => Promise<void>;
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

  fetchPosition: async (coin: string) => {
    set((state) => ({
      loading: { ...state.loading, [coin]: true },
      errors: { ...state.errors, [coin]: null },
    }));

    try {
      const response = await fetch(`/api/positions?coin=${coin}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch position');
      }

      set((state) => ({
        positions: { ...state.positions, [coin]: data.position },
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
    const targetCoins = coins || get().batchPollingCoins;

    if (targetCoins.length === 0) return;

    const loadingState = targetCoins.reduce((acc, coin) => ({ ...acc, [coin]: true }), {});
    const errorState = targetCoins.reduce((acc, coin) => ({ ...acc, [coin]: null }), {});

    set((state) => ({
      loading: { ...state.loading, ...loadingState },
      errors: { ...state.errors, ...errorState },
    }));

    try {
      const response = await fetch('/api/positions');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch positions');
      }

      const positionMap: Record<string, Position | null> = {};
      const positionLoadingState: Record<string, boolean> = {};

      targetCoins.forEach(coin => {
        const position = data.positions.find((p: Position) => p.symbol === coin);
        positionMap[coin] = position || null;
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
