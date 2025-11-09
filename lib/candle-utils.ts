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
