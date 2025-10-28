'use client';

import { useState, useEffect, useRef } from 'react';
import ScalpingChart from '@/components/ScalpingChart';
import MarketStats from '@/components/MarketStats';
import OrderBook from '@/components/OrderBook';
import TerminalHeader from '@/components/layout/TerminalHeader';
import TradeVolumeTimeline from '@/components/TradeVolumeTimeline';
import { useTradesStore } from '@/stores/useTradesStore';

interface SymbolViewProps {
  coin: string;
}

export default function SymbolView({ coin }: SymbolViewProps) {
  const [currentPrice, setCurrentPrice] = useState(0);
  const [newTradeKeys, setNewTradeKeys] = useState<Set<string>>(new Set());

  const trades = useTradesStore((state) => state.trades[coin]) || [];
  const subscribeToTrades = useTradesStore((state) => state.subscribeToTrades);
  const unsubscribeFromTrades = useTradesStore((state) => state.unsubscribeFromTrades);
  const seenTimestampsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    seenTimestampsRef.current.clear();
    subscribeToTrades(coin);

    return () => {
      unsubscribeFromTrades(coin);
    };
  }, [coin, subscribeToTrades, unsubscribeFromTrades]);

  useEffect(() => {
    if (trades.length === 0) return;

    const newKeys = new Set<string>();
    const seenTimestamps = seenTimestampsRef.current;
    const newTimestamps = new Set<number>();

    trades.forEach((trade, index) => {
      if (!seenTimestamps.has(trade.time)) {
        newTimestamps.add(trade.time);
      }
    });

    if (newTimestamps.size > 0) {
      trades.forEach((trade, index) => {
        if (newTimestamps.has(trade.time)) {
          newKeys.add(`${trade.time}-${index}`);
          seenTimestamps.add(trade.time);
        }
      });

      setNewTradeKeys(newKeys);

      const timer = setTimeout(() => {
        setNewTradeKeys(new Set());
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [trades]);

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <div className="flex flex-col h-full max-w-full mx-auto p-2">
        {/* Header */}
        <TerminalHeader coin={coin} />

        {/* Market Stats */}
        <div className="mb-2">
          <MarketStats coin={coin} currentPrice={currentPrice} />
        </div>

        {/* Main Content - Side by Side */}
        <div className="flex gap-2 overflow-x-auto flex-1 min-h-0">
          {/* Left Side - Charts */}
          <div className="flex-1 min-w-[500px] flex flex-col gap-2">
            <div className="terminal-border p-1.5 flex-1 flex flex-col min-h-0">
              <div className="text-[10px] text-primary-muted mb-1 uppercase tracking-wider">█ SCALPING CHART</div>
              <ScalpingChart
                coin={coin}
                interval="1m"
                onPriceUpdate={setCurrentPrice}
              />
            </div>
          </div>

          {/* Right Side - Trading Info */}
          <div className="flex-1 min-w-[500px] flex gap-2">
            {/* Left Column - Position and Order Book */}
            <div className="flex-shrink-0 w-80 flex flex-col gap-2">
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

                {/* Trading Actions */}
                <div className="mt-3 pt-3 border-t border-frame">
                  <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">█ ACTIONS</div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <button
                      className="px-2 py-1.5 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue hover:bg-accent-blue/30 hover:border-accent-blue/60 transition-all rounded-sm hover:shadow-[0_0_8px_rgba(50,116,170,0.3)]"
                      onClick={() => console.log('Open Buy Cloud')}
                    >
                      █ BUY CLOUD
                    </button>
                    <button
                      className="px-2 py-1.5 bg-accent-rose/20 border border-accent-rose/40 text-accent-rose hover:bg-accent-rose/30 hover:border-accent-rose/60 transition-all rounded-sm hover:shadow-[0_0_8px_rgba(194,150,141,0.3)]"
                      onClick={() => console.log('Open Sell Cloud')}
                    >
                      █ SELL CLOUD
                    </button>
                    <button
                      className="px-2 py-1.5 bg-bullish/20 border border-bullish/40 text-bullish hover:bg-bullish/30 hover:border-bullish/60 transition-all rounded-sm hover:shadow-[0_0_8px_rgba(38,166,154,0.3)]"
                      onClick={() => console.log('Open Small Long')}
                    >
                      █ SM LONG
                    </button>
                    <button
                      className="px-2 py-1.5 bg-bearish/20 border border-bearish/40 text-bearish hover:bg-bearish/30 hover:border-bearish/60 transition-all rounded-sm hover:shadow-[0_0_8px_rgba(239,83,80,0.3)]"
                      onClick={() => console.log('Open Small Short')}
                    >
                      █ SM SHORT
                    </button>
                    <button
                      className="px-2 py-1.5 bg-bullish/30 border-2 border-bullish/60 text-bullish font-bold hover:bg-bullish/40 hover:border-bullish/80 transition-all rounded-sm hover:shadow-[0_0_10px_rgba(38,166,154,0.5)]"
                      onClick={() => console.log('Open Big Long')}
                    >
                      ██ BIG LONG
                    </button>
                    <button
                      className="px-2 py-1.5 bg-bearish/30 border-2 border-bearish/60 text-bearish font-bold hover:bg-bearish/40 hover:border-bearish/80 transition-all rounded-sm hover:shadow-[0_0_10px_rgba(239,83,80,0.5)]"
                      onClick={() => console.log('Open Big Short')}
                    >
                      ██ BIG SHORT
                    </button>
                    <button
                      className="col-span-2 px-2 py-1.5 bg-primary-muted/10 border border-primary-muted/30 text-primary-muted hover:bg-primary-muted/20 hover:border-primary-muted/50 hover:text-primary transition-all rounded-sm hover:shadow-[0_0_8px_rgba(68,186,186,0.2)]"
                      onClick={() => console.log('Close Position')}
                    >
                      █ CLOSE POSITION
                    </button>
                  </div>
                </div>
              </div>

              {/* Order Book */}
              <div className="terminal-border p-1.5 flex-1 overflow-hidden">
                <div className="text-[10px] text-primary-muted mb-1.5 uppercase tracking-wider">█ ORDER BOOK</div>
                <OrderBook coin={coin} />
              </div>
            </div>

            {/* Right Column - Recent Trades */}
            <div className="flex-1 min-w-[200px] flex flex-col gap-2">
              {/* Volume Flow Timeline */}
              <div className="terminal-border p-1.5">
                <div className="text-[10px] text-primary-muted mb-1.5 uppercase tracking-wider">█ VOLUME FLOW</div>
                <TradeVolumeTimeline coin={coin} trades={trades} />
              </div>

              {/* Recent Trades */}
              <div className="terminal-border p-1.5 flex-1 flex flex-col overflow-hidden">
                <style jsx>{`
                  @keyframes flash-green {
                    0%, 100% { background-color: transparent; }
                    50% { background-color: color-mix(in srgb, var(--status-bullish) 30%, transparent); }
                  }
                  @keyframes flash-red {
                    0%, 100% { background-color: transparent; }
                    50% { background-color: color-mix(in srgb, var(--status-bearish) 30%, transparent); }
                  }
                  .animate-flash-green {
                    animation: flash-green 0.5s ease-in-out;
                  }
                  .animate-flash-red {
                    animation: flash-red 0.5s ease-in-out;
                  }
                `}</style>
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
                          const tradeKey = `${trade.time}-${index}`;
                          const isNew = newTradeKeys.has(tradeKey);
                          const flashClass = isNew ? (trade.side === 'buy' ? 'animate-flash-green' : 'animate-flash-red') : '';

                          return (
                            <div key={tradeKey} className={`grid grid-cols-3 relative ${trade.side === 'buy' ? 'text-bullish' : 'text-bearish'} ${flashClass}`}>
                              <div
                                className={`absolute inset-0 ${trade.side === 'buy' ? 'bg-bullish' : 'bg-bearish'} opacity-20`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                              <div className="relative z-10">{trade.priceFormatted}</div>
                              <div className="relative z-10 text-right">{trade.sizeFormatted}</div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
