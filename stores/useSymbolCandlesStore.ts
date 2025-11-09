import { create } from 'zustand';
import type { HyperliquidService } from '@/lib/services/hyperliquid.service';
import { downsampleCandles } from '@/lib/candle-utils';
import { useCandleStore } from './useCandleStore';

interface SymbolCandlesStore {
  closePrices: Record<string, number[]>;
  service: HyperliquidService | null;
  setService: (service: HyperliquidService) => void;
  fetchClosePrices: (symbols: string[]) => Promise<void>;
  getClosePrices: (symbol: string) => number[] | null;
}

export const useSymbolCandlesStore = create<SymbolCandlesStore>((set, get) => ({
  closePrices: {},
  service: null,

  setService: (service: HyperliquidService) => {
    set({ service });
  },

  fetchClosePrices: async (symbols: string[]) => {
    const { service } = get();
    if (!service) return;

    const candleStore = useCandleStore.getState();
    const newClosePrices: Record<string, number[]> = {};

    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          if (candleStore.isCacheFresh(symbol, '1m')) {
            const cachedClosePrices = candleStore.getClosePrices(symbol, '1m', 100);
            if (cachedClosePrices && cachedClosePrices.length > 0) {
              newClosePrices[symbol] = cachedClosePrices;
              return;
            }
          }

          const endTime = Date.now();
          const startTime = endTime - (150 * 60 * 1000);

          const candles = await service.getCandles({
            coin: symbol,
            interval: '1m',
            startTime,
            endTime
          });
          const closePrices = downsampleCandles(candles, 100);
          newClosePrices[symbol] = closePrices;
        } catch (error) {
          console.error(`Error fetching candles for ${symbol}:`, error);
        }
      })
    );

    set({ closePrices: newClosePrices });
  },

  getClosePrices: (symbol: string) => {
    return get().closePrices[symbol] || null;
  },
}));
