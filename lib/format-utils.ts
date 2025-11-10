import type { CandleData, Trade } from '@/types';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';

export const formatPrice = (value: number, decimals: number): string => {
  if (value === undefined || value === null) {
    return '0';
  }
  return parseFloat(value.toFixed(decimals)).toString();
};

export const formatSize = (value: number, decimals: number): string => {
  return value.toFixed(decimals);
};

export const formatCandle = (
  candle: Omit<CandleData, 'openFormatted' | 'highFormatted' | 'lowFormatted' | 'closeFormatted' | 'volumeFormatted'>,
  coin: string
): CandleData => {
  const decimals = useSymbolMetaStore.getState().getDecimals(coin);

  return {
    ...candle,
    openFormatted: formatPrice(candle.open, decimals.price),
    highFormatted: formatPrice(candle.high, decimals.price),
    lowFormatted: formatPrice(candle.low, decimals.price),
    closeFormatted: formatPrice(candle.close, decimals.price),
    volumeFormatted: formatSize(candle.volume, decimals.size),
  };
};

export const formatTrade = (
  trade: Omit<Trade, 'priceFormatted' | 'sizeFormatted'>,
  coin: string
): Trade => {
  const decimals = useSymbolMetaStore.getState().getDecimals(coin);
  return {
    ...trade,
    priceFormatted: formatPrice(trade.price, decimals.price),
    sizeFormatted: formatSize(trade.size, decimals.size),
  };
};

export const formatPnlSchmeckles = (
  pnl: number,
  positionValue: number,
  accountValue?: number
): string => {
  if (pnl === undefined || pnl === null) {
    return '+- SH';
  }

  let divisor: number;
  if (accountValue !== undefined && accountValue !== null && accountValue > 0) {
    divisor = accountValue;
  } else {
    if (positionValue === undefined || positionValue === null || positionValue === 0) {
      return '+- SH';
    }
    divisor = positionValue;
  }

  const schmeckles = (pnl / divisor) * 2000;
  return `${schmeckles >= 0 ? '+' : ''}${schmeckles.toFixed(2)} SH`;
};
