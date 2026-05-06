'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebarPricesStore } from '@/stores/useSidebarPricesStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useSymbolVolatilityStore } from '@/stores/useSymbolVolatilityStore';
import { useTradesStore } from '@/stores/useTradesStore';
import { formatPrice } from '@/lib/format-utils';
import { useAddressFromUrl } from '@/lib/hooks/use-address-from-url';

const BTC = 'BTC';
const PRESSURE_WINDOW_MS = 5 * 60_000;
const SPARKLINE_WINDOW_MS = 60_000;
const SPARKLINE_SAMPLE_MS = 1_000;
const SPARKLINE_SAMPLES = SPARKLINE_WINDOW_MS / SPARKLINE_SAMPLE_MS;

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
  const sparklineRef = useRef<number[]>([]);
  const [sparklineTick, setSparklineTick] = useState(0);

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

  useEffect(() => {
    const sample = () => {
      const price = useSidebarPricesStore.getState().prices[BTC];
      if (!price) return;
      const buf = sparklineRef.current;
      buf.push(price);
      if (buf.length > SPARKLINE_SAMPLES) buf.splice(0, buf.length - SPARKLINE_SAMPLES);
      setSparklineTick((t) => t + 1);
    };
    sample();
    const id = setInterval(sample, SPARKLINE_SAMPLE_MS);
    return () => clearInterval(id);
  }, []);

  const { buyVolume, sellVolume, buyPct, dominantSide, imbalancePct } = useMemo(() => {
    const cutoff = now - PRESSURE_WINDOW_MS;
    let buy = 0;
    let sell = 0;
    if (trades) {
      for (const t of trades) {
        if (t.time < cutoff) break;
        const notional = t.price * t.size;
        if (t.side === 'buy') buy += notional;
        else sell += notional;
      }
    }
    const total = buy + sell;
    const pct = total > 0 ? (buy / total) * 100 : 50;
    const dom: 'buy' | 'sell' | 'flat' = total === 0 ? 'flat' : buy > sell ? 'buy' : 'sell';
    const imb = total > 0 ? Math.abs(buy - sell) / total * 100 : 0;
    return { buyVolume: buy, sellVolume: sell, buyPct: pct, dominantSide: dom, imbalancePct: imb };
  }, [trades, now]);

  const sparklinePath = useMemo(() => {
    void sparklineTick;
    const prices = sparklineRef.current;
    if (prices.length < 2) return null;
    let min = prices[0];
    let max = prices[0];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] < min) min = prices[i];
      if (prices[i] > max) max = prices[i];
    }
    const flat = max - min === 0;
    const range = flat ? 1 : max - min;
    const w = 100;
    const h = 100;
    const padY = 10;
    const innerH = h - padY * 2;
    const stepX = w / (SPARKLINE_SAMPLES - 1);
    const startX = w - (prices.length - 1) * stepX;
    let d = '';
    for (let i = 0; i < prices.length; i++) {
      const x = startX + i * stepX;
      const y = flat ? h / 2 : padY + innerH - ((prices[i] - min) / range) * innerH;
      d += i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : ` L${x.toFixed(2)},${y.toFixed(2)}`;
    }
    return d;
  }, [sparklineTick]);

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

  const sparklineColor = percentChange >= 0 ? 'var(--status-bullish)' : 'var(--status-bearish)';

  const handleClick = () => {
    if (address) router.push(`/${address}/${BTC}`);
  };

  const pressureBlock = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] font-mono leading-none">
        <span className="text-primary-muted uppercase tracking-wider">Pressure 5m</span>
        <span className={`${dominantColor} font-bold tabular-nums`}>
          {dominantLabel}
          {dominantSide !== 'flat' && ` ${imbalancePct.toFixed(0)}%`}
        </span>
      </div>
      <div
        className="relative h-2 bg-bg-secondary border border-frame overflow-hidden"
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
          className="absolute inset-y-0 w-px bg-primary/40"
          style={{ left: '50%' }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono leading-none tabular-nums">
        <span className="text-bullish">{formatNotional(buyVolume)}</span>
        <span className="text-bearish">{formatNotional(sellVolume)}</span>
      </div>
    </div>
  );

  return (
    <div className="terminal-border p-2 mb-2 flex-shrink-0 @container">
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

        <div className="flex-1 min-w-0 flex flex-col gap-1.5 justify-center">
          <div className="relative h-10 @[420px]:h-12">
            {sparklinePath ? (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="w-full h-full block"
              >
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke={sparklineColor}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-primary-muted font-mono">
                waiting for ticks…
              </div>
            )}
            <div className="pointer-events-none absolute top-0.5 left-1 text-[9px] font-mono text-primary-muted leading-none">
              1m
            </div>
          </div>
          <div className="@[420px]:hidden">{pressureBlock}</div>
        </div>

        <div className="hidden @[420px]:flex flex-shrink-0 w-[170px] flex-col justify-center">
          {pressureBlock}
        </div>
      </div>
    </div>
  );
}

export default memo(BtcStrip);
