import { create } from 'zustand';
import { useSymbolMetaStore } from './useSymbolMetaStore';

export interface SymbolWithVolume {
  name: string;
  volume: number;
}

interface TopSymbolsStore {
  symbols: SymbolWithVolume[];
  isLoading: boolean;
  error: string | null;
  fetchTopSymbols: () => void;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
}

export const useTopSymbolsStore = create<TopSymbolsStore>((set, get) => ({
  symbols: [],
  isLoading: false,
  error: null,

  fetchTopSymbols: () => {
    const metadata = useSymbolMetaStore.getState().metadata;
    const symbols = Object.keys(metadata).map(name => ({
      name,
      volume: 0
    }));
    set({ symbols, isLoading: false, error: null });
  },

  startAutoRefresh: () => {
    get().fetchTopSymbols();
  },

  stopAutoRefresh: () => {
  },
}));
