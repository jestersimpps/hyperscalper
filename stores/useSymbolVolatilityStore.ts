import { create } from 'zustand';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';

interface VolatilityData {
  blocks: number;
  percentChange: number;
  currentPrice: number;
  prevDayPrice: number;
  lastUpdate: number;
}

interface SymbolVolatilityStore {
  volatility: Record<string, VolatilityData>;
  subscribedSymbols: Set<string>;
  service: HyperliquidService | null;

  setService: (service: HyperliquidService) => void;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
  getVolatility: (symbol: string) => VolatilityData | null;
  fetchAllVolatility: () => Promise<void>;
}

const calculateBlocksFromPercentChange = (percentChange: number): number => {
  const absChange = Math.abs(percentChange);

  if (absChange >= 6) return 10;
  if (absChange >= 5) return 9;
  if (absChange >= 4) return 8;
  if (absChange >= 3.5) return 7;
  if (absChange >= 3) return 6;
  if (absChange >= 2.5) return 5;
  if (absChange >= 2) return 4;
  if (absChange >= 1.5) return 3;
  if (absChange >= 1) return 2;
  if (absChange >= 0.5) return 1;

  return 0;
};

export const useSymbolVolatilityStore = create<SymbolVolatilityStore>((set, get) => ({
  volatility: {},
  subscribedSymbols: new Set(),
  service: null,

  setService: (service: HyperliquidService) => {
    set({ service });
  },

  subscribe: (symbols: string[]) => {
    const { subscribedSymbols } = get();
    const newSymbols = symbols.filter(s => !subscribedSymbols.has(s));

    if (newSymbols.length === 0) return;

    set((state) => ({
      subscribedSymbols: new Set([...state.subscribedSymbols, ...newSymbols])
    }));

    get().fetchAllVolatility();
  },

  unsubscribe: (symbols: string[]) => {
    set((state) => {
      const newSubscribed = new Set(state.subscribedSymbols);
      symbols.forEach(s => newSubscribed.delete(s));
      return { subscribedSymbols: newSubscribed };
    });
  },

  getVolatility: (symbol: string) => {
    return get().volatility[symbol] || null;
  },

  fetchAllVolatility: async () => {
    const { service, subscribedSymbols } = get();

    if (!service || subscribedSymbols.size === 0) {
      return;
    }

    try {
      const { meta, assetCtxs } = await service.getMetaAndAssetCtxs();

      const newVolatility: Record<string, VolatilityData> = {};

      meta.universe.forEach((universeItem, index) => {
        const symbol = universeItem.name;

        if (!subscribedSymbols.has(symbol)) {
          return;
        }

        const assetCtx = assetCtxs[index];
        if (!assetCtx) {
          return;
        }

        const currentPrice = parseFloat(assetCtx.markPx);
        const prevDayPrice = parseFloat(assetCtx.prevDayPx);

        if (!currentPrice || !prevDayPrice || prevDayPrice === 0) {
          newVolatility[symbol] = {
            blocks: 0,
            percentChange: 0,
            currentPrice: currentPrice || 0,
            prevDayPrice: prevDayPrice || 0,
            lastUpdate: Date.now()
          };
          return;
        }

        const percentChange = ((currentPrice - prevDayPrice) / prevDayPrice) * 100;
        const blocks = calculateBlocksFromPercentChange(percentChange);

        newVolatility[symbol] = {
          blocks,
          percentChange,
          currentPrice,
          prevDayPrice,
          lastUpdate: Date.now()
        };
      });

      set((state) => ({
        volatility: { ...state.volatility, ...newVolatility }
      }));
    } catch (error) {
      console.error('[SymbolVolatilityStore] Error fetching volatility:', error);
    }
  },
}));

if (typeof window !== 'undefined') {
  setInterval(() => {
    const { fetchAllVolatility, subscribedSymbols } = useSymbolVolatilityStore.getState();
    if (subscribedSymbols.size > 0) {
      fetchAllVolatility();
    }
  }, 30000);
}
