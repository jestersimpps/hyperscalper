import { create } from 'zustand';

interface TimeRange {
  from: number;
  to: number;
}

interface ChartSyncStore {
  visibleTimeRange: TimeRange | null;
  setVisibleTimeRange: (range: TimeRange | null) => void;
}

export const useChartSyncStore = create<ChartSyncStore>((set) => ({
  visibleTimeRange: null,
  setVisibleTimeRange: (range) => set({ visibleTimeRange: range }),
}));
