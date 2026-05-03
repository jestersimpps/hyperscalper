#!/usr/bin/env node

const HL_INFO_URL = 'https://api.hyperliquid.xyz/info';

const DEFAULT_CONFIG = {
  lookbackBars: 60,
  pivotStrength: 3,
  minHighPivots: 2,
  minLowPivots: 2,
  minSlopeR2: 0.5,
  minScore: 0.6,
  weights: {
    flatness: 0.25,
    slope: 0.2,
    convergence: 0.2,
    volume: 0.15,
    ema: 0.1,
    proximity: 0.1,
  },
};

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function calculateTrueRange(candles) {
  const tr = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    tr.push(Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose),
    ));
  }
  return tr;
}

function calculateATR(candles, period = 14) {
  if (candles.length < period + 1) return [];
  const tr = calculateTrueRange(candles);
  const atr = [];
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
    atr.push(0);
  }
  atr[period - 1] = sum / period;
  for (let i = period; i < tr.length; i++) {
    atr.push((atr[i - 1] * (period - 1) + tr[i]) / period);
  }
  return atr;
}

function calculateEMA(data, period) {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const ema = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  ema[period - 1] = sum / period;
  for (let i = period; i < data.length; i++) {
    ema.push(data[i] * k + ema[ema.length - 1] * (1 - k));
  }
  const out = new Array(period - 1).fill(0).concat(ema.slice(period - 1 < ema.length ? 0 : 0));
  // Simpler: rebuild as fixed-length array aligned with data
  const aligned = new Array(data.length).fill(0);
  let prev = sum / period;
  aligned[period - 1] = prev;
  for (let i = period; i < data.length; i++) {
    prev = data[i] * k + prev * (1 - k);
    aligned[i] = prev;
  }
  return aligned;
}

function detectPivots(candles, pivotStrength = 3) {
  const pivots = [];
  if (candles.length < pivotStrength * 2 + 1) return pivots;
  for (let i = pivotStrength; i < candles.length - pivotStrength; i++) {
    const c = candles[i];
    let isHigh = true;
    for (let j = 1; j <= pivotStrength; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) pivots.push({ index: i, price: c.high, type: 'high', time: c.time });

    let isLow = true;
    for (let j = 1; j <= pivotStrength; j++) {
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) {
        isLow = false;
        break;
      }
    }
    if (isLow) pivots.push({ index: i, price: c.low, type: 'low', time: c.time });
  }
  return pivots;
}

function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: n === 1 ? points[0].y : 0, r2: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  const denom = sumXX - n * meanX * meanX;
  if (denom === 0) return { slope: 0, intercept: meanY, r2: 0 };
  const slope = (sumXY - n * meanX * meanY) / denom;
  const intercept = meanY - slope * meanX;
  let ssTot = 0, ssRes = 0;
  for (const { x, y } of points) {
    const pred = slope * x + intercept;
    ssRes += (y - pred) ** 2;
    ssTot += (y - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

function evaluateAscendingTriangle(candles, config) {
  const n = candles.length;
  if (n < config.lookbackBars) return null;

  const atrSeries = calculateATR(candles, 14);
  const atr = atrSeries.length > 0 ? atrSeries[atrSeries.length - 1] : 0;
  if (atr <= 0) return null;

  const pivots = detectPivots(candles, config.pivotStrength);
  const highPivots = pivots.filter(p => p.type === 'high');
  const lowPivots = pivots.filter(p => p.type === 'low');
  if (highPivots.length < config.minHighPivots || lowPivots.length < config.minLowPivots) return null;

  const ceiling = highPivots.reduce((s, p) => s + p.price, 0) / highPivots.length;
  const variance = highPivots.reduce((s, p) => s + (p.price - ceiling) ** 2, 0) / highPivots.length;
  const stdDevHighs = Math.sqrt(variance);
  const flatness = clamp01(1 - (stdDevHighs / atr));

  const reg = linearRegression(lowPivots.map(p => ({ x: p.index, y: p.price })));
  if (reg.slope <= 0 || reg.r2 < config.minSlopeR2) return null;

  const slopePerBarInAtr = reg.slope / atr;
  const slopeScore = clamp01(slopePerBarInAtr * 10);

  const lastIndex = n - 1;
  const supportLineAtNow = reg.slope * lastIndex + reg.intercept;
  const gap = Math.max(0, ceiling - supportLineAtNow);
  const convergence = clamp01(1 - (gap / (atr * 4)));

  const third = Math.floor(n / 3);
  const firstThird = candles.slice(0, third);
  const lastThird = candles.slice(n - third);
  const avgFirst = firstThird.reduce((s, c) => s + c.volume, 0) / Math.max(1, firstThird.length);
  const avgLast = lastThird.reduce((s, c) => s + c.volume, 0) / Math.max(1, lastThird.length);
  const volRatio = avgFirst > 0 ? avgLast / avgFirst : 1;
  const volumeScore = clamp01(1 - volRatio);

  const closes = candles.map(c => c.close);
  const ema5 = calculateEMA(closes, 5);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const e5 = ema5[ema5.length - 1] || 0;
  const e20 = ema20[ema20.length - 1] || 0;
  const e50 = ema50[ema50.length - 1] || 0;
  const emaScore = (e5 > 0 && e20 > 0 && e50 > 0 && e5 > e20 && e20 > e50) ? 1 : 0;

  const currentPrice = candles[n - 1].close;
  const distanceToCeiling = Math.max(0, ceiling - currentPrice);
  const proximity = clamp01(1 - (distanceToCeiling / (atr * 2)));

  const components = { flatness, slope: slopeScore, convergence, volume: volumeScore, ema: emaScore, proximity };
  const w = config.weights;
  const weightSum = w.flatness + w.slope + w.convergence + w.volume + w.ema + w.proximity;
  const weighted =
    components.flatness * w.flatness +
    components.slope * w.slope +
    components.convergence * w.convergence +
    components.volume * w.volume +
    components.ema * w.ema +
    components.proximity * w.proximity;
  const score = weightSum > 0 ? weighted / weightSum : 0;

  const lastLow = lowPivots[lowPivots.length - 1];
  return {
    score,
    components,
    ceiling,
    supportLineAtNow,
    supportSlope: reg.slope,
    supportR2: reg.r2,
    stopSuggestion: lastLow.price - atr,
    highPivotCount: highPivots.length,
    lowPivotCount: lowPivots.length,
    atr,
    currentPrice,
  };
}

async function fetchCandles(coin, interval, startTime, endTime) {
  const res = await fetch(HL_INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'candleSnapshot',
      req: { coin, interval, startTime, endTime },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${coin}`);
  const raw = await res.json();
  return raw.map(c => ({
    time: c.t,
    open: parseFloat(c.o),
    high: parseFloat(c.h),
    low: parseFloat(c.l),
    close: parseFloat(c.c),
    volume: parseFloat(c.v),
  })).sort((a, b) => a.time - b.time);
}

function fmtTime(ms) {
  const d = new Date(ms);
  return d.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

async function backtest(symbol, hours, config) {
  const endTime = Date.now();
  const warmupMs = config.lookbackBars * 60 * 1000;
  const startTime = endTime - hours * 60 * 60 * 1000 - warmupMs;

  console.log(`\n=== ${symbol} (last ${hours}h 1m, lookback ${config.lookbackBars}, minScore ${config.minScore}) ===`);
  const candles = await fetchCandles(symbol, '1m', startTime, endTime);
  console.log(`fetched ${candles.length} candles (${fmtTime(candles[0].time)} → ${fmtTime(candles[candles.length - 1].time)})`);

  const rows = [];
  let watchOpen = false;
  let watchStartBar = null;
  const watchEpisodes = [];

  for (let i = config.lookbackBars; i <= candles.length; i++) {
    const window = candles.slice(i - config.lookbackBars, i);
    const result = evaluateAscendingTriangle(window, config);
    const barTime = window[window.length - 1].time;

    if (result && result.score >= config.minScore) {
      rows.push({ barTime, ...result });
      if (!watchOpen) {
        watchOpen = true;
        watchStartBar = barTime;
      }
    } else if (watchOpen) {
      watchOpen = false;
      watchEpisodes.push({ start: watchStartBar, end: barTime, duration: (barTime - watchStartBar) / 60000 });
      watchStartBar = null;
    }
  }
  if (watchOpen) {
    const lastBar = candles[candles.length - 1].time;
    watchEpisodes.push({ start: watchStartBar, end: lastBar, duration: (lastBar - watchStartBar) / 60000, ongoing: true });
  }

  if (rows.length === 0) {
    console.log('no firing bars (score never crossed threshold)');
    return;
  }

  console.log(`${rows.length} firing bars across ${watchEpisodes.length} watch episode(s):\n`);
  for (const ep of watchEpisodes) {
    const tag = ep.ongoing ? ' (ongoing)' : '';
    console.log(`  watch: ${fmtTime(ep.start)} → ${fmtTime(ep.end)}  (${ep.duration.toFixed(0)} min)${tag}`);
  }

  console.log('\nbar-by-bar (showing up to 20 per episode, top-scoring):');
  const peak = rows.reduce((a, b) => b.score > a.score ? b : a);
  console.log(`\n  peak @ ${fmtTime(peak.barTime)}  score=${peak.score.toFixed(3)}`);
  console.log(`    ceiling=${peak.ceiling.toFixed(6)}  price=${peak.currentPrice.toFixed(6)}  atr=${peak.atr.toFixed(6)}`);
  console.log(`    supportLine=${peak.supportLineAtNow.toFixed(6)}  slope=${peak.supportSlope.toExponential(2)}  R²=${peak.supportR2.toFixed(2)}`);
  console.log(`    pivots: ${peak.highPivotCount} highs / ${peak.lowPivotCount} lows`);
  console.log(`    components:`, Object.fromEntries(Object.entries(peak.components).map(([k, v]) => [k, v.toFixed(3)])));
  console.log(`    stop suggestion: ${peak.stopSuggestion.toFixed(6)}`);

  console.log('\n  time                   score  flat  slop  conv  vol   ema   prox  ceiling       price');
  const sample = rows.length <= 15 ? rows : rows.filter((_, i) => i % Math.ceil(rows.length / 15) === 0).slice(0, 15);
  for (const r of sample) {
    const c = r.components;
    console.log(
      `  ${fmtTime(r.barTime)}  ${r.score.toFixed(3)}  ${c.flatness.toFixed(2)}  ${c.slope.toFixed(2)}  ${c.convergence.toFixed(2)}  ${c.volume.toFixed(2)}  ${c.ema.toFixed(2)}  ${c.proximity.toFixed(2)}  ${r.ceiling.toFixed(6).padStart(11)}  ${r.currentPrice.toFixed(6)}`
    );
  }
}

const symbols = ['APE', 'GRIFFAIN', 'STABLE'];
const hours = 6;

for (const sym of symbols) {
  try {
    await backtest(sym, hours, DEFAULT_CONFIG);
  } catch (e) {
    console.error(`${sym} failed:`, e.message);
  }
}
