import { create } from 'zustand';

export interface SymbolWithVolume {
  name: string;
  volume: number;
}

interface TopSymbolsStore {
  symbols: SymbolWithVolume[];
  isLoading: boolean;
  error: string | null;
  intervalId: ReturnType<typeof setInterval> | null;
  fetchTopSymbols: () => Promise<void>;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const useTopSymbolsStore = create<TopSymbolsStore>((set, get) => ({
  symbols: [],
  isLoading: false,
  error: null,
  intervalId: null,

  fetchTopSymbols: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/top-symbols');

      if (!response.ok) {
        throw new Error('Failed to fetch top symbols');
      }

      const data = await response.json();
      set({ symbols: data, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Unknown error',
        isLoading: false,
      });
      console.error('[TopSymbolsStore] Error:', err);
    }
  },

  startAutoRefresh: () => {
    const { intervalId, fetchTopSymbols } = get();

    if (intervalId) {
      console.log('[TopSymbolsStore] Auto-refresh already running');
      return;
    }

    console.log('[TopSymbolsStore] Starting auto-refresh');
    fetchTopSymbols();

    const newIntervalId = setInterval(() => {
      fetchTopSymbols();
    }, REFRESH_INTERVAL);

    set({ intervalId: newIntervalId });
  },

  stopAutoRefresh: () => {
    const { intervalId } = get();

    if (intervalId) {
      console.log('[TopSymbolsStore] Stopping auto-refresh');
      clearInterval(intervalId);
      set({ intervalId: null });
    }
  },
}));
