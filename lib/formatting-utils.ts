import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';

export const formatPrice = (price: number, symbol: string): string => {
  const decimals = useSymbolMetaStore.getState().getDecimals(symbol);
  return price.toFixed(decimals.price);
};

export const formatSize = (size: number, symbol: string): string => {
  const decimals = useSymbolMetaStore.getState().getDecimals(symbol);
  return size.toFixed(decimals.size);
};

export const formatTotal = (total: number, symbol: string): string => {
  const decimals = useSymbolMetaStore.getState().getDecimals(symbol);
  return total.toFixed(decimals.size);
};
