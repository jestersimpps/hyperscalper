'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ScalpingChart from '@/components/ScalpingChart';
import MarketStats from '@/components/MarketStats';
import OrderBook from '@/components/OrderBook';
import TerminalHeader from '@/components/layout/TerminalHeader';
import TradeVolumeTimeline from '@/components/TradeVolumeTimeline';
import { useTradesStore } from '@/stores/useTradesStore';
import { usePositionStore } from '@/stores/usePositionStore';
import { playNotificationSound } from '@/lib/sound-utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { KeyBinding } from '@/lib/keyboard-utils';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';

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
  const isPanelOpen = useSettingsStore((state) => state.isPanelOpen);

  const position = usePositionStore((state) => state.positions[coin]);
  const subscribeToPosition = usePositionStore((state) => state.subscribeToPosition);
  const unsubscribeFromPosition = usePositionStore((state) => state.unsubscribeFromPosition);
  const getDecimals = useSymbolMetaStore((state) => state.getDecimals);
  const decimals = useMemo(() => getDecimals(coin), [getDecimals, coin]);

  useEffect(() => {
    seenTimestampsRef.current.clear();
    subscribeToTrades(coin);
    subscribeToPosition(coin);

    return () => {
      unsubscribeFromTrades(coin);
      unsubscribeFromPosition(coin);
    };
  }, [coin, subscribeToTrades, unsubscribeFromTrades, subscribeToPosition, unsubscribeFromPosition]);

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

  const handleBuyCloud = useCallback(async () => {
    playNotificationSound('bullish', 'cloud');
    try {
      const response = await fetch('/api/trade/buy-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin }),
      });
      const data = await response.json();
      console.log('Buy Cloud response:', data);
    } catch (error) {
      console.error('Error executing buy cloud:', error);
    }
  }, [coin]);

  const handleSellCloud = useCallback(async () => {
    playNotificationSound('bearish', 'cloud');
    try {
      const response = await fetch('/api/trade/sell-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin }),
      });
      const data = await response.json();
      console.log('Sell Cloud response:', data);
    } catch (error) {
      console.error('Error executing sell cloud:', error);
    }
  }, [coin]);

  const handleSmLong = useCallback(async () => {
    playNotificationSound('bullish', 'standard');
    try {
      const response = await fetch('/api/trade/sm-long', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin }),
      });
      const data = await response.json();
      console.log('SM Long response:', data);
    } catch (error) {
      console.error('Error executing sm long:', error);
    }
  }, [coin]);

  const handleSmShort = useCallback(async () => {
    playNotificationSound('bearish', 'standard');
    try {
      const response = await fetch('/api/trade/sm-short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin }),
      });
      const data = await response.json();
      console.log('SM Short response:', data);
    } catch (error) {
      console.error('Error executing sm short:', error);
    }
  }, [coin]);

  const handleBigLong = useCallback(async () => {
    playNotificationSound('bullish', 'big');
    try {
      const response = await fetch('/api/trade/big-long', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin }),
      });
      const data = await response.json();
      console.log('Big Long response:', data);
    } catch (error) {
      console.error('Error executing big long:', error);
    }
  }, [coin]);

  const handleBigShort = useCallback(async () => {
    playNotificationSound('bearish', 'big');
    try {
      const response = await fetch('/api/trade/big-short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin }),
      });
      const data = await response.json();
      console.log('Big Short response:', data);
    } catch (error) {
      console.error('Error executing big short:', error);
    }
  }, [coin]);

  const handleClose25 = useCallback(async () => {
    try {
      const response = await fetch('/api/positions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin, percentage: 25 }),
      });
      const data = await response.json();
      console.log('Close 25% response:', data);
    } catch (error) {
      console.error('Error closing 25% position:', error);
    }
  }, [coin]);

  const handleClose50 = useCallback(async () => {
    try {
      const response = await fetch('/api/positions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin, percentage: 50 }),
      });
      const data = await response.json();
      console.log('Close 50% response:', data);
    } catch (error) {
      console.error('Error closing 50% position:', error);
    }
  }, [coin]);

  const handleClose75 = useCallback(async () => {
    try {
      const response = await fetch('/api/positions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin, percentage: 75 }),
      });
      const data = await response.json();
      console.log('Close 75% response:', data);
    } catch (error) {
      console.error('Error closing 75% position:', error);
    }
  }, [coin]);

  const handleClose100 = useCallback(async () => {
    try {
      const response = await fetch('/api/positions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin, percentage: 100 }),
      });
      const data = await response.json();
      console.log('Close 100% response:', data);
    } catch (error) {
      console.error('Error closing 100% position:', error);
    }
  }, [coin]);

  const keyBindings: KeyBinding[] = [
    { key: 'q', action: handleBuyCloud, description: 'Buy Cloud' },
    { key: 'w', action: handleSellCloud, description: 'Sell Cloud' },
    { key: 'a', action: handleSmLong, description: 'Small Long' },
    { key: 's', action: handleSmShort, description: 'Small Short' },
    { key: 'a', modifiers: { shift: true }, action: handleBigLong, description: 'Big Long' },
    { key: 's', modifiers: { shift: true }, action: handleBigShort, description: 'Big Short' },
    { key: '1', action: handleClose25, description: 'Close 25%' },
    { key: '2', action: handleClose50, description: 'Close 50%' },
    { key: '3', action: handleClose75, description: 'Close 75%' },
    { key: '4', action: handleClose100, description: 'Close 100%' },
  ];

  useKeyboardShortcuts(keyBindings, !isPanelOpen);

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
                position={position}
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
                    <span className={position ? (position.side === 'long' ? 'text-bullish' : 'text-bearish') : 'text-primary'}>
                      {position ? `${position.size.toFixed(decimals.size)} ${coin} ${position.side.toUpperCase()}` : `-- ${coin}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-primary-muted">ENTRY:</span>
                    <span className="text-primary">
                      {position ? position.entryPrice.toFixed(decimals.price) : '---.--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-primary-muted">PNL:</span>
                    <span className={position ? (position.pnl >= 0 ? 'text-bullish' : 'text-bearish') : 'text-primary'}>
                      {position ? `${position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)} USD (${position.pnlPercentage >= 0 ? '+' : ''}${position.pnlPercentage.toFixed(2)}%)` : '+-.-- USD'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-primary-muted">LEVERAGE:</span>
                    <span className="text-primary">
                      {position ? `${position.leverage}x` : '--x'}
                    </span>
                  </div>
                </div>

                {/* Trading Actions */}
                <div className="mt-3 pt-3 border-t border-frame">
                  <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">█ ACTIONS</div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <button
                      className="px-2 py-1.5 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue hover:bg-accent-blue/30 hover:border-accent-blue/60 transition-all rounded-sm hover:shadow-[0_0_8px_rgba(50,116,170,0.3)]"
                      onClick={handleBuyCloud}
                    >
                      <span className="text-accent-blue/60 text-[10px] font-bold mr-1">Q</span>
                      █ BUY CLOUD
                    </button>
                    <button
                      className="px-2 py-1.5 bg-accent-rose/20 border border-accent-rose/40 text-accent-rose hover:bg-accent-rose/30 hover:border-accent-rose/60 transition-all rounded-sm hover:shadow-[0_0_8px_rgba(194,150,141,0.3)]"
                      onClick={handleSellCloud}
                    >
                      <span className="text-accent-rose/60 text-[10px] font-bold mr-1">W</span>
                      █ SELL CLOUD
                    </button>
                    <button
                      className="px-2 py-1.5 bg-bullish/20 border border-bullish/40 text-bullish hover:bg-bullish/30 hover:border-bullish/60 transition-all rounded-sm hover:shadow-[0_0_8px_rgba(38,166,154,0.3)]"
                      onClick={handleSmLong}
                    >
                      <span className="text-bullish/60 text-[10px] font-bold mr-1">A</span>
                      █ SM LONG
                    </button>
                    <button
                      className="px-2 py-1.5 bg-bearish/20 border border-bearish/40 text-bearish hover:bg-bearish/30 hover:border-bearish/60 transition-all rounded-sm hover:shadow-[0_0_8px_rgba(239,83,80,0.3)]"
                      onClick={handleSmShort}
                    >
                      <span className="text-bearish/60 text-[10px] font-bold mr-1">S</span>
                      █ SM SHORT
                    </button>
                    <button
                      className="px-2 py-1.5 bg-bullish/30 border-2 border-bullish/60 text-bullish font-bold hover:bg-bullish/40 hover:border-bullish/80 transition-all rounded-sm hover:shadow-[0_0_10px_rgba(38,166,154,0.5)]"
                      onClick={handleBigLong}
                    >
                      <span className="text-bullish/60 text-[10px] font-bold mr-1">⇧A</span>
                      ██ BIG LONG
                    </button>
                    <button
                      className="px-2 py-1.5 bg-bearish/30 border-2 border-bearish/60 text-bearish font-bold hover:bg-bearish/40 hover:border-bearish/80 transition-all rounded-sm hover:shadow-[0_0_10px_rgba(239,83,80,0.5)]"
                      onClick={handleBigShort}
                    >
                      <span className="text-bearish/60 text-[10px] font-bold mr-1">⇧S</span>
                      ██ BIG SHORT
                    </button>
                    <button
                      className="px-2 py-1.5 bg-primary-muted/10 border border-primary-muted/30 text-primary-muted hover:bg-primary-muted/20 hover:border-primary-muted/50 hover:text-primary transition-all rounded-sm hover:shadow-[0_0_8px_rgba(68,186,186,0.2)]"
                      onClick={handleClose25}
                    >
                      <span className="text-primary-muted/60 text-[10px] font-bold mr-1">1</span>
                      █ CLOSE 25%
                    </button>
                    <button
                      className="px-2 py-1.5 bg-primary-muted/10 border border-primary-muted/30 text-primary-muted hover:bg-primary-muted/20 hover:border-primary-muted/50 hover:text-primary transition-all rounded-sm hover:shadow-[0_0_8px_rgba(68,186,186,0.2)]"
                      onClick={handleClose50}
                    >
                      <span className="text-primary-muted/60 text-[10px] font-bold mr-1">2</span>
                      █ CLOSE 50%
                    </button>
                    <button
                      className="px-2 py-1.5 bg-primary-muted/10 border border-primary-muted/30 text-primary-muted hover:bg-primary-muted/20 hover:border-primary-muted/50 hover:text-primary transition-all rounded-sm hover:shadow-[0_0_8px_rgba(68,186,186,0.2)]"
                      onClick={handleClose75}
                    >
                      <span className="text-primary-muted/60 text-[10px] font-bold mr-1">3</span>
                      █ CLOSE 75%
                    </button>
                    <button
                      className="px-2 py-1.5 bg-primary-muted/10 border border-primary-muted/30 text-primary-muted hover:bg-primary-muted/20 hover:border-primary-muted/50 hover:text-primary transition-all rounded-sm hover:shadow-[0_0_8px_rgba(68,186,186,0.2)]"
                      onClick={handleClose100}
                    >
                      <span className="text-primary-muted/60 text-[10px] font-bold mr-1">4</span>
                      █ CLOSE 100%
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
