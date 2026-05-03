// Ad-hoc test: run evaluateAscendingTriangle across 6h of 1m candles.
// Mirrors lib/indicators.ts + lib/services/scanner.service.ts logic.
// Usage: node test_ascending_triangle.mjs [SYMBOL]  (default BTC)

const SYMBOL = process.argv[2] || 'BTC';
const LOOKBACK_BARS = 60;
const HOURS = 6;
const TOTAL_BARS = HOURS * 60;

const CONFIG = {
  lookbackBars: 60,
  pivotStrength: 3,
  minHighPivots: 2,
  minLowPivots: 2,
  minSlopeR2: 0.5,
  minScore: 0.6,
  weights: { flatness: 0.25, slope: 0.2, convergence: 0.2, volume: 0.15, ema: 0.1, proximity: 0.1 },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function calculateTrueRange(candles) {
  const tr = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { tr.push(candles[i].high - candles[i].low); continue; }
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return tr;
}

function calculateATR(candles, period = 14) {
  if (candles.length < period + 1) return [];
  const tr = calculateTrueRange(candles);
  const atr = [];
  let sum = 0;
  for (let i = 0; i < period; i++) { sum += tr[i]; atr.push(0); }
  atr[period - 1] = sum / period;
  for (let i = period; i < tr.length; i++) {
    atr.push((atr[i - 1] * (period - 1) + tr[i]) / period);
  }
  return atr;
}

function calculateEMA(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const ema = [];
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  seed /= period;
  ema[period - 1] = seed;
  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  const out = new Array(period - 1).fill(0);
  out.push(seed);
  for (let i = period; i < values.length; i++) out.push(ema[i - 1]); // align
  // simpler: recompute cleanly
  const clean = [];
  let prev = seed;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { clean.push(0); continue; }
    if (i === period - 1) { clean.push(seed); continue; }
    prev = values[i] * k + prev * (1 - k);
    clean.push(prev);
  }
  return clean;
}

function detectPivots(candles, strength = 3) {
  const pivots = [];
  if (candles.length < strength * 2 + 1) return pivots;
  for (let i = strength; i < candles.length - strength; i++) {
    const c = candles[i];
    let isHigh = true;
    for (let j = 1; j <= strength; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) { isHigh = false; break; }
    }
    if (isHigh) pivots.push({ index: i, price: c.high, type: 'high', time: c.time });
    let isLow = true;
    for (let j = 1; j <= strength; j++) {
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) { isLow = false; break; }
    }
    if (isLow) pivots.push({ index: i, price: c.low, type: 'low', time: c.time });
  }
  return pivots;
}

function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: n === 1 ? points[0].y : 0, r2: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const { x, y } of points) { sumX += x; sumY += y; sumXY += x * y; sumXX += x * x; }
  const meanX = sumX / n, meanY = sumY / n;
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
  return { slope, intercept, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

function evaluateAscendingTriangle(candles, config) {
  const n = candles.length;
  if (n < config.lookbackBars) return { reason: 'not enough bars' };
  const atrSeries = calculateATR(candles, 14);
  const atr = atrSeries.length > 0 ? atrSeries[atrSeries.length - 1] : 0;
  if (atr <= 0) return { reason: 'atr<=0' };

  const pivots = detectPivots(candles, config.pivotStrength);
  const highPivots = pivots.filter(p => p.type === 'high');
  const lowPivots = pivots.filter(p => p.type === 'low');
  if (highPivots.length < config.minHighPivots || lowPivots.length < config.minLowPivots) {
    return { reason: `pivots insufficient (highs=${highPivots.length} lows=${lowPivots.length})` };
  }

  const ceiling = highPivots.reduce((s, p) => s + p.price, 0) / highPivots.length;
  const variance = highPivots.reduce((s, p) => s + (p.price - ceiling) ** 2, 0) / highPivots.length;
  const stdDevHighs = Math.sqrt(variance);
  const flatness = clamp01(1 - (stdDevHighs / atr));

  const reg = linearRegression(lowPivots.map(p => ({ x: p.index, y: p.price })));
  if (reg.slope <= 0 || reg.r2 < config.minSlopeR2) {
    return { reason: `support not ascending (slope=${reg.slope.toExponential(2)} r2=${reg.r2.toFixed(2)})`, ceiling, atr, highPivots: highPivots.length, lowPivots: lowPivots.length };
  }

  const slopePerBarInAtr = reg.slope / atr;
  const slopeScore = clamp01(slopePerBarInAtr * 10);
  const lastIndex = n - 1;
  const supportAtNow = reg.slope * lastIndex + reg.intercept;
  const gap = Math.max(0, ceiling - supportAtNow);
  const convergence = clamp01(1 - (gap / (atr * 4)));

  const third = Math.floor(n / 3);
  const first = candles.slice(0, third);
  const last = candles.slice(n - third);
  const avgVolFirst = first.reduce((s, c) => s + c.volume, 0) / Math.max(1, first.length);
  const avgVolLast = last.reduce((s, c) => s + c.volume, 0) / Math.max(1, last.length);
  const volumeRatio = avgVolFirst > 0 ? avgVolLast / avgVolFirst : 1;
  const volumeScore = clamp01(1 - volumeRatio);

  const closes = candles.map(c => c.close);
  const e5a = calculateEMA(closes, 5);
  const e20a = calculateEMA(closes, 20);
  const e50a = calculateEMA(closes, 50);
  const e5 = e5a.at(-1) || 0, e20 = e20a.at(-1) || 0, e50 = e50a.at(-1) || 0;
  const emaScore = (e5 > 0 && e20 > 0 && e50 > 0 && e5 > e20 && e20 > e50) ? 1 : 0;

  const currentPrice = candles[n - 1].close;
  const proximity = clamp01(1 - Math.max(0, ceiling - currentPrice) / (atr * 2));

  const comp = { flatness, slope: slopeScore, convergence, volume: volumeScore, ema: emaScore, proximity };
  const w = config.weights;
  const weightSum = w.flatness + w.slope + w.convergence + w.volume + w.ema + w.proximity;
  const weighted = comp.flatness * w.flatness + comp.slope * w.slope + comp.convergence * w.convergence
    + comp.volume * w.volume + comp.ema * w.ema + comp.proximity * w.proximity;
  const score = weightSum > 0 ? weighted / weightSum : 0;

  return {
    score, components: comp, ceiling, supportLineAtNow: supportAtNow,
    supportSlope: reg.slope, supportR2: reg.r2, atr, currentPrice,
    highPivotCount: highPivots.length, lowPivotCount: lowPivots.length,
  };
}

async function fetchCandles(symbol, hours) {
  const endTime = Date.now();
  const startTime = endTime - hours * 60 * 60 * 1000;
  const res = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'candleSnapshot',
      req: { coin: symbol, interval: '1m', startTime, endTime },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  return raw.map(c => ({
    time: c.t, open: +c.o, high: +c.h, low: +c.l, close: +c.c, volume: +c.v,
  }));
}

const fmt = (n, d = 4) => typeof n === 'number' ? n.toFixed(d) : String(n);

(async () => {
  console.log(`Fetching ${HOURS}h of 1m ${SYMBOL} candles from Hyperliquid…`);
  const candles = await fetchCandles(SYMBOL, HOURS);
  console.log(`Got ${candles.length} candles. First: ${new Date(candles[0].time).toISOString()}  Last: ${new Date(candles.at(-1).time).toISOString()}`);
  console.log(`Price range: ${fmt(Math.min(...candles.map(c => c.low)))} – ${fmt(Math.max(...candles.map(c => c.high)))}`);
  console.log('');

  // 1. Evaluate on most recent 60-bar window (what the live scanner would see right now)
  const recent = candles.slice(-LOOKBACK_BARS);
  console.log(`=== Latest ${LOOKBACK_BARS}-bar window ===`);
  const latest = evaluateAscendingTriangle(recent, CONFIG);
  if (latest.reason) {
    console.log(`REJECTED: ${latest.reason}`);
    if (latest.ceiling) console.log(`  ceiling=${fmt(latest.ceiling)} atr=${fmt(latest.atr)} pivots H=${latest.highPivots} L=${latest.lowPivots}`);
  } else {
    console.log(`score=${fmt(latest.score, 3)} ${latest.score >= CONFIG.minScore ? '✅ SIGNAL' : '❌ below threshold (0.6)'}`);
    console.log(`  ceiling=${fmt(latest.ceiling)}  support@now=${fmt(latest.supportLineAtNow)}  slope=${fmt(latest.supportSlope, 6)}  R²=${fmt(latest.supportR2, 3)}`);
    console.log(`  pivots: H=${latest.highPivotCount} L=${latest.lowPivotCount}  ATR=${fmt(latest.atr)}  price=${fmt(latest.currentPrice)}`);
    console.log(`  components:`, Object.fromEntries(Object.entries(latest.components).map(([k, v]) => [k, +v.toFixed(3)])));
  }
  console.log('');

  // 2. Sliding-window scan across the full 6h to see if any window would have fired
  console.log(`=== Sliding scan: ${candles.length - LOOKBACK_BARS + 1} windows of ${LOOKBACK_BARS} bars ===`);
  const hits = [];
  const topScores = [];
  for (let i = 0; i + LOOKBACK_BARS <= candles.length; i++) {
    const win = candles.slice(i, i + LOOKBACK_BARS);
    const r = evaluateAscendingTriangle(win, CONFIG);
    if (!r.reason) {
      topScores.push({ endIdx: i + LOOKBACK_BARS - 1, endTime: win.at(-1).time, score: r.score, ceiling: r.ceiling, r2: r.supportR2 });
      if (r.score >= CONFIG.minScore) hits.push({ endIdx: i + LOOKBACK_BARS - 1, ...r });
    }
  }
  topScores.sort((a, b) => b.score - a.score);
  console.log(`Windows that passed gating (valid ascending support): ${topScores.length}`);
  console.log(`Windows that would trigger a signal (score ≥ ${CONFIG.minScore}): ${hits.length}`);
  console.log('');
  console.log('Top 5 scoring windows:');
  for (const t of topScores.slice(0, 5)) {
    console.log(`  ${new Date(t.endTime).toISOString()}  score=${fmt(t.score, 3)}  ceiling=${fmt(t.ceiling)}  R²=${fmt(t.r2, 3)}`);
  }
  if (hits.length) {
    console.log('');
    console.log('Signal windows (chronological):');
    for (const h of hits) {
      const t = new Date(candles[h.endIdx].time).toISOString();
      console.log(`  ${t}  score=${fmt(h.score, 3)}  ceiling=${fmt(h.ceiling)}  support=${fmt(h.supportLineAtNow)}  pivots H/L=${h.highPivotCount}/${h.lowPivotCount}`);
    }
  }
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
