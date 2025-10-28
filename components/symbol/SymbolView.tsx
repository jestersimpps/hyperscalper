'use client';

import { useState, useCallback, useEffect } from 'react';
import CandlestickChart from '@/components/CandlestickChart';
import CombinedStochasticChart from '@/components/CombinedStochasticChart';
import MarketStats from '@/components/MarketStats';
import OrderBook from '@/components/OrderBook';
import TerminalHeader from '@/components/layout/TerminalHeader';
import TerminalFooter from '@/components/layout/TerminalFooter';
import { useTradesStore } from '@/stores/useTradesStore';

interface SymbolViewProps {
  coin: string;
}

export default function SymbolView({ coin }: SymbolViewProps) {
  const [currentPrice, setCurrentPrice] = useState(0);
  const [mainChart, setMainChart] = useState<any>(null);
  const [stochChart, setStochChart] = useState<any>(null);

  const trades = useTradesStore((state) => state.trades[coin]) || [];
  const subscribeToTrades = useTradesStore((state) => state.subscribeToTrades);
  const unsubscribeFromTrades = useTradesStore((state) => state.unsubscribeFromTrades);

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

  useEffect(() => {
    subscribeToTrades(coin);

    return () => {
      unsubscribeFromTrades(coin);
    };
  }, [coin, subscribeToTrades, unsubscribeFromTrades]);

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
            {/* Order Book and Recent Trades - Side by Side */}
            <div className="flex gap-2 h-[600px]">
              {/* Order Book */}
              <div className="terminal-border p-1.5 flex-1">
                <div className="text-[10px] text-primary-muted mb-1.5 uppercase tracking-wider">█ ORDER BOOK</div>
                <OrderBook coin={coin} />
              </div>

              {/* Recent Trades */}
              <div className="terminal-border p-1.5 flex-1 flex flex-col overflow-hidden h-full">
                <div className="text-[10px] text-primary-muted mb-1.5 uppercase tracking-wider">█ RECENT TRADES</div>

                <div className="grid grid-cols-3 text-[10px] text-primary-muted mb-1 font-bold font-mono">
                  <div>PRICE</div>
                  <div className="text-right">SIZE</div>
                  <div className="text-right">TIME</div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-primary-dark scrollbar-track-transparent">
                  <div className="text-[10px] font-mono space-y-0.5">
                    {trades.length === 0 ? (
                      [...Array(10)].map((_, i) => (
                        <div key={i} className="grid grid-cols-3 text-primary/70">
                          <div>---.--</div>
                          <div className="text-right">-.-</div>
                          <div className="text-right">--:--</div>
                        </div>
                      ))
                    ) : (
                      (() => {
                        const maxSize = Math.max(...trades.map(t => t.size));

                        return trades.map((trade, index) => {
                          const percentage = maxSize > 0 ? (trade.size / maxSize) * 100 : 0;

                          return (
                            <div key={`${trade.time}-${index}`} className={`grid grid-cols-3 relative ${trade.side === 'buy' ? 'text-bullish' : 'text-bearish'}`}>
                              <div
                                className={`absolute inset-0 ${trade.side === 'buy' ? 'bg-bullish' : 'bg-bearish'} opacity-5`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                              <div className="relative z-10">{trade.price.toFixed(2)}</div>
                              <div className="relative z-10 text-right">{trade.size.toFixed(4)}</div>
                              <div className="relative z-10 text-right">
                                {new Date(trade.time).toLocaleTimeString('en-US', {
                                  hour12: false,
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                </div>
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
