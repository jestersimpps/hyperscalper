'use client';

import { useState, useMemo, useEffect } from 'react';
import MultiTimeframeChart from '@/components/MultiTimeframeChart';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useCandleStore } from '@/stores/useCandleStore';
import { getStandardTimeWindow } from '@/lib/time-utils';
import type { TimeInterval } from '@/types';

interface MultiChartViewProps {
  coin: string;
}

export default function MultiChartView({ coin }: MultiChartViewProps) {
  const [currentPrice, setCurrentPrice] = useState(0);
  const getDecimals = useSymbolMetaStore((state) => state.getDecimals);
  const decimals = useMemo(() => getDecimals(coin), [getDecimals, coin]);

  const fetchCandles = useCandleStore((state) => state.fetchCandles);
  const subscribeToCandles = useCandleStore((state) => state.subscribeToCandles);
  const unsubscribeFromCandles = useCandleStore((state) => state.unsubscribeFromCandles);
  const candles1m = useCandleStore((state) => state.candles[`${coin}-1m`] || []);

  useEffect(() => {
    const { startTime, endTime } = getStandardTimeWindow();
    const intervals: TimeInterval[] = ['1m', '5m', '15m', '1h'];

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

  useEffect(() => {
    if (candles1m.length > 0) {
      const lastCandle = candles1m[candles1m.length - 1];
      setCurrentPrice(lastCandle.close);
    }
  }, [candles1m]);

  return (
    <div className="min-h-screen w-screen bg-bg-primary overflow-hidden">
      <div className="flex flex-col h-screen">
        <div className="terminal-border p-2 flex-none m-2">
          <div className="text-center">
            <span className="text-primary text-lg font-bold tracking-wider">
              {coin}/USD {currentPrice > 0 && `- $${currentPrice.toFixed(decimals.price)}`}
            </span>
            <span className="text-primary-muted text-xs ml-4 uppercase tracking-wider">
              Multi-Timeframe View
            </span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <MultiTimeframeChart coin={coin} />
        </div>
      </div>
    </div>
  );
}
