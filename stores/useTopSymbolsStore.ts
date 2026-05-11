import { create } from 'zustand';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';
import { useGlobalPollingStore } from './useGlobalPollingStore';
import type { PerpsMeta } from '@nktkas/hyperliquid';
import type { AssetCtx } from '@/lib/services/types';

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
  refreshTopSymbols: () => Promise<void>;
  updateFromGlobalPoll: (data: { meta: PerpsMeta; assetCtxs: AssetCtx[] }) => void;
}

export const useTopSymbolsStore = create<TopSymbolsStore>((set) => ({
  symbols: [],
  isLoading: false,
  error: null,
  service: null,

  setService: (service: HyperliquidService) => {
    set({ service });
  },

  refreshTopSymbols: async () => {
    set({ isLoading: true, error: null });
    try {
      await useGlobalPollingStore.getState().triggerSlowPoll();
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  updateFromGlobalPoll: (data: { meta: PerpsMeta; assetCtxs: AssetCtx[] }) => {
    const { meta, assetCtxs } = data;

    const symbolsWithVolume: SymbolWithVolume[] = meta.universe
      .map((u, index) => ({
        name: u.name,
        volume: parseFloat(assetCtxs[index]?.dayNtlVlm || '0'),
        isDelisted: u.isDelisted ?? false,
      }))
      .filter((s) => !s.isDelisted)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20)
      .map(({ name, volume }) => ({ name, volume }));

    set({ symbols: symbolsWithVolume });
  },
}));
