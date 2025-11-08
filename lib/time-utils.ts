import type { TimeInterval } from '@/types';
import { DEFAULT_CANDLE_COUNT, STANDARD_CANDLES } from '@/lib/constants';

export const INTERVAL_TO_MS: Record<TimeInterval, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
};

export function getCandleTimeWindow(interval: TimeInterval, candleCount: number = DEFAULT_CANDLE_COUNT): { startTime: number; endTime: number } {
  const endTime = Date.now();
  const intervalMs = INTERVAL_TO_MS[interval];
  const startTime = endTime - (candleCount * intervalMs);

  return { startTime, endTime };
}

export function getStandardTimeWindow(): { startTime: number; endTime: number } {
  return getCandleTimeWindow('1m', STANDARD_CANDLES);
}
