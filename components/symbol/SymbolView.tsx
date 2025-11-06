'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import ScalpingChart from '@/components/ScalpingChart';
import MultiTimeframeChart from '@/components/MultiTimeframeChart';
import TerminalHeader from '@/components/layout/TerminalHeader';
import RightTradingPanel from '@/components/symbol/RightTradingPanel';
import { useTradesStore } from '@/stores/useTradesStore';
import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useCandleStore } from '@/stores/useCandleStore';
import { playNotificationSound } from '@/lib/sound-utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { KeyBinding } from '@/lib/keyboard-utils';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { calculateAverageCandleHeight } from '@/lib/trading-utils';

interface SymbolViewProps {
  coin: string;
}

function SymbolView({ coin }: SymbolViewProps) {
  const [currentPrice, setCurrentPrice] = useState(0);
  const [newTradeKeys, setNewTradeKeys] = useState<Set<string>>(new Set());

  const trades = useTradesStore((state) => state.trades[coin]) || [];
  const subscribeToTrades = useTradesStore((state) => state.subscribeToTrades);
  const unsubscribeFromTrades = useTradesStore((state) => state.unsubscribeFromTrades);
  const seenTimestampsRef = useRef<Set<number>>(new Set());
  const tradeSoundTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const isPanelOpen = useSettingsStore((state) => state.isPanelOpen);
  const isMultiChartView = useSettingsStore((state) => state.isMultiChartView);
  const playTradeSound = useSettingsStore((state) => state.settings.theme.playTradeSound);
  const orderSettings = useSettingsStore((state) => state.settings.orders);

  const position = usePositionStore((state) => state.positions[coin]);
  const subscribeToPosition = usePositionStore((state) => state.subscribeToPosition);
  const unsubscribeFromPosition = usePositionStore((state) => state.unsubscribeFromPosition);

  const orders = useOrderStore((state) => state.orders[coin]) || [];
  const subscribeToOrders = useOrderStore((state) => state.subscribeToOrders);
  const unsubscribeFromOrders = useOrderStore((state) => state.unsubscribeFromOrders);

  const candleKey = `${coin}-1m`;
  const candles = useCandleStore((state) => state.candles[candleKey]) || [];

  const getDecimals = useSymbolMetaStore((state) => state.getDecimals);
  const decimals = useMemo(() => getDecimals(coin), [getDecimals, coin]);

  useEffect(() => {
    seenTimestampsRef.current.clear();
    subscribeToTrades(coin);
    subscribeToPosition(coin);
    subscribeToOrders(coin);

    return () => {
      unsubscribeFromTrades(coin);
      unsubscribeFromPosition(coin);
      unsubscribeFromOrders(coin);
    };
  }, [coin, subscribeToTrades, unsubscribeFromTrades, subscribeToPosition, unsubscribeFromPosition, subscribeToOrders, unsubscribeFromOrders]);

  useEffect(() => {
    if (trades.length === 0) return;

    const newKeys = new Set<string>();
    const seenTimestamps = seenTimestampsRef.current;
    const newTrades: typeof trades = [];

    trades.forEach((trade, index) => {
      if (!seenTimestamps.has(trade.time)) {
        const key = `${trade.time}-${index}`;
        newKeys.add(key);
        seenTimestamps.add(trade.time);
        newTrades.push(trade);
      }
    });

    if (newKeys.size > 0) {
      setNewTradeKeys(newKeys);

      if (playTradeSound && newTrades.length > 0) {
        tradeSoundTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        tradeSoundTimeoutsRef.current = [];

        const MAX_SOUNDS = 3;
        const soundsToPlay = Math.min(newTrades.length, MAX_SOUNDS);
        const SOUND_DURATION = 300;
        const delayBetweenSounds = soundsToPlay === 1 ? 0 : SOUND_DURATION / soundsToPlay;

        for (let i = 0; i < soundsToPlay; i++) {
          const trade = newTrades[i];
          const delay = i * delayBetweenSounds;
          const side = trade.side === 'buy' ? 'bullish' : 'bearish';

          const timeout = setTimeout(() => {
            playNotificationSound(side, 'standard');
          }, delay);

          tradeSoundTimeoutsRef.current.push(timeout);
        }
      }

      const timer = setTimeout(() => {
        setNewTradeKeys(new Set());
      }, 500);

      return () => {
        clearTimeout(timer);
        tradeSoundTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        tradeSoundTimeoutsRef.current = [];
      };
    }
  }, [trades, playTradeSound]);

  const handleBuyCloud = useCallback(async () => {
    playNotificationSound('bullish', 'cloud');
    try {
      if (candles.length < 5) {
        console.error('Insufficient candle data for buy cloud');
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPriceValue = latestCandle.close;

      const response = await fetch('/api/trade/buy-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: coin,
          currentPrice: currentPriceValue,
          priceInterval,
          percentage: orderSettings.cloudPercentage
        }),
      });
      const data = await response.json();
      console.log('Buy Cloud response:', data);
    } catch (error) {
      console.error('Error executing buy cloud:', error);
    }
  }, [coin, candles, orderSettings.cloudPercentage]);

  const handleSellCloud = useCallback(async () => {
    playNotificationSound('bearish', 'cloud');
    try {
      if (candles.length < 5) {
        console.error('Insufficient candle data for sell cloud');
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPriceValue = latestCandle.close;

      const response = await fetch('/api/trade/sell-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: coin,
          currentPrice: currentPriceValue,
          priceInterval,
          percentage: orderSettings.cloudPercentage
        }),
      });
      const data = await response.json();
      console.log('Sell Cloud response:', data);
    } catch (error) {
      console.error('Error executing sell cloud:', error);
    }
  }, [coin, candles, orderSettings.cloudPercentage]);

  const handleSmLong = useCallback(async () => {
    playNotificationSound('bullish', 'standard');
    try {
      if (candles.length < 5) {
        console.error('Insufficient candle data for sm long');
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPriceValue = latestCandle.close;

      const response = await fetch('/api/trade/sm-long', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: coin,
          currentPrice: currentPriceValue,
          priceInterval,
          percentage: orderSettings.smallPercentage
        }),
      });
      const data = await response.json();
      console.log('SM Long response:', data);
    } catch (error) {
      console.error('Error executing sm long:', error);
    }
  }, [coin, candles, orderSettings.smallPercentage]);

  const handleSmShort = useCallback(async () => {
    playNotificationSound('bearish', 'standard');
    try {
      if (candles.length < 5) {
        console.error('Insufficient candle data for sm short');
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPriceValue = latestCandle.close;

      const response = await fetch('/api/trade/sm-short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: coin,
          currentPrice: currentPriceValue,
          priceInterval,
          percentage: orderSettings.smallPercentage
        }),
      });
      const data = await response.json();
      console.log('SM Short response:', data);
    } catch (error) {
      console.error('Error executing sm short:', error);
    }
  }, [coin, candles, orderSettings.smallPercentage]);

  const handleBigLong = useCallback(async () => {
    playNotificationSound('bullish', 'big');
    try {
      if (candles.length < 5) {
        console.error('Insufficient candle data for big long');
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPriceValue = latestCandle.close;

      const response = await fetch('/api/trade/big-long', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: coin,
          currentPrice: currentPriceValue,
          priceInterval,
          percentage: orderSettings.bigPercentage
        }),
      });
      const data = await response.json();
      console.log('Big Long response:', data);
    } catch (error) {
      console.error('Error executing big long:', error);
    }
  }, [coin, candles, orderSettings.bigPercentage]);

  const handleBigShort = useCallback(async () => {
    playNotificationSound('bearish', 'big');
    try {
      if (candles.length < 5) {
        console.error('Insufficient candle data for big short');
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPriceValue = latestCandle.close;

      const response = await fetch('/api/trade/big-short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: coin,
          currentPrice: currentPriceValue,
          priceInterval,
          percentage: orderSettings.bigPercentage
        }),
      });
      const data = await response.json();
      console.log('Big Short response:', data);
    } catch (error) {
      console.error('Error executing big short:', error);
    }
  }, [coin, candles, orderSettings.bigPercentage]);

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

  const handleCancelEntryOrders = useCallback(async () => {
    playNotificationSound('bearish', 'standard');
    try {
      const response = await fetch('/api/orders/cancel-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin }),
      });
      const data = await response.json();
      console.log('Cancel entry orders response:', data);
    } catch (error) {
      console.error('Error cancelling entry orders:', error);
    }
  }, [coin]);

  const handleCancelAllOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/cancel-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin }),
      });
      const data = await response.json();
      console.log('Cancel all orders response:', data);

      if (data.success) {
        playNotificationSound('bearish', 'standard');
      }
    } catch (error) {
      console.error('Error cancelling all orders:', error);
    }
  }, [coin]);

  const handleMoveSL25 = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/move-stop-loss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin, percentage: 25 }),
      });
      const data = await response.json();
      console.log('Move SL 25% response:', data);
    } catch (error) {
      console.error('Error moving stop loss 25%:', error);
    }
  }, [coin]);

  const handleMoveSL50 = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/move-stop-loss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin, percentage: 50 }),
      });
      const data = await response.json();
      console.log('Move SL 50% response:', data);
    } catch (error) {
      console.error('Error moving stop loss 50%:', error);
    }
  }, [coin]);

  const handleMoveSL75 = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/move-stop-loss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin, percentage: 75 }),
      });
      const data = await response.json();
      console.log('Move SL 75% response:', data);
    } catch (error) {
      console.error('Error moving stop loss 75%:', error);
    }
  }, [coin]);

  const handleMoveSLBreakeven = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/move-stop-loss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin, percentage: 0 }),
      });
      const data = await response.json();
      console.log('Move SL to breakeven response:', data);
    } catch (error) {
      console.error('Error moving stop loss to breakeven:', error);
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
    { key: '5', action: handleMoveSL25, description: 'Move SL 25%' },
    { key: '6', action: handleMoveSL50, description: 'Move SL 50%' },
    { key: '7', action: handleMoveSL75, description: 'Move SL 75%' },
    { key: '8', action: handleMoveSLBreakeven, description: 'Move SL to Breakeven' },
  ];

  useKeyboardShortcuts(keyBindings, !isPanelOpen);

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <div className="flex h-full w-full">
        {/* Main Content - Scalping Chart */}
        <div className="flex flex-col flex-1 min-w-0 p-2 gap-2">
          {/* Header */}
          <TerminalHeader coin={coin} />

          {/* Chart View - Single or Multi-Timeframe */}
          {isMultiChartView ? (
            <div className="flex-1 min-h-0">
              <MultiTimeframeChart coin={coin} />
            </div>
          ) : (
            <div className="terminal-border p-1.5 flex flex-col flex-1 min-h-0">
              <div className="text-[10px] text-primary-muted mb-1 uppercase tracking-wider">█ SCALPING CHART</div>
              <div className="flex-1 min-h-0">
                <ScalpingChart
                  coin={coin}
                  interval="1m"
                  onPriceUpdate={setCurrentPrice}
                  position={position}
                  orders={orders}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Trading Panel */}
        <RightTradingPanel
          coin={coin}
          position={position}
          orders={orders}
          decimals={decimals}
          onBuyCloud={handleBuyCloud}
          onSellCloud={handleSellCloud}
          onSmLong={handleSmLong}
          onSmShort={handleSmShort}
          onBigLong={handleBigLong}
          onBigShort={handleBigShort}
          onClose25={handleClose25}
          onClose50={handleClose50}
          onClose75={handleClose75}
          onClose100={handleClose100}
          onMoveSL25={handleMoveSL25}
          onMoveSL50={handleMoveSL50}
          onMoveSL75={handleMoveSL75}
          onMoveSLBreakeven={handleMoveSLBreakeven}
          onCancelEntryOrders={handleCancelEntryOrders}
          onCancelAllOrders={handleCancelAllOrders}
        />
      </div>
    </div>
  );
}

export default memo(SymbolView);
