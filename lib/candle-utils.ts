import type { TransformedCandle } from './services/types';

export function downsampleCandles(candles: TransformedCandle[], targetPoints: number): number[] {
  if (candles.length === 0) {
    return [];
  }

  if (candles.length <= targetPoints) {
    return candles.map(c => c.close);
  }

  const step = candles.length / targetPoints;
  const result: number[] = [];

  for (let i = 0; i < targetPoints; i++) {
    const index = Math.floor(i * step);
    result.push(candles[index].close);
  }

  return result;
}

export function invertCandles<T extends { time: number; open: number; high: number; low: number; close: number }>(
  candles: T[],
  invertedMode: boolean
): T[] {
  if (!invertedMode || candles.length === 0) {
    return candles;
  }

  const referencePrice = candles[0].close;

  return candles.map(candle => ({
    ...candle,
    open: 2 * referencePrice - candle.open,
    high: 2 * referencePrice - candle.low,
    low: 2 * referencePrice - candle.high,
    close: 2 * referencePrice - candle.close,
  }));
}
