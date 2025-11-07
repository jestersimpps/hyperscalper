import { create } from 'zustand';
import type { UserFill } from '@/types';
import type { HyperliquidService } from '@/lib/services/hyperliquid.service';

interface UserFillsStore {
  fills: UserFill[];
  loading: boolean;
  error: string | null;
  service: HyperliquidService | null;

  setService: (service: HyperliquidService) => void;
  fetchTodaysFills: () => Promise<void>;
  fetchFillsByTime: (startTime: number, endTime?: number) => Promise<void>;
  clearFills: () => void;
}

const getTodayTimestamps = (): { startTime: number; endTime: number } => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  return {
    startTime: startOfToday.getTime(),
    endTime: now.getTime()
  };
};

export const useUserFillsStore = create<UserFillsStore>((set, get) => ({
  fills: [],
  loading: false,
  error: null,
  service: null,

  setService: (service) => {
    set({ service });
  },

  fetchTodaysFills: async () => {
    const { service } = get();
    if (!service) {
      set({ error: 'Service not initialized' });
      return;
    }

    set({ loading: true, error: null });

    try {
      const { startTime, endTime } = getTodayTimestamps();
      const fills = await service.getUserFillsByTime(startTime, endTime);

      set({
        fills: fills.sort((a, b) => b.time - a.time),
        loading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch fills',
        loading: false
      });
    }
  },

  fetchFillsByTime: async (startTime: number, endTime?: number) => {
    const { service } = get();
    if (!service) {
      set({ error: 'Service not initialized' });
      return;
    }

    set({ loading: true, error: null });

    try {
      const fills = await service.getUserFillsByTime(startTime, endTime);

      set({
        fills: fills.sort((a, b) => b.time - a.time),
        loading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch fills',
        loading: false
      });
    }
  },

  clearFills: () => {
    set({ fills: [], error: null });
  }
}));
