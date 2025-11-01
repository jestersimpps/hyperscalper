import type { CandleData } from '@/types';

export function calculateAverageCandleHeight(candles: CandleData[]): number {
  if (candles.length === 0) {
    return 0;
  }

  const last5Candles = candles.slice(-5);
  const heights = last5Candles.map(candle => candle.high - candle.low);
  const sum = heights.reduce((acc, height) => acc + height, 0);

  return sum / heights.length;
}
