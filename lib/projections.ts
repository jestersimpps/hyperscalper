import type { CandleData as FullCandleData } from '@/types';

export interface ProjectionPoint {
  time: number;
  value: number;
}

const RSI_SCALE = 0.006;
const STOCH_SCALE = 0.005;
const MACD_SCALE = 0.15;
const MAX_OFFSET_PCT = 0.012;

const EMA_PULL_TARGET = 0.7;

export function projectEMAAlongPath(
  historicalEma: number[],
  period: number,
  forecastCloses: number[],
  startTimeMs: number,
  intervalMs: number,
): ProjectionPoint[] {
  if (historicalEma.length === 0 || forecastCloses.length === 0) return [];
  const baseK = 2 / (period + 1);
  let ema = historicalEma[historicalEma.length - 1];
  const out: ProjectionPoint[] = [];
  const horizon = forecastCloses.length;
  for (let i = 0; i < horizon; i++) {
    const ramp = (i + 1) / horizon;
    const k = baseK + (EMA_PULL_TARGET - baseK) * ramp;
    ema = forecastCloses[i] * k + ema * (1 - k);
    out.push({ time: startTimeMs + intervalMs * (i + 1), value: ema });
  }
  return out;
}

export function projectRSIAlongPath(
  historicalCloses: number[],
  forecastCloses: number[],
  startTimeMs: number,
  intervalMs: number,
  period = 14,
): ProjectionPoint[] {
  if (historicalCloses.length < period + 1 || forecastCloses.length === 0) return [];

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = historicalCloses[i] - historicalCloses[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += -change;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < historicalCloses.length; i++) {
    const change = historicalCloses[i] - historicalCloses[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  let prevClose = historicalCloses[historicalCloses.length - 1];
  const smooth = period - 1;
  const out: ProjectionPoint[] = [];

  for (let i = 0; i < forecastCloses.length; i++) {
    const next = forecastCloses[i];
    const change = next - prevClose;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * smooth + gain) / period;
    avgLoss = (avgLoss * smooth + loss) / period;
    prevClose = next;

    const rs = avgLoss > 1e-10 ? avgGain / avgLoss : 100;
    const rsi = 100 - 100 / (1 + rs);
    const stretch = (rsi - 50) / 50;
    const ramp = (i + 1) / forecastCloses.length;
    const offsetPct = MAX_OFFSET_PCT * Math.tanh(stretch * RSI_SCALE * 100 * ramp);
    const value = next * (1 + offsetPct);
    out.push({ time: startTimeMs + intervalMs * (i + 1), value });
  }
  return out;
}

export function projectStochAlongPath(
  historicalCandles: FullCandleData[],
  forecastCloses: number[],
  startTimeMs: number,
  intervalMs: number,
  period: number,
  smoothK = 3,
): ProjectionPoint[] {
  if (historicalCandles.length < period || forecastCloses.length === 0) return [];

  const window = historicalCandles.slice(-period).map((c) => ({
    high: c.high,
    low: c.low,
  }));

  const seedCandles = historicalCandles.slice(-(period + smoothK));
  const seedKs: number[] = [];
  for (let j = period - 1; j < seedCandles.length; j++) {
    let high = -Infinity;
    let low = Infinity;
    for (let m = j - period + 1; m <= j; m++) {
      if (seedCandles[m].high > high) high = seedCandles[m].high;
      if (seedCandles[m].low < low) low = seedCandles[m].low;
    }
    const range = high - low;
    const close = seedCandles[j].close;
    seedKs.push(range > 0 ? ((close - low) / range) * 100 : 50);
  }
  const recentKs: number[] = seedKs.slice(-smoothK);
  while (recentKs.length < smoothK) recentKs.unshift(50);

  const out: ProjectionPoint[] = [];
  for (let i = 0; i < forecastCloses.length; i++) {
    const close = forecastCloses[i];
    const prevClose =
      i > 0 ? forecastCloses[i - 1] : historicalCandles[historicalCandles.length - 1].close;
    window.shift();
    window.push({
      high: Math.max(close, prevClose),
      low: Math.min(close, prevClose),
    });

    let high = -Infinity;
    let low = Infinity;
    for (const r of window) {
      if (r.high > high) high = r.high;
      if (r.low < low) low = r.low;
    }
    const range = high - low;
    const rawK = range > 0 ? ((close - low) / range) * 100 : 50;
    const clampedK = Math.max(0, Math.min(100, rawK));

    recentKs.shift();
    recentKs.push(clampedK);
    const smoothedK = recentKs.reduce((a, b) => a + b, 0) / recentKs.length;

    const stretch = (smoothedK - 50) / 50;
    const ramp = (i + 1) / forecastCloses.length;
    let offsetPct = MAX_OFFSET_PCT * Math.tanh(stretch * STOCH_SCALE * 100 * ramp);
    if (out.length > 0) {
      const prevValue = out[out.length - 1].value;
      const prevPct = prevValue / close - 1;
      const maxStep = MAX_OFFSET_PCT / forecastCloses.length;
      offsetPct = Math.max(prevPct - maxStep, Math.min(prevPct + maxStep, offsetPct));
    }
    const value = close * (1 + offsetPct);
    out.push({ time: startTimeMs + intervalMs * (i + 1), value });
  }
  return out;
}

export function projectMACDAlongPath(
  historicalCloses: number[],
  forecastCloses: number[],
  startTimeMs: number,
  intervalMs: number,
  fastPeriod: number,
  slowPeriod: number,
): ProjectionPoint[] {
  if (historicalCloses.length < slowPeriod || forecastCloses.length === 0) return [];

  const aFast = 2 / (fastPeriod + 1);
  const aSlow = 2 / (slowPeriod + 1);

  let fastEma = historicalCloses[0];
  let slowEma = historicalCloses[0];
  for (let i = 1; i < historicalCloses.length; i++) {
    fastEma = fastEma + aFast * (historicalCloses[i] - fastEma);
    slowEma = slowEma + aSlow * (historicalCloses[i] - slowEma);
  }

  const out: ProjectionPoint[] = [];
  for (let i = 0; i < forecastCloses.length; i++) {
    const close = forecastCloses[i];
    fastEma = fastEma + aFast * (close - fastEma);
    slowEma = slowEma + aSlow * (close - slowEma);
    const macd = fastEma - slowEma;
    const ramp = (i + 1) / forecastCloses.length;
    const macdPct = close > 0 ? macd / close : 0;
    const offsetPct = MAX_OFFSET_PCT * Math.tanh(macdPct * MACD_SCALE * 50 * ramp);
    const value = close * (1 + offsetPct);
    out.push({ time: startTimeMs + intervalMs * (i + 1), value });
  }
  return out;
}

export function extendTrendline(
  points: { time: number; value: number }[],
  intervalMs: number,
  horizon: number,
): ProjectionPoint[] {
  if (points.length < 2) return [];
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  const dt = b.time - a.time;
  if (dt <= 0) return [];
  const slopePerMs = (b.value - a.value) / dt;
  const out: ProjectionPoint[] = [];
  for (let k = 1; k <= horizon; k++) {
    const t = b.time + intervalMs * k;
    out.push({ time: t, value: b.value + slopePerMs * intervalMs * k });
  }
  return out;
}
