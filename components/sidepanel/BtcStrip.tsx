'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebarPricesStore } from '@/stores/useSidebarPricesStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useSymbolVolatilityStore } from '@/stores/useSymbolVolatilityStore';
import { useTradesStore } from '@/stores/useTradesStore';
import { formatPrice } from '@/lib/format-utils';
import { useAddressFromUrl } from '@/lib/hooks/use-address-from-url';
import MiniPriceChart from '@/components/scanner/MiniPriceChart';

const BTC = 'BTC';
const PRESSURE_WINDOW_MS = 5 * 60_000;
const SPARKLINE_WINDOW_MS = 60_000;
const BUCKET_MS = 1_000;
const BUCKET_COUNT = PRESSURE_WINDOW_MS / BUCKET_MS;
const SPARKLINE_BUCKET_COUNT = SPARKLINE_WINDOW_MS / BUCKET_MS;
const SPIKE_THRESHOLD_PCT = 0.15;

function BtcStrip() {
  const router = useRouter();
  const address = useAddressFromUrl();

  const livePrice = useSidebarPricesStore((state) => state.prices[BTC]);

  const decimals = useSymbolMetaStore.getState().getDecimals(BTC);
  const volatility = useSymbolVolatilityStore((state) => state.volatility[BTC]);
  const subscribeVolatility = useSymbolVolatilityStore((state) => state.subscribe);
  const unsubscribeVolatility = useSymbolVolatilityStore((state) => state.unsubscribe);

  const trades = useTradesStore((state) => state.trades[BTC]);
  const subscribeToTrades = useTradesStore((state) => state.subscribeToTrades);
  const unsubscribeFromTrades = useTradesStore((state) => state.unsubscribeFromTrades);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    subscribeToTrades(BTC);
    return () => unsubscribeFromTrades(BTC);
  }, [subscribeToTrades, unsubscribeFromTrades]);

  useEffect(() => {
    subscribeVolatility([BTC]);
    return () => unsubscribeVolatility([BTC]);
  }, [subscribeVolatility, unsubscribeVolatility]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const {
    buyVolume,
    sellVolume,
    buyPct,
    dominantSide,
    imbalancePct,
    rollingPrices,
    spikePct,
    spikeDirection,
    spikeAgeSec,
  } = useMemo(() => {
    const windowEnd = Math.floor(now / BUCKET_MS) * BUCKET_MS;
    const cutoff = windowEnd - PRESSURE_WINDOW_MS;
    let buy = 0;
    let sell = 0;
    const lastPriceInBucket = new Array<number | null>(BUCKET_COUNT).fill(null);
    if (trades) {
      for (const t of trades) {
        if (t.time < cutoff) break;
        const notional = t.price * t.size;
        if (t.side === 'buy') buy += notional;
        else sell += notional;
        const idx = Math.floor((t.time - cutoff) / BUCKET_MS);
        if (idx >= 0 && idx < BUCKET_COUNT && lastPriceInBucket[idx] === null) {
          lastPriceInBucket[idx] = t.price;
        }
      }
    }
    const total = buy + sell;
    const pct = total > 0 ? (buy / total) * 100 : 50;
    const dom: 'buy' | 'sell' | 'flat' = total === 0 ? 'flat' : buy > sell ? 'buy' : 'sell';
    const imb = total > 0 ? Math.abs(buy - sell) / total * 100 : 0;

    if (livePrice) lastPriceInBucket[BUCKET_COUNT - 1] = livePrice;

    let firstKnown: number | null = null;
    for (let i = 0; i < BUCKET_COUNT; i++) {
      if (lastPriceInBucket[i] !== null) {
        firstKnown = lastPriceInBucket[i];
        break;
      }
    }
    const prices: number[] = new Array(BUCKET_COUNT);
    let carry = firstKnown;
    for (let i = 0; i < BUCKET_COUNT; i++) {
      const v = lastPriceInBucket[i];
      if (v !== null) carry = v;
      prices[i] = carry ?? 0;
    }
    if (firstKnown === null) prices.length = 0;

    let spike = 0;
    let dir: 'up' | 'down' | null = null;
    let ageSec = 0;
    if (prices.length >= 2 && livePrice) {
      let extremePrice = livePrice;
      let extremeIdx = BUCKET_COUNT - 1;
      for (let i = 0; i < prices.length; i++) {
        if (Math.abs(livePrice - prices[i]) > Math.abs(livePrice - extremePrice)) {
          extremePrice = prices[i];
          extremeIdx = i;
        }
      }
      if (extremePrice > 0) {
        const move = ((livePrice - extremePrice) / extremePrice) * 100;
        if (Math.abs(move) >= SPIKE_THRESHOLD_PCT) {
          spike = move;
          dir = move > 0 ? 'up' : 'down';
          ageSec = Math.max(0, (BUCKET_COUNT - 1 - extremeIdx) * (BUCKET_MS / 1000));
        }
      }
    }

    return {
      buyVolume: buy,
      sellVolume: sell,
      buyPct: pct,
      dominantSide: dom,
      imbalancePct: imb,
      rollingPrices: prices,
      spikePct: spike,
      spikeDirection: dir,
      spikeAgeSec: ageSec,
    };
  }, [trades, now, livePrice]);

  const formatNotional = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const percentChange = volatility?.percentChange ?? 0;
  const changeColor = percentChange >= 0 ? 'text-bullish' : 'text-bearish';
  const changeText = `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`;

  const formattedPrice = livePrice ? formatPrice(livePrice, decimals.price) : '-.--';

  const dominantColor = dominantSide === 'buy'
    ? 'text-bullish'
    : dominantSide === 'sell'
    ? 'text-bearish'
    : 'text-primary-muted';
  const dominantLabel = dominantSide === 'buy'
    ? 'BUY'
    : dominantSide === 'sell'
    ? 'SELL'
    : 'FLAT';

  const handleClick = () => {
    if (address) router.push(`/${address}/${BTC}`);
  };

  return (
    <div className="terminal-border p-2 mb-2 flex-shrink-0">
      <div className="flex items-stretch gap-3">
        <button
          type="button"
          onClick={handleClick}
          className="flex flex-col justify-between text-left flex-shrink-0 w-[110px] cursor-pointer hover:opacity-80 transition-opacity"
          title="Open BTC chart"
        >
          <span className="text-primary text-xs font-bold tracking-wider">█ BTC/USD</span>
          <span className="text-primary text-sm font-mono tabular-nums">${formattedPrice}</span>
          <span className={`text-[10px] font-mono ${changeColor}`}>{changeText}</span>
        </button>

        <div className="flex-1 min-w-0 h-12 self-center relative">
          {rollingPrices.length >= 2 ? (
            <MiniPriceChart
              closePrices={rollingPrices.slice(-SPARKLINE_BUCKET_COUNT)}
              signalType={dominantSide === 'sell' ? 'bearish' : 'bullish'}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-primary-muted font-mono">
              waiting for ticks…
            </div>
          )}
          <div className="pointer-events-none absolute top-0.5 left-1 text-[9px] font-mono text-primary-muted leading-none">
            1m
          </div>
          {spikeDirection && (
            <div
              className={`pointer-events-none absolute top-0.5 right-1 px-1 py-0.5 leading-none text-[10px] font-mono font-bold border ${
                spikeDirection === 'up'
                  ? 'text-bullish border-bullish/60 bg-bullish/10 animate-blink-green'
                  : 'text-bearish border-bearish/60 bg-bearish/10 animate-blink-red'
              }`}
              title={`BTC moved ${spikePct.toFixed(2)}% in last ${spikeAgeSec}s — watch for correlated moves`}
            >
              {spikeDirection === 'up' ? '▲' : '▼'} {Math.abs(spikePct).toFixed(2)}% / {spikeAgeSec}s
            </div>
          )}
        </div>

        <div className="flex-shrink-0 w-[170px] flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between text-[10px] font-mono leading-none">
            <span className="text-primary-muted uppercase tracking-wider">Pressure 5m</span>
            <span className={`${dominantColor} font-bold`}>
              {dominantLabel}
              {dominantSide !== 'flat' && ` ${imbalancePct.toFixed(0)}%`}
            </span>
          </div>
          <div
            className="relative h-3 bg-bg-secondary border border-frame overflow-hidden"
            title={`Buy ${formatNotional(buyVolume)} · Sell ${formatNotional(sellVolume)}`}
          >
            <div
              className="absolute inset-y-0 left-0 bg-bullish/70 transition-all duration-500"
              style={{ width: `${buyPct}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-bearish/70 transition-all duration-500"
              style={{ width: `${100 - buyPct}%` }}
            />
            <div
              className="absolute inset-y-0 w-px bg-primary/60"
              style={{ left: '50%' }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono leading-none tabular-nums">
            <span className="text-bullish">{formatNotional(buyVolume)}</span>
            <span className="text-bearish">{formatNotional(sellVolume)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(BtcStrip);
