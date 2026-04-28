import { create } from 'zustand';

interface LogicalRange {
  from: number;
  to: number;
}

interface ChartSyncStore {
  visibleLogicalRange: LogicalRange | null;
  setVisibleLogicalRange: (range: LogicalRange | null) => void;
}

export const useChartSyncStore = create<ChartSyncStore>((set) => ({
  visibleLogicalRange: null,
  setVisibleLogicalRange: (range) => set({ visibleLogicalRange: range }),
}));
