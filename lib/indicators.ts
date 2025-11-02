import type { CandleData as FullCandleData } from '@/types';
import { createMemoizedFunction, createCandleBasedMemoization } from './memoization';

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

export interface StochasticPivot {
  index: number;
  value: number;
  type: 'high' | 'low';
  time: number;
}

export interface DivergencePoint {
  type: 'bullish' | 'bearish' | 'hidden-bullish' | 'hidden-bearish';
  startTime: number;
  endTime: number;
  startPriceValue: number;
  endPriceValue: number;
  startStochValue: number;
  endStochValue: number;
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

export type MacdTurnPoint = 'topped' | 'bottomed' | null;

export function detectMacdTurnPoint(histogram: number[]): MacdTurnPoint {
  if (histogram.length < 3) return null;

  const idx = histogram.length - 1;
  const curr = histogram[idx];
  const prev = histogram[idx - 1];
  const prev2 = histogram[idx - 2];

  if (prev2 < prev && prev > curr) return 'topped';

  if (prev2 > prev && prev < curr) return 'bottomed';

  return null;
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

export function detectStochasticPivots(
  stochData: Array<{ k: number; d: number }>,
  candles: FullCandleData[],
  pivotStrength: number = 3
): StochasticPivot[] {
  const pivots: StochasticPivot[] = [];

  if (stochData.length < pivotStrength * 2 + 1 || candles.length !== stochData.length) {
    return pivots;
  }

  for (let i = pivotStrength; i < stochData.length - pivotStrength; i++) {
    const currentStoch = stochData[i];

    let isPivotHigh = true;
    for (let j = 1; j <= pivotStrength; j++) {
      if (stochData[i - j].d >= currentStoch.d || stochData[i + j].d >= currentStoch.d) {
        isPivotHigh = false;
        break;
      }
    }

    if (isPivotHigh) {
      pivots.push({
        index: i,
        value: currentStoch.d,
        type: 'high',
        time: candles[i].time,
      });
    }

    let isPivotLow = true;
    for (let j = 1; j <= pivotStrength; j++) {
      if (stochData[i - j].d <= currentStoch.d || stochData[i + j].d <= currentStoch.d) {
        isPivotLow = false;
        break;
      }
    }

    if (isPivotLow) {
      pivots.push({
        index: i,
        value: currentStoch.d,
        type: 'low',
        time: candles[i].time,
      });
    }
  }

  return pivots;
}

export function detectDivergence(
  pricePivots: Pivot[],
  stochPivots: StochasticPivot[],
  candles: FullCandleData[]
): DivergencePoint[] {
  const divergences: DivergencePoint[] = [];

  const highs = pricePivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);
  const lows = pricePivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const stochHighs = stochPivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);
  const stochLows = stochPivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);

  for (let i = 1; i < highs.length; i++) {
    const prevHigh = highs[i - 1];
    const currHigh = highs[i];

    const prevStochHigh = stochHighs.find(sh => Math.abs(sh.index - prevHigh.index) <= 2);
    const currStochHigh = stochHighs.find(sh => Math.abs(sh.index - currHigh.index) <= 2);

    if (prevStochHigh && currStochHigh) {
      if (currHigh.price > prevHigh.price && currStochHigh.value < prevStochHigh.value) {
        divergences.push({
          type: 'bearish',
          startTime: prevHigh.time,
          endTime: currHigh.time,
          startPriceValue: prevHigh.price,
          endPriceValue: currHigh.price,
          startStochValue: prevStochHigh.value,
          endStochValue: currStochHigh.value,
        });
      }

      if (currHigh.price < prevHigh.price && currStochHigh.value > prevStochHigh.value) {
        divergences.push({
          type: 'hidden-bearish',
          startTime: prevHigh.time,
          endTime: currHigh.time,
          startPriceValue: prevHigh.price,
          endPriceValue: currHigh.price,
          startStochValue: prevStochHigh.value,
          endStochValue: currStochHigh.value,
        });
      }
    }
  }

  for (let i = 1; i < lows.length; i++) {
    const prevLow = lows[i - 1];
    const currLow = lows[i];

    const prevStochLow = stochLows.find(sl => Math.abs(sl.index - prevLow.index) <= 2);
    const currStochLow = stochLows.find(sl => Math.abs(sl.index - currLow.index) <= 2);

    if (prevStochLow && currStochLow) {
      if (currLow.price < prevLow.price && currStochLow.value > prevStochLow.value) {
        divergences.push({
          type: 'bullish',
          startTime: prevLow.time,
          endTime: currLow.time,
          startPriceValue: prevLow.price,
          endPriceValue: currLow.price,
          startStochValue: prevStochLow.value,
          endStochValue: currStochLow.value,
        });
      }

      if (currLow.price > prevLow.price && currStochLow.value < prevStochLow.value) {
        divergences.push({
          type: 'hidden-bullish',
          startTime: prevLow.time,
          endTime: currLow.time,
          startPriceValue: prevLow.price,
          endPriceValue: currLow.price,
          startStochValue: prevStochLow.value,
          endStochValue: currStochLow.value,
        });
      }
    }
  }

  return divergences;
}

export interface TrendlinePoint {
  time: number;
  value: number;
}

export interface TrendlineWithStyle {
  points: TrendlinePoint[];
  lineStyle: number;
}

export interface Trendlines {
  supportLine: TrendlineWithStyle[];
  resistanceLine: TrendlineWithStyle[];
}

interface PivotPoint {
  time: number;
  price: number;
  index: number;
}

interface LineEquation {
  slope: number;
  intercept: number;
}

interface ScoredLine {
  equation: LineEquation;
  score: number;
  touches: number;
  violations: number;
}

interface Point {
  x: number;
  y: number;
}

interface Line {
  start: Point;
  end: Point;
  strength: number;
}

function findPivotLows(candles: FullCandleData[], window: number = 3): PivotPoint[] {
  const pivots: PivotPoint[] = [];
  const halfWindow = Math.floor(window / 2);

  for (let i = halfWindow; i < candles.length - halfWindow; i++) {
    const candle = candles[i];
    let isPivot = true;

    for (let j = i - halfWindow; j <= i + halfWindow; j++) {
      if (j !== i && candles[j].low <= candle.low) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      pivots.push({
        time: candle.time,
        price: candle.low,
        index: i
      });
    }
  }

  return pivots;
}

function findPivotHighs(candles: FullCandleData[], window: number = 3): PivotPoint[] {
  const pivots: PivotPoint[] = [];
  const halfWindow = Math.floor(window / 2);

  for (let i = halfWindow; i < candles.length - halfWindow; i++) {
    const candle = candles[i];
    let isPivot = true;

    for (let j = i - halfWindow; j <= i + halfWindow; j++) {
      if (j !== i && candles[j].high >= candle.high) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      pivots.push({
        time: candle.time,
        price: candle.high,
        index: i
      });
    }
  }

  return pivots;
}

function calculateLineEquation(p1: PivotPoint, p2: PivotPoint): LineEquation {
  const slope = (p2.price - p1.price) / (p2.time - p1.time);
  const intercept = p1.price - slope * p1.time;
  return { slope, intercept };
}

function getLineValue(line: LineEquation, time: number): number {
  return line.slope * time + line.intercept;
}

function validateSupportLine(line: LineEquation, candles: FullCandleData[], threshold: number): { violations: number; touches: number } {
  let violations = 0;
  let touches = 0;

  candles.forEach(candle => {
    const lineValue = getLineValue(line, candle.time);
    const diff = Math.abs(candle.low - lineValue) / lineValue;

    // Support line should be below candles (0.2% tolerance for minor wicks)
    if (candle.low < lineValue * 0.998) {
      violations++;
    } else if (diff < threshold) {
      touches++;
    }
  });

  return { violations, touches };
}

function validateResistanceLine(line: LineEquation, candles: FullCandleData[], threshold: number): { violations: number; touches: number } {
  let violations = 0;
  let touches = 0;

  candles.forEach(candle => {
    const lineValue = getLineValue(line, candle.time);
    const diff = Math.abs(candle.high - lineValue) / lineValue;

    // Resistance line should be above candles (0.2% tolerance for minor wicks)
    if (candle.high > lineValue * 1.002) {
      violations++;
    } else if (diff < threshold) {
      touches++;
    }
  });

  return { violations, touches };
}

function scoreTrendline(touches: number, violations: number, slope: number): number {
  let score = touches * 10;
  score -= violations * 100;
  score += Math.abs(slope) * 5;
  return score;
}

function findBestEnvelopeLine(
  pivots: PivotPoint[],
  candles: FullCandleData[],
  isSupport: boolean,
  threshold: number = 0.003
): TrendlinePoint[] {
  if (pivots.length < 2) return [];

  let bestLine: ScoredLine | null = null;
  let candidatesChecked = 0;
  let validCandidates = 0;

  // Test all combinations of pivot pairs to find the line with most touches
  const maxCombinations = Math.min(200, (pivots.length * (pivots.length - 1)) / 2);

  for (let i = 0; i < pivots.length - 1 && candidatesChecked < maxCombinations; i++) {
    for (let j = i + 1; j < pivots.length && candidatesChecked < maxCombinations; j++) {
      const line = calculateLineEquation(pivots[i], pivots[j]);

      const validation = isSupport
        ? validateSupportLine(line, candles, threshold)
        : validateResistanceLine(line, candles, threshold);

      candidatesChecked++;

      // Only consider lines with ZERO violations
      if (validation.violations > 0) continue;

      validCandidates++;

      const score = scoreTrendline(validation.touches, validation.violations, line.slope);

      if (!bestLine || score > bestLine.score) {
        bestLine = {
          equation: line,
          score,
          touches: validation.touches,
          violations: validation.violations
        };
      }
    }
  }


  if (!bestLine) {
    return [];
  }

  const firstTime = candles[0].time;
  const lastTime = candles[candles.length - 1].time;

  return [
    { time: firstTime / 1000, value: getLineValue(bestLine.equation, firstTime) },
    { time: lastTime / 1000, value: getLineValue(bestLine.equation, lastTime) }
  ];
}

function getExtremeLines(
  historicalPrices: FullCandleData[],
  endTime: number
): {
  supportLine: { x: number; y: number }[];
  resistanceLine: { x: number; y: number }[];
  supportSlope: number;
  resistanceSlope: number;
  highestPriceCandle: FullCandleData;
  secondHighestPriceCandle: FullCandleData | null;
  lowestPriceCandle: FullCandleData;
  secondLowestPriceCandle: FullCandleData | null;
} {
  let candles = [...historicalPrices];
  candles.splice(candles.length - 3, 3);

  const highestPrice = Math.max(...candles.map(x => x.high));
  const lowestPrice = Math.min(...candles.map(x => x.low));
  const highestPriceMapper = (x: FullCandleData) => x.high === highestPrice;
  const lowestPriceMapper = (x: FullCandleData) => x.low === lowestPrice;
  const highestPriceCandle: FullCandleData = candles.find(highestPriceMapper)!;
  const highestPriceCandleIndex = candles.findIndex(highestPriceMapper);
  const lowestPriceCandle: FullCandleData = candles.find(lowestPriceMapper)!;
  const lowestPriceCandleIndex = candles.findIndex(lowestPriceMapper);
  const beginTime = historicalPrices[0].time;
  const isResistanceFrontToBack = highestPriceCandleIndex < candles.length - 1 - highestPriceCandleIndex;
  const isSupportFrontToBack = lowestPriceCandleIndex < candles.length - 1 - lowestPriceCandleIndex;

  // back to front

  let backToFrontResistanceSlope = -10e99;
  let backToFrontSecondHighestPriceCandle = null;
  for (let index = candles.length - 1; index > highestPriceCandleIndex; index--) {
    const currentCandle = candles[index];
    const currentResistanceSlope = (currentCandle.high - highestPriceCandle.high) / (currentCandle.time - highestPriceCandle.time);
    if (currentResistanceSlope > backToFrontResistanceSlope) {
      backToFrontResistanceSlope = currentResistanceSlope;
      backToFrontSecondHighestPriceCandle = currentCandle;
    }
  }

  let backToFrontSupportSlope = 10e99;
  let backToFrontSecondLowestPriceCandle = null;
  for (let index = candles.length - 1; index > lowestPriceCandleIndex; index--) {
    const currentCandle = candles[index];
    const currentSupportSlope = (currentCandle.low - lowestPriceCandle.low) / (currentCandle.time - lowestPriceCandle.time);
    if (currentSupportSlope < backToFrontSupportSlope) {
      backToFrontSupportSlope = currentSupportSlope;
      backToFrontSecondLowestPriceCandle = currentCandle;
    }
  }

  // front to back

  let frontToBackResistanceSlope = -10e99;
  let frontToBackSecondHighestPriceCandle = null;
  for (let index = 0; index < highestPriceCandleIndex; index++) {
    const currentCandle = candles[index];
    const currentResistanceSlope = (currentCandle.high - highestPriceCandle.high) / (currentCandle.time - highestPriceCandle.time);
    if (currentResistanceSlope > frontToBackResistanceSlope) {
      frontToBackResistanceSlope = currentResistanceSlope;
      frontToBackSecondHighestPriceCandle = currentCandle;
    }
  }

  let frontToBackSupportSlope = 10e99;
  let frontToBackSecondLowestPriceCandle = null;
  for (let index = 0; index < lowestPriceCandleIndex; index++) {
    const currentCandle = candles[index];
    const currentSupportSlope = (currentCandle.low - lowestPriceCandle.low) / (currentCandle.time - lowestPriceCandle.time);
    if (currentSupportSlope < frontToBackSupportSlope) {
      frontToBackSupportSlope = currentSupportSlope;
      frontToBackSecondLowestPriceCandle = currentCandle;
    }
  }

  let supportLine: { x: number; y: number }[] | null = null;
  let resistanceLine: { x: number; y: number }[] | null = null;
  let resistanceSlope: number | null = null;
  let supportSlope: number | null = null;
  let secondLowestPriceCandle = null;
  let secondHighestPriceCandle = null;
  const backToFrontResistanceIntercept = highestPriceCandle.high - backToFrontResistanceSlope * (highestPriceCandle.time - beginTime);
  const backToFrontSupportIntercept = lowestPriceCandle.low - backToFrontSupportSlope * (lowestPriceCandle.time - beginTime);
  const frontToBackResistanceIntercept = highestPriceCandle.high - frontToBackResistanceSlope * (highestPriceCandle.time - beginTime);
  const frontToBackSupportIntercept = lowestPriceCandle.low - frontToBackSupportSlope * (lowestPriceCandle.time - beginTime);

  if (isResistanceFrontToBack) {
    resistanceLine = [
      { x: beginTime, y: frontToBackResistanceIntercept },
      {
        x: endTime,
        y: frontToBackResistanceSlope * (endTime - beginTime) + frontToBackResistanceIntercept
      }
    ];
    resistanceSlope = frontToBackResistanceSlope;
    secondHighestPriceCandle = frontToBackSecondHighestPriceCandle;
  } else {
    resistanceLine = [
      {
        x: highestPriceCandle.time,
        y: backToFrontResistanceSlope * (highestPriceCandle.time - beginTime) + backToFrontResistanceIntercept
      },
      {
        x: endTime,
        y: backToFrontResistanceSlope * (endTime - beginTime) + backToFrontResistanceIntercept
      }
    ];
    resistanceSlope = backToFrontResistanceSlope;
    secondHighestPriceCandle = backToFrontSecondHighestPriceCandle;
  }

  if (isSupportFrontToBack) {
    supportLine = [
      { x: beginTime, y: frontToBackSupportIntercept },
      { x: endTime, y: frontToBackSupportSlope * (endTime - beginTime) + frontToBackSupportIntercept }
    ];
    supportSlope = frontToBackSupportSlope;
    secondLowestPriceCandle = frontToBackSecondLowestPriceCandle;
  } else {
    supportLine = [
      {
        x: lowestPriceCandle.time,
        y: backToFrontSupportSlope * (lowestPriceCandle.time - beginTime) + backToFrontSupportIntercept
      },
      { x: endTime, y: backToFrontSupportSlope * (endTime - beginTime) + backToFrontSupportIntercept }
    ];
    supportSlope = backToFrontSupportSlope;
    secondLowestPriceCandle = backToFrontSecondLowestPriceCandle;
  }

  return {
    supportLine: supportLine!,
    resistanceLine: resistanceLine!,
    supportSlope: supportSlope!,
    resistanceSlope: resistanceSlope!,
    highestPriceCandle,
    secondHighestPriceCandle,
    lowestPriceCandle,
    secondLowestPriceCandle
  };
}

function validateTrendline(
  line: { x: number; y: number }[],
  candles: FullCandleData[],
  isSupport: boolean,
  tolerance: number = 0.001
): { violations: number; violationRate: number } {
  let violations = 0;

  candles.forEach(candle => {
    const timeRatio = (candle.time - line[0].x) / (line[1].x - line[0].x);
    const lineValue = line[0].y + timeRatio * (line[1].y - line[0].y);

    if (isSupport) {
      // Support line MUST stay below candle lows (strict envelope)
      if (candle.low < lineValue) {
        violations++;
      }
    } else {
      // Resistance line MUST stay above candle highs (strict envelope)
      if (candle.high > lineValue) {
        violations++;
      }
    }
  });

  return {
    violations,
    violationRate: violations / candles.length
  };
}

function getExtremeSupportResistanceLines(
  historicalPrices: FullCandleData[]
): {
  support: {
    line: Point[];
    slope: number;
    lowestPriceCandle: FullCandleData;
    secondLowestPriceCandle: FullCandleData | null;
  }[];
  resistance: {
    line: Point[];
    slope: number;
    highestPriceCandle: FullCandleData;
    secondHighestPriceCandle: FullCandleData | null;
  }[];
} {
  const endTime = historicalPrices[historicalPrices.length - 1].time;
  let output = {
    support: [] as any[],
    resistance: [] as any[]
  };
  let candles = [...historicalPrices];
  const fullWidthLines = getExtremeLines(candles, endTime);

  output.support.push({
    line: fullWidthLines.supportLine,
    slope: fullWidthLines.supportSlope,
    lowestPriceCandle: fullWidthLines.lowestPriceCandle,
    secondLowestPriceCandle: fullWidthLines.secondLowestPriceCandle
  });
  output.resistance.push({
    line: fullWidthLines.resistanceLine,
    slope: fullWidthLines.resistanceSlope,
    highestPriceCandle: fullWidthLines.highestPriceCandle,
    secondHighestPriceCandle: fullWidthLines.secondHighestPriceCandle
  });

  return output;
}

interface ScoredLine {
  line: TrendlinePoint[];
  score: number;
  period: number;
  violations: number;
  deviation: number;
  slope: number;
  touches: number;
  pivots: PivotPoint[];
}

interface LineEquationWithPivots {
  slope: number;
  intercept: number;
  startPivot: PivotPoint;
  endPivot: PivotPoint;
}

function calculateLineThroughPivots(p1: PivotPoint, p2: PivotPoint): LineEquationWithPivots {
  const slope = (p2.price - p1.price) / (p2.time - p1.time);
  const intercept = p1.price - slope * p1.time;
  return { slope, intercept, startPivot: p1, endPivot: p2 };
}

function countPivotTouches(
  line: LineEquationWithPivots,
  pivots: PivotPoint[],
  tolerance: number = 0.01
): { touches: number; touchedPivots: PivotPoint[] } {
  let touches = 0;
  const touchedPivots: PivotPoint[] = [];

  for (const pivot of pivots) {
    const lineValue = line.slope * pivot.time + line.intercept;
    const diff = Math.abs(pivot.price - lineValue) / pivot.price;
    if (diff < tolerance) {
      touches++;
      touchedPivots.push(pivot);
    }
  }

  return { touches, touchedPivots };
}

function findBestTrendlineForPeriod(
  pivots: PivotPoint[],
  candles: FullCandleData[],
  isSupport: boolean,
  period: number,
  lastPrice: number,
  actualEndTime: number
): ScoredLine | null {
  if (pivots.length < 3) return null;

  const recentCandles = candles.slice(-20);
  const avgCandleHeight = recentCandles.reduce((sum, c) => sum + (c.high - c.low), 0) / recentCandles.length;
  const maxDistanceFromPrice = avgCandleHeight * 10;

  let bestLine: ScoredLine | null = null;

  const maxCombinations = Math.min(100, (pivots.length * (pivots.length - 1)) / 2);
  let combinationsTested = 0;

  for (let i = 0; i < pivots.length - 1 && combinationsTested < maxCombinations; i++) {
    for (let j = i + 1; j < pivots.length && combinationsTested < maxCombinations; j++) {
      const lineEq = calculateLineThroughPivots(pivots[i], pivots[j]);
      combinationsTested++;

      const { touches, touchedPivots } = countPivotTouches(lineEq, pivots, 0.003);

      if (touches < 3) continue;

      const startTime = candles[0].time;
      const endTime = candles[candles.length - 1].time;
      const startValue = lineEq.slope * startTime + lineEq.intercept;
      const endValue = lineEq.slope * endTime + lineEq.intercept;

      const line = [
        { x: startTime, y: startValue },
        { x: endTime, y: endValue }
      ];

      const validation = validateTrendline(line, candles, isSupport, 0.001);

      if (validation.violationRate > 0.02) continue;

      const deviation = Math.abs(endValue - lastPrice) / lastPrice;

      if (deviation > 0.05) continue;

      const absoluteDistance = Math.abs(endValue - lastPrice);

      if (absoluteDistance > maxDistanceFromPrice) continue;

      const score = touches * 1000 - deviation * 100;

      const actualEndValue = lineEq.slope * actualEndTime + lineEq.intercept;

      if (!bestLine || score > bestLine.score) {
        bestLine = {
          line: [
            { time: startTime / 1000, value: startValue },
            { time: actualEndTime / 1000, value: actualEndValue }
          ],
          score,
          period,
          violations: validation.violations,
          deviation,
          slope: lineEq.slope,
          touches,
          pivots: touchedPivots
        };
      }
    }
  }

  return bestLine;
}

export function calculateTrendlines(candles: FullCandleData[]): Trendlines {
  if (candles.length < 30) {
    return { supportLine: [], resistanceLine: [] };
  }

  const excludeLastCandles = 10;
  const lastPrice = candles[candles.length - 1 - excludeLastCandles].close;

  const minPeriod = 20;
  const maxPeriod = candles.length - excludeLastCandles;
  const step = 10;
  const lookbackPeriods: number[] = [];
  for (let period = minPeriod; period <= maxPeriod; period += step) {
    lookbackPeriods.push(period);
  }

  const supportCandidates: ScoredLine[] = [];
  const resistanceCandidates: ScoredLine[] = [];

  const actualEndTime = candles[candles.length - 1].time;

  for (const period of lookbackPeriods) {
    const candleSubset = candles.slice(-(period + excludeLastCandles), -excludeLastCandles);

    if (candleSubset.length < 20) continue;

    const pivotLows = findPivotLows(candleSubset, 3);
    const pivotHighs = findPivotHighs(candleSubset, 3);

    const supportLine = findBestTrendlineForPeriod(pivotLows, candleSubset, true, period, lastPrice, actualEndTime);
    const resistanceLine = findBestTrendlineForPeriod(pivotHighs, candleSubset, false, period, lastPrice, actualEndTime);

    if (supportLine) {
      supportCandidates.push(supportLine);
    }

    if (resistanceLine) {
      resistanceCandidates.push(resistanceLine);
    }
  }

  supportCandidates.sort((a, b) => b.score - a.score);
  resistanceCandidates.sort((a, b) => b.score - a.score);

  const topSupport = supportCandidates.slice(0, 1);
  const topResistance = resistanceCandidates.slice(0, 1);

  return {
    supportLine: topSupport.map((s) => ({
      points: s.line,
      lineStyle: 0
    })),
    resistanceLine: topResistance.map((r) => ({
      points: r.line,
      lineStyle: 0
    }))
  };
}

export const calculateEMAMemoized = createMemoizedFunction(
  calculateEMA,
  (data: number[], period: number) => {
    if (!data || data.length === 0) return 'empty';
    const first = data[0];
    const last = data[data.length - 1];
    return `ema-${data.length}-${first}-${last}-${period}`;
  },
  100,
  60000
);

export const calculateMACDMemoized = createMemoizedFunction(
  calculateMACD,
  (data: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number) => {
    if (!data || data.length === 0) return 'empty';
    const first = data[0];
    const last = data[data.length - 1];
    return `macd-${data.length}-${first}-${last}-${fastPeriod}-${slowPeriod}-${signalPeriod}`;
  },
  100,
  60000
);

export const calculateStochasticMemoized = createMemoizedFunction(
  calculateStochastic,
  (candles: CandleData[], period: number = 14, smoothK: number = 3, smoothD: number = 3) => {
    if (!candles || candles.length === 0) return 'empty';
    const first = candles[0];
    const last = candles[candles.length - 1];
    return `stoch-${candles.length}-${first.close}-${last.close}-${period}-${smoothK}-${smoothD}`;
  },
  100,
  60000
);
