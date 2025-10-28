'use client';

import { useEffect, useState } from 'react';

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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const endTime = Date.now();
        const startTime = endTime - 24 * 60 * 60 * 1000;

        const response = await fetch(
          `/api/candles?coin=${coin}&interval=1h&startTime=${startTime}&endTime=${endTime}`
        );
        const candles = await response.json();

        if (candles.length > 0) {
          const high24h = Math.max(...candles.map((c: any) => c.high));
          const low24h = Math.min(...candles.map((c: any) => c.low));
          const volume24h = candles.reduce((sum: number, c: any) => sum + c.volume, 0);
          const firstPrice = candles[0].open;
          const change24h = ((currentPrice - firstPrice) / firstPrice) * 100;

          setStats({ high24h, low24h, volume24h, change24h });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000);

    return () => clearInterval(interval);
  }, [coin, currentPrice]);

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
      <div className="grid grid-cols-5 gap-3 text-[10px]">
        <div>
          <div className="text-[#537270] uppercase tracking-wider font-bold mb-0.5">PRICE</div>
          <div className="text-[#44baba] text-base font-bold font-mono">${formatNumber(currentPrice)}</div>
        </div>

        {stats && (
          <>
            <div>
              <div className="text-[#537270] uppercase tracking-wider font-bold mb-0.5">24H CHANGE</div>
              <div
                className={`text-base font-bold font-mono ${
                  stats.change24h >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'
                }`}
              >
                {stats.change24h >= 0 ? '+' : ''}
                {formatNumber(stats.change24h)}%
              </div>
            </div>

            <div>
              <div className="text-[#537270] uppercase tracking-wider font-bold mb-0.5">24H HIGH</div>
              <div className="text-[#44baba] text-base font-bold font-mono">${formatNumber(stats.high24h)}</div>
            </div>

            <div>
              <div className="text-[#537270] uppercase tracking-wider font-bold mb-0.5">24H LOW</div>
              <div className="text-[#44baba] text-base font-bold font-mono">${formatNumber(stats.low24h)}</div>
            </div>

            <div>
              <div className="text-[#537270] uppercase tracking-wider font-bold mb-0.5">24H VOLUME</div>
              <div className="text-[#44baba] text-base font-bold font-mono">{formatVolume(stats.volume24h)}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
