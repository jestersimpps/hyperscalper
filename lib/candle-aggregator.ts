import type { TransformedCandle } from '@/lib/services/types';

export function aggregate1mTo5m(candles1m: TransformedCandle[]): TransformedCandle[] {
  if (candles1m.length === 0) {
    return [];
  }

  const candles5m: TransformedCandle[] = [];

  for (let i = 0; i < candles1m.length; i += 5) {
    const chunk = candles1m.slice(i, i + 5);

    if (chunk.length === 0) continue;

    const aggregated: TransformedCandle = {
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    };

    candles5m.push(aggregated);
  }

  return candles5m;
}

export function aggregate15mTo1h(candles15m: TransformedCandle[]): TransformedCandle[] {
  if (candles15m.length === 0) {
    return [];
  }

  const candles1h: TransformedCandle[] = [];

  for (let i = 0; i < candles15m.length; i += 4) {
    const chunk = candles15m.slice(i, i + 4);

    if (chunk.length === 0) continue;

    const aggregated: TransformedCandle = {
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    };

    candles1h.push(aggregated);
  }

  return candles1h;
}
