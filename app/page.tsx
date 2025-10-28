'use client';

import { useState, useRef, useCallback } from 'react';
import CandlestickChart from '@/components/CandlestickChart';
import CombinedStochasticChart from '@/components/CombinedStochasticChart';
import MarketStats from '@/components/MarketStats';
import OrderBook from '@/components/OrderBook';

export default function Home() {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const coin = 'BTC';
  const mainChartRef = useRef<any>(null);
  const stochChartRef = useRef<any>(null);
  const isSyncingRef = useRef<boolean>(false);

  const syncCharts = useCallback(() => {
    if (!mainChartRef.current || !stochChartRef.current) return;

    const mainTimeScale = mainChartRef.current.timeScale();
    const stochTimeScale = stochChartRef.current.timeScale();

    mainTimeScale.subscribeVisibleLogicalRangeChange((range: any) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      try {
        if (range && stochTimeScale) {
          stochTimeScale.setVisibleLogicalRange(range);
        }
      } finally {
        isSyncingRef.current = false;
      }
    });

    stochTimeScale.subscribeVisibleLogicalRangeChange((range: any) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      try {
        if (range && mainTimeScale) {
          mainTimeScale.setVisibleLogicalRange(range);
        }
      } finally {
        isSyncingRef.current = false;
      }
    });
  }, []);

  const handleMainChartReady = useCallback((chart: any) => {
    mainChartRef.current = chart;

    if (stochChartRef.current) {
      syncCharts();
    }
  }, [syncCharts]);

  const handleStochChartReady = useCallback((chart: any) => {
    stochChartRef.current = chart;

    if (mainChartRef.current) {
      syncCharts();
    }
  }, [syncCharts]);

  return (
    <div className="min-h-screen bg-bg-primary text-primary font-mono">
      <style jsx global>{`
        body {
          background: var(--background-primary);
          font-family: 'Courier New', monospace;
        }
        .terminal-border {
          border: 2px solid var(--border-frame);
          box-shadow: 0 0 10px rgba(39, 48, 53, 0.5);
        }
        .terminal-text {
          text-shadow: 0 0 5px rgba(68, 186, 186, 0.5);
        }
      `}</style>

      <div className="max-w-full mx-auto p-2">
        {/* Header */}
        <div className="terminal-border p-1.5 mb-2">
          <div className="flex justify-between items-center">
            <div className="terminal-text">
              <span className="text-[#44baba] text-sm font-bold tracking-wider">█ HYPERLIQUID TERMINAL</span>
              <span className="ml-3 text-[#537270] text-[10px]">v1.0.0</span>
            </div>
            <div className="text-right text-[10px]">
              <div className="text-[#44baba] font-bold">{coin}/USD</div>
              <div className="text-[#537270]">{new Date().toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Market Stats */}
        <div className="mb-2">
          <MarketStats coin={coin} currentPrice={currentPrice} />
        </div>

        {/* Main Content - Side by Side */}
        <div className="flex gap-2">
          {/* Left Side - Charts */}
          <div className="w-1/2 flex flex-col gap-2">
            <div className="terminal-border p-1.5">
              <div className="text-[10px] text-[#537270] mb-1 uppercase tracking-wider">█ 1MIN CHART</div>
              <CandlestickChart
                coin={coin}
                interval="1m"
                onPriceUpdate={setCurrentPrice}
                onChartReady={handleMainChartReady}
              />
            </div>

            <div className="terminal-border p-1.5">
              <div className="text-[10px] text-[#537270] mb-1 uppercase tracking-wider">█ STOCHASTIC (1m/5m/15m)</div>
              <CombinedStochasticChart coin={coin} onChartReady={handleStochChartReady} />
            </div>
          </div>

          {/* Right Side - Trading Info */}
          <div className="w-1/2 flex flex-col gap-2">
            {/* Order Book */}
            <div className="terminal-border p-1.5 flex-1">
              <div className="text-[10px] text-[#537270] mb-1.5 uppercase tracking-wider">█ ORDER BOOK</div>
              <OrderBook coin={coin} />
            </div>

            {/* Recent Trades Placeholder */}
            <div className="terminal-border p-1.5 flex-1">
              <div className="text-[10px] text-[#537270] mb-1.5 uppercase tracking-wider">█ RECENT TRADES</div>
              <div className="text-[10px] space-y-0.5 font-mono">
                <div className="grid grid-cols-3 text-[#537270] mb-1 font-bold">
                  <div>PRICE</div>
                  <div className="text-right">SIZE</div>
                  <div className="text-right">TIME</div>
                </div>
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="grid grid-cols-3 text-[#44baba]/70">
                    <div>---.--</div>
                    <div className="text-right">-.-</div>
                    <div className="text-right">--:--</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Position Info */}
            <div className="terminal-border p-1.5">
              <div className="text-[10px] text-[#537270] mb-1.5 uppercase tracking-wider">█ POSITION</div>
              <div className="text-[10px] space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-[#537270]">SIZE:</span>
                  <span className="text-[#44baba]">-- BTC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#537270]">ENTRY:</span>
                  <span className="text-[#44baba]">---.--</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#537270]">PNL:</span>
                  <span className="text-[#44baba]">+-.-- USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#537270]">LEVERAGE:</span>
                  <span className="text-[#44baba]">--x</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="terminal-border p-1 mt-2">
          <div className="text-[10px] text-[#537270] text-center font-mono tracking-wider">
            █ CONNECTED █ STREAMING █ {coin}/USD █ HYPERLIQUID API █
          </div>
        </div>
      </div>
    </div>
  );
}
