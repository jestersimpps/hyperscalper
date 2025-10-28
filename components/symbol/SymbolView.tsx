'use client';

import { useState, useCallback } from 'react';
import CandlestickChart from '@/components/CandlestickChart';
import CombinedStochasticChart from '@/components/CombinedStochasticChart';
import MarketStats from '@/components/MarketStats';
import OrderBook from '@/components/OrderBook';
import TerminalHeader from '@/components/layout/TerminalHeader';
import TerminalFooter from '@/components/layout/TerminalFooter';

interface SymbolViewProps {
  coin: string;
}

export default function SymbolView({ coin }: SymbolViewProps) {
  const [currentPrice, setCurrentPrice] = useState(0);
  const [mainChart, setMainChart] = useState<any>(null);
  const [stochChart, setStochChart] = useState<any>(null);

  const handleMainChartReady = useCallback((chart: any) => {
    setMainChart(chart);
  }, []);

  const handleStochChartReady = useCallback((chart: any) => {
    setStochChart(chart);
  }, []);

  const syncCharts = useCallback(() => {
    if (mainChart && stochChart) {
      mainChart.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
        if (range) {
          stochChart.timeScale().setVisibleLogicalRange(range);
        }
      });

      stochChart.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
        if (range) {
          mainChart.timeScale().setVisibleLogicalRange(range);
        }
      });
    }
  }, [mainChart, stochChart]);

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-full mx-auto p-2">
        {/* Header */}
        <TerminalHeader coin={coin} />

        {/* Market Stats */}
        <div className="mb-2">
          <MarketStats coin={coin} currentPrice={currentPrice} />
        </div>

        {/* Main Content - Side by Side */}
        <div className="flex gap-2">
          {/* Left Side - Charts */}
          <div className="w-1/2 flex flex-col gap-2">
            <div className="terminal-border p-1.5">
              <div className="text-[10px] text-primary-muted mb-1 uppercase tracking-wider">█ 1MIN CHART</div>
              <CandlestickChart
                coin={coin}
                interval="1m"
                onPriceUpdate={setCurrentPrice}
                onChartReady={handleMainChartReady}
              />
            </div>

            <div className="terminal-border p-1.5">
              <div className="text-[10px] text-primary-muted mb-1 uppercase tracking-wider">█ STOCHASTIC (1m/5m/15m)</div>
              <CombinedStochasticChart coin={coin} onChartReady={handleStochChartReady} />
            </div>
          </div>

          {/* Right Side - Trading Info */}
          <div className="w-1/2 flex flex-col gap-2">
            {/* Order Book */}
            <div className="terminal-border p-1.5 flex-1">
              <div className="text-[10px] text-primary-muted mb-1.5 uppercase tracking-wider">█ ORDER BOOK</div>
              <OrderBook coin={coin} />
            </div>

            {/* Recent Trades Placeholder */}
            <div className="terminal-border p-1.5 flex-1">
              <div className="text-[10px] text-primary-muted mb-1.5 uppercase tracking-wider">█ RECENT TRADES</div>
              <div className="text-[10px] space-y-0.5 font-mono">
                <div className="grid grid-cols-3 text-primary-muted mb-1 font-bold">
                  <div>PRICE</div>
                  <div className="text-right">SIZE</div>
                  <div className="text-right">TIME</div>
                </div>
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="grid grid-cols-3 text-primary/70">
                    <div>---.--</div>
                    <div className="text-right">-.-</div>
                    <div className="text-right">--:--</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Position Info */}
            <div className="terminal-border p-1.5">
              <div className="text-[10px] text-primary-muted mb-1.5 uppercase tracking-wider">█ POSITION</div>
              <div className="text-[10px] space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-primary-muted">SIZE:</span>
                  <span className="text-primary">-- BTC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-muted">ENTRY:</span>
                  <span className="text-primary">---.--</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-muted">PNL:</span>
                  <span className="text-primary">+-.-- USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-muted">LEVERAGE:</span>
                  <span className="text-primary">--x</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <TerminalFooter coin={coin} />
      </div>
    </div>
  );
}
