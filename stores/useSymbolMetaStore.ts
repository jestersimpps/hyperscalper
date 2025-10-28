import { create } from 'zustand';

export interface SymbolMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
}

interface SymbolMetaStore {
  metadata: Record<string, SymbolMeta>;
  loading: boolean;
  error: string | null;
  fetchMetadata: () => Promise<void>;
  getDecimals: (symbol: string) => { price: number; size: number };
}

const DEFAULT_PRICE_DECIMALS = 2;
const DEFAULT_SIZE_DECIMALS = 4;

export const useSymbolMetaStore = create<SymbolMetaStore>((set, get) => ({
  metadata: {},
  loading: false,
  error: null,

  fetchMetadata: async () => {
    set({ loading: true, error: null });

    try {
      const response = await fetch('/api/meta');

      if (!response.ok) {
        throw new Error('Failed to fetch symbol metadata');
      }

      const data = await response.json();

      if (!data.universe || !Array.isArray(data.universe)) {
        throw new Error('Invalid metadata response');
      }

      const metadata: Record<string, SymbolMeta> = {};
      data.universe.forEach((symbol: SymbolMeta) => {
        metadata[symbol.name] = symbol;
      });

      set({ metadata, loading: false });
    } catch (error) {
      console.error('Error fetching symbol metadata:', error);
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      });
    }
  },

  getDecimals: (symbol: string) => {
    const { metadata } = get();
    const symbolMeta = metadata[symbol];
    const decimals = symbolMeta?.szDecimals ?? DEFAULT_SIZE_DECIMALS;

    return {
      price: decimals,
      size: decimals,
    };
  },
}));
