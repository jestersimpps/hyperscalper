'use client';

import { useEffect, useState, useMemo } from 'react';
import { useCandleStore } from '@/stores/useCandleStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { getCandleTimeWindow } from '@/lib/time-utils';

interface MarketStatsProps {
  coin: string;
  currentPrice: number;
}

export default function MarketStats({ coin, currentPrice }: MarketStatsProps) {
  const [stats, setStats] = useState<{
    high24h: number;
    low24h: number;
    volume24h: number;
    change24h: number;
  } | null>(null);

  const candleKey = `${coin}-1h`;
  const candles = useCandleStore((state) => state.candles[candleKey]) || [];

  const decimals = useMemo(() => {
    return useSymbolMetaStore.getState().getDecimals(coin);
  }, [coin]);

  useEffect(() => {
    const { startTime, endTime } = getCandleTimeWindow('1h', 24);
    const { fetchCandles, subscribeToCandles } = useCandleStore.getState();
    fetchCandles(coin, '1h', startTime, endTime);
    subscribeToCandles(coin, '1h');

    return () => {
      const { unsubscribeFromCandles } = useCandleStore.getState();
      unsubscribeFromCandles(coin, '1h');
    };
  }, [coin]);

  useEffect(() => {
    if (candles.length > 0) {
      const high24h = Math.max(...candles.map(c => c.high));
      const low24h = Math.min(...candles.map(c => c.low));
      const volume24h = candles.reduce((sum, c) => sum + c.volume, 0);
      const firstPrice = candles[0].open;
      const change24h = ((currentPrice - firstPrice) / firstPrice) * 100;

      setStats({ high24h, low24h, volume24h, change24h });
    }
  }, [candles, currentPrice]);

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(2)}K`;
    return formatNumber(volume);
  };

  return (
    <div className="terminal-border p-1.5">
      <div className="grid grid-cols-6 gap-3 text-[10px]">
        <div>
          <div className="text-primary-muted uppercase tracking-wider font-bold mb-0.5">MARKET</div>
          <div className="text-primary text-base font-bold font-mono">{coin}</div>
        </div>

        <div>
          <div className="text-primary-muted uppercase tracking-wider font-bold mb-0.5">PRICE</div>
          <div className="text-primary text-base font-bold font-mono">${parseFloat(currentPrice.toFixed(decimals.price))}</div>
        </div>

        {stats && (
          <>
            <div>
              <div className="text-primary-muted uppercase tracking-wider font-bold mb-0.5">24H CHANGE</div>
              <div
                className={`text-base font-bold font-mono ${
                  stats.change24h >= 0 ? 'text-bullish' : 'text-bearish'
                }`}
              >
                {stats.change24h >= 0 ? '+' : ''}
                {formatNumber(stats.change24h)}%
              </div>
            </div>

            <div>
              <div className="text-primary-muted uppercase tracking-wider font-bold mb-0.5">24H HIGH</div>
              <div className="text-primary text-base font-bold font-mono">${parseFloat(stats.high24h.toFixed(decimals.price))}</div>
            </div>

            <div>
              <div className="text-primary-muted uppercase tracking-wider font-bold mb-0.5">24H LOW</div>
              <div className="text-primary text-base font-bold font-mono">${parseFloat(stats.low24h.toFixed(decimals.price))}</div>
            </div>

            <div>
              <div className="text-primary-muted uppercase tracking-wider font-bold mb-0.5">24H VOLUME</div>
              <div className="text-primary text-base font-bold font-mono">{formatVolume(stats.volume24h)}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
