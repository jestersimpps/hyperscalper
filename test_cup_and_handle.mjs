// Ad-hoc test: run evaluateCupAndHandle across 1m candles.
// Mirrors lib/services/scanner.service.ts evaluateCupAndHandle logic.
// Usage: node test_cup_and_handle.mjs [SYMBOL] [HOURS]  (default AIXBT 24h)

const SYMBOL = process.argv[2] || 'AIXBT';
const HOURS = Number(process.argv[3] || 24);
const LOOKBACK_BARS = Number(process.argv[4] || 240);

const CONFIG = {
  lookbackBars: LOOKBACK_BARS,
  pivotStrength: 4,
  minCupBars: 40,
  maxCupBars: Math.max(200, Math.floor(LOOKBACK_BARS * 0.8)),
  minHandleBars: 5,
  maxHandleBars: Math.max(60, Math.floor(LOOKBACK_BARS * 0.25)),
  maxRimAsymmetry: 0.04,
  minCupDepth: 0.015,
  maxCupDepth: 0.5,
  maxHandlePullback: 0.5,
  minScore: 0.6,
  weights: {
    rimSymmetry: 0.2,
    cupRoundness: 0.2,
    cupDepth: 0.15,
    handlePullback: 0.2,
    handleVolume: 0.1,
    proximity: 0.15,
  },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function trueRange(candles) {
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
  const tr = trueRange(candles);
  const atr = [];
  let sum = 0;
  for (let i = 0; i < period; i++) { sum += tr[i]; atr.push(0); }
  atr[period - 1] = sum / period;
  for (let i = period; i < tr.length; i++) {
    atr.push((atr[i - 1] * (period - 1) + tr[i]) / period);
  }
  return atr;
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

function computeCupRoundness(cupSlice, leftPrice, rightPrice, bottomPrice) {
  const n = cupSlice.length;
  if (n < 5) return 0;
  const lows = cupSlice.map(c => c.low);
  const startV = leftPrice, endV = rightPrice, minV = bottomPrice;
  const range = ((startV + endV) / 2) - minV;
  if (range <= 0) return 0;
  let ssRes = 0, ssTot = 0;
  const meanLow = lows.reduce((s, v) => s + v, 0) / n;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const expected = startV + (endV - startV) * t - 4 * range * t * (1 - t);
    ssRes += (lows[i] - expected) ** 2;
    ssTot += (lows[i] - meanLow) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return clamp01(r2);
}

function computeHandleVolumeScore(candles, cupStartIndex, rightRimIndex, handleEndIndex) {
  const cupSlice = candles.slice(cupStartIndex, rightRimIndex + 1);
  const handleSlice = candles.slice(rightRimIndex, handleEndIndex + 1);
  if (!cupSlice.length || !handleSlice.length) return 0;
  const cupAvgVol = cupSlice.reduce((s, c) => s + c.volume, 0) / cupSlice.length;
  const handleAvgVol = handleSlice.reduce((s, c) => s + c.volume, 0) / handleSlice.length;
  if (cupAvgVol <= 0) return 0;
  return clamp01(1 - handleAvgVol / cupAvgVol);
}

function evaluateCupAndHandle(candles, config) {
  const n = candles.length;
  if (n < config.lookbackBars) return { reason: 'not enough bars' };

  const atrSeries = calculateATR(candles, 14);
  const atr = atrSeries.length > 0 ? atrSeries.at(-1) : 0;
  if (atr <= 0) return { reason: 'atr<=0' };

  const pivots = detectPivots(candles, config.pivotStrength);
  const highPivots = pivots.filter(p => p.type === 'high');
  const lowPivots = pivots.filter(p => p.type === 'low');
  if (highPivots.length < 2 || lowPivots.length < 1) {
    return { reason: `pivots insufficient (highs=${highPivots.length} lows=${lowPivots.length})` };
  }

  const handleEndIndex = n - 1;
  const currentPrice = candles[handleEndIndex].close;
  const rejectReasons = [];

  let best = null;

  for (let li = 0; li < highPivots.length - 1; li++) {
    const leftRim = highPivots[li];
    for (let ri = highPivots.length - 1; ri > li; ri--) {
      const rightRim = highPivots[ri];
      const cupBars = rightRim.index - leftRim.index;
      if (cupBars < config.minCupBars || cupBars > config.maxCupBars) { rejectReasons.push(`cupBars=${cupBars}`); continue; }
      const barsSinceRim = handleEndIndex - rightRim.index;
      if (barsSinceRim < config.minHandleBars) { rejectReasons.push(`barsSinceRim=${barsSinceRim}`); continue; }
      if (barsSinceRim > config.maxHandleBars * 2) { rejectReasons.push(`barsSinceRim=${barsSinceRim}>2x`); continue; }
      const rimAvg = (leftRim.price + rightRim.price) / 2;
      const rimAsymmetry = Math.abs(leftRim.price - rightRim.price) / rimAvg;
      if (rimAsymmetry > config.maxRimAsymmetry) { rejectReasons.push(`rimAsym=${rimAsymmetry.toFixed(3)}`); continue; }
      const cupLowPivots = lowPivots.filter(p => p.index > leftRim.index && p.index < rightRim.index);
      if (!cupLowPivots.length) { rejectReasons.push('no-cup-low'); continue; }
      const cupBottom = cupLowPivots.reduce((m, p) => p.price < m.price ? p : m, cupLowPivots[0]);
      const cupDepth = (rimAvg - cupBottom.price) / rimAvg;
      if (cupDepth < config.minCupDepth || cupDepth > config.maxCupDepth) { rejectReasons.push(`cupDepth=${cupDepth.toFixed(3)}`); continue; }

      const handleStart = rightRim.index;
      const handleSearchEnd = Math.min(n - 1, rightRim.index + config.maxHandleBars);
      let handleLow = candles[handleStart].low;
      let handleLowIndex = handleStart;
      for (let k = handleStart; k <= handleSearchEnd; k++) {
        if (candles[k].low < handleLow) { handleLow = candles[k].low; handleLowIndex = k; }
      }
      const actualHandleBars = handleLowIndex - handleStart;
      if (actualHandleBars < config.minHandleBars) { rejectReasons.push(`actualHandle=${actualHandleBars}`); continue; }
      const handleDrop = rightRim.price - handleLow;
      const cupRange = rimAvg - cupBottom.price;
      const handlePullback = cupRange > 0 ? handleDrop / cupRange : 1;
      if (handlePullback > config.maxHandlePullback) { rejectReasons.push(`handlePB=${handlePullback.toFixed(3)}@cup=${cupBars}`); continue; }
      if (handleLow < cupBottom.price) { rejectReasons.push(`handle<cupBottom@cup=${cupBars}`); continue; }

      const rimSymmetryScore = clamp01(1 - rimAsymmetry / config.maxRimAsymmetry);
      const cupSlice = candles.slice(leftRim.index, rightRim.index + 1);
      const cupRoundnessScore = computeCupRoundness(cupSlice, leftRim.price, rightRim.price, cupBottom.price);
      const cupDepthScore = clamp01(1 - Math.abs(cupDepth - 0.08) / 0.08);
      const handlePullbackScore = clamp01(1 - Math.abs(handlePullback - 0.33) / 0.33);
      const handleVolumeScore = computeHandleVolumeScore(candles, leftRim.index, rightRim.index, handleLowIndex);
      const distanceToResistance = Math.max(0, rightRim.price - currentPrice);
      const proximityScore = clamp01(1 - distanceToResistance / (atr * 2));

      const components = {
        rimSymmetry: rimSymmetryScore,
        cupRoundness: cupRoundnessScore,
        cupDepth: cupDepthScore,
        handlePullback: handlePullbackScore,
        handleVolume: handleVolumeScore,
        proximity: proximityScore,
      };
      const w = config.weights;
      const weightSum = w.rimSymmetry + w.cupRoundness + w.cupDepth + w.handlePullback + w.handleVolume + w.proximity;
      const weighted = components.rimSymmetry * w.rimSymmetry + components.cupRoundness * w.cupRoundness
        + components.cupDepth * w.cupDepth + components.handlePullback * w.handlePullback
        + components.handleVolume * w.handleVolume + components.proximity * w.proximity;
      const score = weightSum > 0 ? weighted / weightSum : 0;

      if (!best || score > best.score) {
        best = {
          score, components,
          resistance: Math.max(leftRim.price, rightRim.price),
          leftRimPrice: leftRim.price, rightRimPrice: rightRim.price,
          cupBottomPrice: cupBottom.price, handleLowPrice: handleLow,
          cupStartIndex: leftRim.index, cupBottomIndex: cupBottom.index,
          rightRimIndex: rightRim.index, handleEndIndex,
          stopSuggestion: handleLow - atr, atr, currentPrice,
          cupBars, handleBars: actualHandleBars, barsSinceRim, cupDepth, handlePullback,
          leftRimTime: leftRim.time, rightRimTime: rightRim.time, cupBottomTime: cupBottom.time,
        };
      }
    }
  }

  if (!best) return { reason: `no candidate (sample reasons: ${rejectReasons.slice(0, 12).join(' | ')})`, highPivots: highPivots.length, lowPivots: lowPivots.length };
  return best;
}

async function fetchCandles(symbol, hours) {
  const endTime = Date.now();
  const startTime = endTime - hours * 3600 * 1000;
  const res = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'candleSnapshot', req: { coin: symbol, interval: '1m', startTime, endTime } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  return raw.map(c => ({ time: c.t, open: +c.o, high: +c.h, low: +c.l, close: +c.c, volume: +c.v }));
}

const fmt = (n, d = 5) => typeof n === 'number' ? n.toFixed(d) : String(n);

(async () => {
  console.log(`Fetching ${HOURS}h of 1m ${SYMBOL} candles…`);
  const candles = await fetchCandles(SYMBOL, HOURS);
  console.log(`Got ${candles.length} candles. ${new Date(candles[0].time).toISOString()} → ${new Date(candles.at(-1).time).toISOString()}`);
  console.log(`Price range: ${fmt(Math.min(...candles.map(c => c.low)))} – ${fmt(Math.max(...candles.map(c => c.high)))}\n`);

  const recent = candles.slice(-LOOKBACK_BARS);
  console.log(`=== Latest ${LOOKBACK_BARS}-bar window ===`);
  const r = evaluateCupAndHandle(recent, CONFIG);
  if (r.reason) {
    console.log(`REJECTED: ${r.reason}`);
    if (r.highPivots !== undefined) console.log(`  pivots H=${r.highPivots} L=${r.lowPivots}`);
  } else {
    console.log(`score=${fmt(r.score, 3)} ${r.score >= CONFIG.minScore ? '✅ SIGNAL' : '❌ below threshold'}`);
    console.log(`  resistance=${fmt(r.resistance)}  current=${fmt(r.currentPrice)}  ATR=${fmt(r.atr)}`);
    console.log(`  cup: ${r.cupBars} bars  depth=${(r.cupDepth * 100).toFixed(1)}%  bottom=${fmt(r.cupBottomPrice)}`);
    console.log(`  rims: left=${fmt(r.leftRimPrice)} (${new Date(r.leftRimTime).toISOString()})  right=${fmt(r.rightRimPrice)} (${new Date(r.rightRimTime).toISOString()})`);
    console.log(`  handle: ${r.handleBars} bars  pullback=${(r.handlePullback * 100).toFixed(1)}% of cup  low=${fmt(r.handleLowPrice)}`);
    console.log(`  components:`, Object.fromEntries(Object.entries(r.components).map(([k, v]) => [k, +v.toFixed(3)])));
  }
  console.log('');

  console.log(`=== Sliding scan: ${candles.length - LOOKBACK_BARS + 1} windows ===`);
  const hits = [];
  const top = [];
  for (let i = 0; i + LOOKBACK_BARS <= candles.length; i++) {
    const win = candles.slice(i, i + LOOKBACK_BARS);
    const e = evaluateCupAndHandle(win, CONFIG);
    if (!e.reason) {
      top.push({ endIdx: i + LOOKBACK_BARS - 1, endTime: win.at(-1).time, score: e.score, resistance: e.resistance });
      if (e.score >= CONFIG.minScore) hits.push({ endIdx: i + LOOKBACK_BARS - 1, ...e });
    }
  }
  top.sort((a, b) => b.score - a.score);
  console.log(`Windows with valid candidate: ${top.length}`);
  console.log(`Windows ≥ minScore: ${hits.length}\n`);
  console.log('Top 5 scoring windows:');
  for (const t of top.slice(0, 5)) {
    console.log(`  ${new Date(t.endTime).toISOString()}  score=${fmt(t.score, 3)}  resistance=${fmt(t.resistance)}`);
  }
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
