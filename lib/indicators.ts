import type { CandleData as FullCandleData } from '@/types';

export interface Pivot {
  index: number;
  price: number;
  type: 'high' | 'low';
  time: number;
}

export interface Channel {
  type: 'horizontal' | 'ascending' | 'descending';
  upperLine: { slope: number; intercept: number };
  lowerLine: { slope: number; intercept: number };
  pivots: Pivot[];
  touches: number;
  strength: number;
  angle: number;
  startIndex: number;
  endIndex: number;
}

export function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const emaArray: number[] = [];

  if (data.length === 0) return emaArray;

  let ema = data[0];
  emaArray.push(ema);

  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    emaArray.push(ema);
  }

  return emaArray;
}

export interface MacdResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function calculateMACD(
  data: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): MacdResult {
  if (data.length === 0) {
    return { macd: [], signal: [], histogram: [] };
  }

  const fastEma = calculateEMA(data, fastPeriod);
  const slowEma = calculateEMA(data, slowPeriod);

  const macdLine = fastEma.map((fast, i) => fast - slowEma[i]);

  const signalLine = calculateEMA(macdLine, signalPeriod);

  const histogram = macdLine.map((macd, i) => macd - signalLine[i]);

  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram,
  };
}

export interface StochasticData {
  k: number;
  d: number;
}

interface CandleData {
  high: number;
  low: number;
  close: number;
}

export interface EmaAlignment {
  type: 'bullish' | 'bearish';
  barsAgo: number;
  ema1: number;
  ema2: number;
  ema3: number;
}

export function calculateStochastic(
  candles: CandleData[],
  period: number = 14,
  smoothK: number = 3,
  smoothD: number = 3
): StochasticData[] {
  if (!candles || candles.length < period) return [];

  const validCandles = candles.filter(
    (c) => c && typeof c.high === 'number' && typeof c.low === 'number' && typeof c.close === 'number'
  );
  if (validCandles.length < period) return [];

  const result: StochasticData[] = [];
  const kValues: number[] = [];

  for (let i = period - 1; i < validCandles.length; i++) {
    const slice = validCandles.slice(i - period + 1, i + 1);
    if (slice.length !== period) continue;

    const high = Math.max(...slice.map((c) => c.high));
    const low = Math.min(...slice.map((c) => c.low));
    const close = validCandles[i].close;

    const k = high === low ? 50 : ((close - low) / (high - low)) * 100;
    kValues.push(k);
  }

  const smoothedK: number[] = [];
  for (let i = smoothK - 1; i < kValues.length; i++) {
    const sum = kValues.slice(i - smoothK + 1, i + 1).reduce((a, b) => a + b, 0);
    smoothedK.push(sum / smoothK);
  }

  for (let i = smoothD - 1; i < smoothedK.length; i++) {
    const sum = smoothedK.slice(i - smoothD + 1, i + 1).reduce((a, b) => a + b, 0);
    const d = sum / smoothD;
    result.push({
      k: smoothedK[i],
      d: d,
    });
  }

  return result;
}

export function detectEmaAlignment(
  candles: CandleData[],
  period1: number,
  period2: number,
  period3: number,
  lookbackBars: number
): EmaAlignment | null {
  if (!candles || candles.length < Math.max(period1, period2, period3) + lookbackBars) {
    return null;
  }

  const closes = candles.map((c) => c.close);

  const ema1 = calculateEMA(closes, period1);
  const ema2 = calculateEMA(closes, period2);
  const ema3 = calculateEMA(closes, period3);

  if (ema1.length === 0 || ema2.length === 0 || ema3.length === 0) {
    return null;
  }

  const lastIndex = ema1.length - 1;

  const isCurrentlyBullish = ema1[lastIndex] > ema2[lastIndex] && ema2[lastIndex] > ema3[lastIndex];
  const isCurrentlyBearish = ema1[lastIndex] < ema2[lastIndex] && ema2[lastIndex] < ema3[lastIndex];

  if (!isCurrentlyBullish && !isCurrentlyBearish) {
    return null;
  }

  for (let barsAgo = 0; barsAgo <= lookbackBars; barsAgo++) {
    const index = lastIndex - barsAgo;

    if (index < 0) break;

    const isBullish = ema1[index] > ema2[index] && ema2[index] > ema3[index];
    const isBearish = ema1[index] < ema2[index] && ema2[index] < ema3[index];

    if (barsAgo === 0) {
      if (isBullish || isBearish) {
        if (index > 0) {
          const prevBullish = ema1[index - 1] > ema2[index - 1] && ema2[index - 1] > ema3[index - 1];
          const prevBearish = ema1[index - 1] < ema2[index - 1] && ema2[index - 1] < ema3[index - 1];

          if ((isBullish && !prevBullish) || (isBearish && !prevBearish)) {
            return {
              type: isBullish ? 'bullish' : 'bearish',
              barsAgo: 0,
              ema1: ema1[lastIndex],
              ema2: ema2[lastIndex],
              ema3: ema3[lastIndex],
            };
          }
        }
      }
      continue;
    }

    if (index > 0) {
      const prevIndex = index - 1;
      const currentBullish = ema1[index] > ema2[index] && ema2[index] > ema3[index];
      const currentBearish = ema1[index] < ema2[index] && ema2[index] < ema3[index];
      const prevBullish = ema1[prevIndex] > ema2[prevIndex] && ema2[prevIndex] > ema3[prevIndex];
      const prevBearish = ema1[prevIndex] < ema2[prevIndex] && ema2[prevIndex] < ema3[prevIndex];

      if ((currentBullish && !prevBullish) || (currentBearish && !prevBearish)) {
        return {
          type: currentBullish ? 'bullish' : 'bearish',
          barsAgo,
          ema1: ema1[lastIndex],
          ema2: ema2[lastIndex],
          ema3: ema3[lastIndex],
        };
      }
    }
  }

  return null;
}

export function detectPivots(candles: FullCandleData[], pivotStrength: number = 3): Pivot[] {
  const pivots: Pivot[] = [];

  if (candles.length < pivotStrength * 2 + 1) {
    return pivots;
  }

  for (let i = pivotStrength; i < candles.length - pivotStrength; i++) {
    const candle = candles[i];

    let isPivotHigh = true;
    for (let j = 1; j <= pivotStrength; j++) {
      if (candles[i - j].high >= candle.high || candles[i + j].high >= candle.high) {
        isPivotHigh = false;
        break;
      }
    }

    if (isPivotHigh) {
      pivots.push({
        index: i,
        price: candle.high,
        type: 'high',
        time: candle.time,
      });
    }

    let isPivotLow = true;
    for (let j = 1; j <= pivotStrength; j++) {
      if (candles[i - j].low <= candle.low || candles[i + j].low <= candle.low) {
        isPivotLow = false;
        break;
      }
    }

    if (isPivotLow) {
      pivots.push({
        index: i,
        price: candle.low,
        type: 'low',
        time: candle.time,
      });
    }
  }

  return pivots;
}

export function detectChannels(
  candles: FullCandleData[],
  params: {
    pivotStrength?: number;
    lookbackBars?: number;
    minTouches?: number;
  } = {}
): Channel[] {
  const { pivotStrength = 3, lookbackBars = 50, minTouches = 3 } = params;

  if (candles.length < lookbackBars) {
    return [];
  }

  const recentCandles = candles.slice(-lookbackBars);
  const pivots = detectPivots(recentCandles, pivotStrength);

  if (pivots.length < minTouches * 2) {
    return [];
  }

  const channels: Channel[] = [];

  const highs = pivots.filter((p) => p.type === 'high');
  const lows = pivots.filter((p) => p.type === 'low');

  if (highs.length >= minTouches && lows.length >= minTouches) {
    for (let i = 0; i < highs.length - 1; i++) {
      for (let j = i + 1; j < highs.length; j++) {
        const high1 = highs[i];
        const high2 = highs[j];

        const upperSlope = (high2.price - high1.price) / (high2.index - high1.index);
        const upperIntercept = high1.price - upperSlope * high1.index;

        for (let k = 0; k < lows.length - 1; k++) {
          for (let l = k + 1; l < lows.length; l++) {
            const low1 = lows[k];
            const low2 = lows[l];

            const lowerSlope = (low2.price - low1.price) / (low2.index - low1.index);
            const lowerIntercept = low1.price - lowerSlope * low1.index;

            const slopeDiff = Math.abs(upperSlope - lowerSlope);
            const avgSlope = (Math.abs(upperSlope) + Math.abs(lowerSlope)) / 2;
            const slopeTolerance = avgSlope * 0.2;

            if (slopeDiff <= slopeTolerance || (avgSlope < 0.0001 && slopeDiff < 0.0001)) {
              let touchCount = 0;
              const channelPivots: Pivot[] = [];

              for (const pivot of pivots) {
                const expectedUpper = upperSlope * pivot.index + upperIntercept;
                const expectedLower = lowerSlope * pivot.index + lowerIntercept;

                const upperDiff = Math.abs(pivot.price - expectedUpper) / pivot.price;
                const lowerDiff = Math.abs(pivot.price - expectedLower) / pivot.price;

                if (upperDiff < 0.005 || lowerDiff < 0.005) {
                  touchCount++;
                  channelPivots.push(pivot);
                }
              }

              if (touchCount >= minTouches) {
                const angle = Math.atan(upperSlope) * (180 / Math.PI);

                let channelType: 'horizontal' | 'ascending' | 'descending';
                if (Math.abs(angle) < 5) {
                  channelType = 'horizontal';
                } else if (angle > 0) {
                  channelType = 'ascending';
                } else {
                  channelType = 'descending';
                }

                const startIndex = Math.min(high1.index, high2.index, low1.index, low2.index);
                const endIndex = Math.max(high1.index, high2.index, low1.index, low2.index);

                channels.push({
                  type: channelType,
                  upperLine: { slope: upperSlope, intercept: upperIntercept },
                  lowerLine: { slope: lowerSlope, intercept: lowerIntercept },
                  pivots: channelPivots,
                  touches: touchCount,
                  strength: touchCount / pivots.length,
                  angle,
                  startIndex,
                  endIndex,
                });
              }
            }
          }
        }
      }
    }
  }

  return channels.sort((a, b) => b.strength - a.strength || b.touches - a.touches);
}

export type StochasticZone = 'overbought' | 'oversold' | 'neutral';

export function getStochasticZone(
  kValue: number,
  overboughtLevel: number,
  oversoldLevel: number
): StochasticZone {
  if (kValue >= overboughtLevel) return 'overbought';
  if (kValue <= oversoldLevel) return 'oversold';
  return 'neutral';
}

export type TrendDirection = 'up' | 'down';

export function getStochasticTrend(kValue: number, dValue: number): TrendDirection {
  return kValue > dValue ? 'up' : 'down';
}

export function getMacdTrend(macdValue: number, signalValue: number): TrendDirection {
  return macdValue > signalValue ? 'up' : 'down';
}

export interface VolumeFlowResult {
  netVolume: number;
  buyVolume: number;
  sellVolume: number;
  trend: TrendDirection;
}

export interface Trade {
  price: number;
  qty: number;
  isBuyerMaker: boolean;
  time: number;
}

export function calculateVolumeFlow(trades: Trade[], periodSeconds: number = 60): VolumeFlowResult {
  if (!trades || trades.length === 0) {
    return { netVolume: 0, buyVolume: 0, sellVolume: 0, trend: 'down' };
  }

  const now = Date.now();
  const cutoffTime = now - periodSeconds * 1000;

  const recentTrades = trades.filter((t) => t.time >= cutoffTime);

  let buyVolume = 0;
  let sellVolume = 0;

  recentTrades.forEach((trade) => {
    const volume = trade.price * trade.qty;
    if (trade.isBuyerMaker) {
      sellVolume += volume;
    } else {
      buyVolume += volume;
    }
  });

  const netVolume = buyVolume - sellVolume;

  return {
    netVolume,
    buyVolume,
    sellVolume,
    trend: netVolume >= 0 ? 'up' : 'down',
  };
}
