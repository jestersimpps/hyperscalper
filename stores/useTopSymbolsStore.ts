import { create } from 'zustand';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';

export interface SymbolWithVolume {
  name: string;
  volume: number;
}

interface TopSymbolsStore {
  symbols: SymbolWithVolume[];
  isLoading: boolean;
  error: string | null;
  service: HyperliquidService | null;
  setService: (service: HyperliquidService) => void;
  fetchTopSymbols: () => Promise<void>;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
}

export const useTopSymbolsStore = create<TopSymbolsStore>((set, get) => ({
  symbols: [],
  isLoading: false,
  error: null,
  service: null,

  setService: (service: HyperliquidService) => {
    set({ service });
  },

  fetchTopSymbols: async () => {
    const { service } = get();
    if (!service) {
      console.warn('Service not initialized yet, skipping top symbols fetch');
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const { meta, assetCtxs } = await service.getMetaAndAssetCtxs();

      const symbolsWithVolume: SymbolWithVolume[] = meta.universe
        .map((u, index) => ({
          name: u.name,
          volume: parseFloat(assetCtxs[index]?.dayNtlVlm || '0'),
          isDelisted: u.isDelisted,
        }))
        .filter((s) => !s.isDelisted)
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 20)
        .map(({ name, volume }) => ({ name, volume }));

      set({ symbols: symbolsWithVolume, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  startAutoRefresh: () => {
    get().fetchTopSymbols();
  },

  stopAutoRefresh: () => {
  },
}));
