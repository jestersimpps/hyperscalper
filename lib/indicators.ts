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
