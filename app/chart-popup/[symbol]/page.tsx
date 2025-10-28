'use client';

import { useState, use, useMemo } from 'react';
import ScalpingChart from '@/components/ScalpingChart';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useLocalCandleSubscription } from '@/hooks/useLocalCandleSubscription';
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

  const mainChartData = useLocalCandleSubscription({ coin, interval: selectedTimeframe });
  const stoch1mData = useLocalCandleSubscription({ coin, interval: '1m' });
  const stoch5mData = useLocalCandleSubscription({ coin, interval: '5m' });
  const stoch15mData = useLocalCandleSubscription({ coin, interval: '15m' });

  const stochasticCandleData: Record<TimeInterval, CandleData[]> = useMemo(() => ({
    '1m': stoch1mData.candles,
    '5m': stoch5mData.candles,
    '15m': stoch15mData.candles,
    '1h': [],
  }), [stoch1mData.candles, stoch5mData.candles, stoch15mData.candles]);

  return (
    <div className="min-h-screen bg-bg-primary p-4">
      <div className="max-w-full mx-auto space-y-4">
        {/* Header */}
        <div className="terminal-border p-2">
          <div className="text-center">
            <span className="text-primary text-lg font-bold tracking-wider">
              {coin}/USD {currentPrice > 0 && `- $${currentPrice.toFixed(decimals.price)}`}
            </span>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="terminal-border p-2">
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
        <div className="terminal-border p-2">
          <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">█ {selectedTimeframe.toUpperCase()} SCALPING CHART</div>
          <ScalpingChart
            coin={coin}
            interval={selectedTimeframe}
            candleData={mainChartData.candles}
            isExternalData={true}
            onPriceUpdate={setCurrentPrice}
            stochasticCandleData={stochasticCandleData}
          />
        </div>
      </div>
    </div>
  );
}
