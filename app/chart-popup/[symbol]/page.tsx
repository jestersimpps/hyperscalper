'use client';

import { useState, use, useMemo, useEffect } from 'react';
import ScalpingChart from '@/components/ScalpingChart';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useCandleStore } from '@/stores/useCandleStore';
import { getStandardTimeWindow } from '@/lib/time-utils';
import type { TimeInterval, CandleData } from '@/types';

interface ChartPopupPageProps {
  params: Promise<{
    symbol: string;
  }>;
}

export default function ChartPopupPage({ params }: ChartPopupPageProps) {
  const { symbol } = use(params);
  const coin = symbol;
  const [currentPrice, setCurrentPrice] = useState(0);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '5m' | '15m' | '1h'>('1m');
  const getDecimals = useSymbolMetaStore((state) => state.getDecimals);
  const decimals = useMemo(() => getDecimals(coin), [getDecimals, coin]);

  const fetchCandles = useCandleStore((state) => state.fetchCandles);
  const subscribeToCandles = useCandleStore((state) => state.subscribeToCandles);
  const unsubscribeFromCandles = useCandleStore((state) => state.unsubscribeFromCandles);

  const mainChartData = useCandleStore((state) => state.candles[`${coin}-${selectedTimeframe}`] || []);
  const candles1m = useCandleStore((state) => state.candles[`${coin}-1m`] || []);
  const candles5m = useCandleStore((state) => state.candles[`${coin}-5m`] || []);
  const candles15m = useCandleStore((state) => state.candles[`${coin}-15m`] || []);

  useEffect(() => {
    const { startTime, endTime } = getStandardTimeWindow();
    const intervals: TimeInterval[] = ['1m', '5m', '15m'];

    intervals.forEach((interval) => {
      fetchCandles(coin, interval, startTime, endTime);
      subscribeToCandles(coin, interval);
    });

    return () => {
      intervals.forEach((interval) => {
        unsubscribeFromCandles(coin, interval);
      });
    };
  }, [coin, fetchCandles, subscribeToCandles, unsubscribeFromCandles]);

  const stochasticCandleData: Record<TimeInterval, CandleData[]> = useMemo(() => ({
    '1m': candles1m,
    '5m': candles5m,
    '15m': candles15m,
    '1h': [],
  }), [candles1m, candles5m, candles15m]);

  const macdCandleData: Record<TimeInterval, CandleData[]> = useMemo(() => ({
    '1m': candles1m,
    '5m': candles5m,
    '15m': candles15m,
    '1h': [],
  }), [candles1m, candles5m, candles15m]);

  return (
    <div className="min-h-screen w-screen bg-bg-primary overflow-hidden">
      <div className="flex flex-col h-screen p-2 gap-2">
        {/* Header */}
        <div className="terminal-border p-2 flex-none">
          <div className="text-center">
            <span className="text-primary text-lg font-bold tracking-wider">
              {coin}/USD {currentPrice > 0 && `- $${currentPrice.toFixed(decimals.price)}`}
            </span>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="terminal-border p-2 flex-none">
          <div className="flex gap-2">
            {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`flex-1 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all ${
                  selectedTimeframe === tf
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-bg-secondary text-primary-muted border-2 border-frame hover:text-primary hover:bg-primary/10'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Scalping Chart */}
        <div className="terminal-border p-2 flex-1 min-h-0">
          <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">█ {selectedTimeframe.toUpperCase()} SCALPING CHART</div>
          <ScalpingChart
            coin={coin}
            interval={selectedTimeframe}
            candleData={mainChartData}
            isExternalData={true}
            onPriceUpdate={setCurrentPrice}
            macdCandleData={macdCandleData}
          />
        </div>
      </div>
    </div>
  );
}
