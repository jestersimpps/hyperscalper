'use client';

import { useState, useCallback, useEffect, use } from 'react';
import CandlestickChart from '@/components/CandlestickChart';
import CombinedStochasticChart from '@/components/CombinedStochasticChart';

interface ChartPopupPageProps {
  params: Promise<{
    symbol: string;
  }>;
}

export default function ChartPopupPage({ params }: ChartPopupPageProps) {
  const { symbol } = use(params);
  const coin = symbol;
  const [mainChart, setMainChart] = useState<any>(null);
  const [stochChart, setStochChart] = useState<any>(null);
  const [currentPrice, setCurrentPrice] = useState(0);

  const handleMainChartReady = useCallback((chart: any) => {
    setMainChart(chart);
  }, []);

  const handleStochChartReady = useCallback((chart: any) => {
    setStochChart(chart);
  }, []);

  useEffect(() => {
    if (!mainChart || !stochChart) return;

    const mainToStochHandler = (range: any) => {
      if (range) {
        stochChart.timeScale().setVisibleLogicalRange(range);
      }
    };

    const stochToMainHandler = (range: any) => {
      if (range) {
        mainChart.timeScale().setVisibleLogicalRange(range);
      }
    };

    mainChart.timeScale().subscribeVisibleLogicalRangeChange(mainToStochHandler);
    stochChart.timeScale().subscribeVisibleLogicalRangeChange(stochToMainHandler);

    return () => {
      mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(mainToStochHandler);
      stochChart.timeScale().unsubscribeVisibleLogicalRangeChange(stochToMainHandler);
    };
  }, [mainChart, stochChart]);

  return (
    <div className="min-h-screen bg-bg-primary p-4">
      <div className="max-w-full mx-auto space-y-4">
        {/* Header */}
        <div className="terminal-border p-2">
          <div className="text-center">
            <span className="text-primary text-lg font-bold tracking-wider">
              {coin}/USD {currentPrice > 0 && `- $${currentPrice.toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Main Chart */}
        <div className="terminal-border p-2">
          <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">█ 1MIN CHART</div>
          <CandlestickChart
            coin={coin}
            interval="1m"
            onPriceUpdate={setCurrentPrice}
            onChartReady={handleMainChartReady}
          />
        </div>

        {/* Stochastic Chart */}
        <div className="terminal-border p-2">
          <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">█ STOCHASTIC (1m/5m/15m)</div>
          <CombinedStochasticChart coin={coin} onChartReady={handleStochChartReady} />
        </div>
      </div>
    </div>
  );
}
