'use client';

import { useState, useMemo, useEffect } from 'react';
import ScalpingChart from '@/components/ScalpingChart';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useCandleStore } from '@/stores/useCandleStore';
import { getCandleTimeWindow } from '@/lib/time-utils';
import { DEFAULT_CANDLE_COUNT } from '@/lib/constants';
import type { TimeInterval, CandleData } from '@/types';

interface ChartPopupViewProps {
  coin: string;
}

const EMPTY_CANDLES: CandleData[] = [];

export default function ChartPopupView({ coin }: ChartPopupViewProps) {
  const [currentPrice, setCurrentPrice] = useState(0);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '5m' | '15m' | '1h'>('1m');
  const [showStochastic, setShowStochastic] = useState(true);
  const getDecimals = useSymbolMetaStore((state) => state.getDecimals);
  const decimals = useMemo(() => getDecimals(coin), [getDecimals, coin]);

  const fetchCandles = useCandleStore((state) => state.fetchCandles);
  const subscribeToCandles = useCandleStore((state) => state.subscribeToCandles);
  const unsubscribeFromCandles = useCandleStore((state) => state.unsubscribeFromCandles);

  const mainChartData = useCandleStore((state) => state.candles[`${coin}-${selectedTimeframe}`] ?? EMPTY_CANDLES);
  const candles1m = useCandleStore((state) => state.candles[`${coin}-1m`] ?? EMPTY_CANDLES);
  const candles5m = useCandleStore((state) => state.candles[`${coin}-5m`] ?? EMPTY_CANDLES);
  const candles15m = useCandleStore((state) => state.candles[`${coin}-15m`] ?? EMPTY_CANDLES);

  useEffect(() => {
    const intervals: TimeInterval[] = ['1m', '5m', '15m'];

    intervals.forEach((interval) => {
      const { startTime, endTime } = getCandleTimeWindow(interval, DEFAULT_CANDLE_COUNT);
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
    '4h': [],
    '1d': [],
  }), [candles1m, candles5m, candles15m]);

  const macdCandleData: Record<TimeInterval, CandleData[]> = useMemo(() => ({
    '1m': candles1m,
    '5m': candles5m,
    '15m': candles15m,
    '1h': [],
    '4h': [],
    '1d': [],
  }), [candles1m, candles5m, candles15m]);

  return (
    <div className="min-h-screen w-screen bg-bg-primary overflow-hidden">
      <div className="flex flex-col h-screen p-2 gap-2">
        {/* Header with Timeframe Selector */}
        <div className="terminal-border p-2 flex-none">
          <div className="flex justify-between items-center">
            <span className="text-primary text-lg font-bold tracking-wider">
              {coin}/USD {currentPrice > 0 && `- $${currentPrice.toFixed(decimals.price)}`}
            </span>
            <div className="flex gap-1">
              {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition-all ${
                    selectedTimeframe === tf
                      ? 'bg-primary/20 text-primary border-2 border-primary'
                      : 'bg-bg-secondary text-primary-muted border-2 border-frame hover:text-primary hover:bg-primary/10'
                  }`}
                >
                  {tf}
                </button>
              ))}
              <button
                onClick={() => setShowStochastic(!showStochastic)}
                className={`px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition-all ${
                  showStochastic
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-bg-secondary text-primary-muted border-2 border-frame hover:text-primary hover:bg-primary/10'
                }`}
              >
                STOCH
              </button>
            </div>
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
            simplifiedView={true}
            hideStochastic={!showStochastic}
          />
        </div>
      </div>
    </div>
  );
}
