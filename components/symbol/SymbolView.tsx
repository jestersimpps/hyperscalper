'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import ScalpingChart from '@/components/ScalpingChart';
import MultiTimeframeChart from '@/components/MultiTimeframeChart';
import TerminalHeader from '@/components/layout/TerminalHeader';
import { useTradesStore } from '@/stores/useTradesStore';
import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useCandleStore } from '@/stores/useCandleStore';
import { useTradingStore } from '@/stores/useTradingStore';
import { useCrosshairStore } from '@/stores/useCrosshairStore';
import { playNotificationSound } from '@/lib/sound-utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { KeyBinding } from '@/lib/keyboard-utils';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { calculateAverageCandleHeight } from '@/lib/trading-utils';
import { getCandleTimeWindow } from '@/lib/time-utils';
import { DEFAULT_CANDLE_COUNT } from '@/lib/constants';
import type { TimeInterval } from '@/types';

interface SymbolViewProps {
  coin: string;
}

function SymbolView({ coin }: SymbolViewProps) {
  const [currentPrice, setCurrentPrice] = useState(0);
  const [newTradeKeys, setNewTradeKeys] = useState<Set<string>>(new Set());
  const chartRef = useRef<any>(null);
  const crosshairStateRef = useRef({ active: false, type: null as any });

  const trades = useTradesStore((state) => state.trades[coin]) || [];
  const subscribeToTrades = useTradesStore((state) => state.subscribeToTrades);
  const unsubscribeFromTrades = useTradesStore((state) => state.unsubscribeFromTrades);
  const seenTimestampsRef = useRef<Set<number>>(new Set());
  const tradeSoundTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const isPanelOpen = useSettingsStore((state) => state.isPanelOpen);
  const isMultiChartView = useSettingsStore((state) => state.isMultiChartView);
  const playTradeSound = useSettingsStore((state) => state.settings.theme.playTradeSound);
  const orderSettings = useSettingsStore((state) => state.settings.orders);
  const invertedMode = useSettingsStore((state) => state.settings.chart.invertedMode);

  const position = usePositionStore((state) => state.positions[coin]);

  const confirmedOrders = useOrderStore((state) => state.orders[coin]) || [];
  const optimisticOrders = useOrderStore((state) => state.optimisticOrders[coin]) || [];
  const orders = useMemo(() => [...confirmedOrders, ...optimisticOrders], [confirmedOrders, optimisticOrders]);
  const subscribeToOrders = useOrderStore((state) => state.subscribeToOrders);
  const unsubscribeFromOrders = useOrderStore((state) => state.unsubscribeFromOrders);

  const candleKey = `${coin}-1m`;
  const candles = useCandleStore((state) => state.candles[candleKey]) || [];
  const fetchCandles = useCandleStore((state) => state.fetchCandles);
  const subscribeToCandles = useCandleStore((state) => state.subscribeToCandles);
  const unsubscribeFromCandles = useCandleStore((state) => state.unsubscribeFromCandles);
  const clearCandles = useCandleStore((state) => state.clearCandles);
  const setActiveSymbol = useCandleStore((state) => state.setActiveSymbol);

  const crosshairActive = useCrosshairStore((state) => state.active);
  const crosshairType = useCrosshairStore((state) => state.type);
  const resetCrosshair = useCrosshairStore((state) => state.reset);
  const placeLimitOrderAtPrice = useTradingStore((state) => state.placeLimitOrderAtPrice);
  const placeExitOrderAtPrice = useTradingStore((state) => state.placeExitOrderAtPrice);

  useEffect(() => {
    crosshairStateRef.current = { active: crosshairActive, type: crosshairType };
    console.log('Crosshair state updated:', { active: crosshairActive, type: crosshairType });
  }, [crosshairActive, crosshairType]);
  const candleService = useCandleStore((state) => state.service);

  const getDecimals = useSymbolMetaStore((state) => state.getDecimals);
  const decimals = useMemo(() => getDecimals(coin), [getDecimals, coin]);

  const buyCloud = useTradingStore((state) => state.buyCloud);
  const sellCloud = useTradingStore((state) => state.sellCloud);
  const smLong = useTradingStore((state) => state.smLong);
  const smShort = useTradingStore((state) => state.smShort);
  const bigLong = useTradingStore((state) => state.bigLong);
  const bigShort = useTradingStore((state) => state.bigShort);
  const closePosition = useTradingStore((state) => state.closePosition);
  const moveStopLoss = useTradingStore((state) => state.moveStopLoss);
  const cancelEntryOrders = useTradingStore((state) => state.cancelEntryOrders);
  const cancelAllOrders = useTradingStore((state) => state.cancelAllOrders);

  useEffect(() => {
    seenTimestampsRef.current.clear();
    subscribeToTrades(coin);
    subscribeToOrders(coin);
    setActiveSymbol(coin);

    return () => {
      unsubscribeFromTrades(coin);
      unsubscribeFromOrders(coin);
      setActiveSymbol(null);
    };
  }, [coin, setActiveSymbol]);

  useEffect(() => {
    console.log(`[SymbolView] Candle effect triggered for ${coin}`, { candleService: !!candleService });
    if (!candleService) return;

    const timeframes: TimeInterval[] = ['1m', '5m', '15m', '1h'];

    timeframes.forEach((interval) => {
      const { startTime, endTime } = getCandleTimeWindow(interval, DEFAULT_CANDLE_COUNT);
      console.log(`[SymbolView] Fetching ${coin}-${interval}`);
      fetchCandles(coin, interval, startTime, endTime);
      subscribeToCandles(coin, interval);
    });

    return () => {
      console.log(`[SymbolView] Cleanup for ${coin}`);
      timeframes.forEach((interval) => {
        unsubscribeFromCandles(coin, interval);
      });
    };
  }, [coin, candleService]);

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
    const actualSide = invertedMode ? 'bearish' : 'bullish';
    playNotificationSound(actualSide, 'cloud');
    try {
      if (candles.length < 5) {
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPrice = latestCandle.close;

      const tradeFn = invertedMode ? sellCloud : buyCloud;
      await tradeFn({
        symbol: coin,
        currentPrice,
        priceInterval,
        percentage: orderSettings.cloudPercentage
      });
    } catch (error) {
      // Error executing buy cloud
    }
  }, [coin, candles, orderSettings.cloudPercentage, buyCloud, sellCloud, invertedMode]);

  const handleSellCloud = useCallback(async () => {
    const actualSide = invertedMode ? 'bullish' : 'bearish';
    playNotificationSound(actualSide, 'cloud');
    try {
      if (candles.length < 5) {
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPrice = latestCandle.close;

      const tradeFn = invertedMode ? buyCloud : sellCloud;
      await tradeFn({
        symbol: coin,
        currentPrice,
        priceInterval,
        percentage: orderSettings.cloudPercentage
      });
    } catch (error) {
      // Error executing sell cloud
    }
  }, [coin, candles, orderSettings.cloudPercentage, sellCloud, buyCloud, invertedMode]);

  const handleSmLong = useCallback(async () => {
    const actualSide = invertedMode ? 'bearish' : 'bullish';
    playNotificationSound(actualSide, 'standard');
    try {
      if (candles.length < 5) {
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPrice = latestCandle.close;

      const tradeFn = invertedMode ? smShort : smLong;
      await tradeFn({
        symbol: coin,
        currentPrice,
        priceInterval,
        percentage: orderSettings.smallPercentage
      });
    } catch (error) {
      // Error executing sm long
    }
  }, [coin, candles, orderSettings.smallPercentage, smLong, smShort, invertedMode]);

  const handleSmShort = useCallback(async () => {
    const actualSide = invertedMode ? 'bullish' : 'bearish';
    playNotificationSound(actualSide, 'standard');
    try {
      if (candles.length < 5) {
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPrice = latestCandle.close;

      const tradeFn = invertedMode ? smLong : smShort;
      await tradeFn({
        symbol: coin,
        currentPrice,
        priceInterval,
        percentage: orderSettings.smallPercentage
      });
    } catch (error) {
      // Error executing sm short
    }
  }, [coin, candles, orderSettings.smallPercentage, smShort, smLong, invertedMode]);

  const handleBigLong = useCallback(async () => {
    const actualSide = invertedMode ? 'bearish' : 'bullish';
    playNotificationSound(actualSide, 'big');
    try {
      if (candles.length < 5) {
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPrice = latestCandle.close;

      const tradeFn = invertedMode ? bigShort : bigLong;
      await tradeFn({
        symbol: coin,
        currentPrice,
        priceInterval,
        percentage: orderSettings.bigPercentage
      });
    } catch (error) {
      // Error executing big long
    }
  }, [coin, candles, orderSettings.bigPercentage, bigLong, bigShort, invertedMode]);

  const handleBigShort = useCallback(async () => {
    const actualSide = invertedMode ? 'bullish' : 'bearish';
    playNotificationSound(actualSide, 'big');
    try {
      if (candles.length < 5) {
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPrice = latestCandle.close;

      const tradeFn = invertedMode ? bigLong : bigShort;
      await tradeFn({
        symbol: coin,
        currentPrice,
        priceInterval,
        percentage: orderSettings.bigPercentage
      });
    } catch (error) {
      // Error executing big short
    }
  }, [coin, candles, orderSettings.bigPercentage, bigShort, bigLong, invertedMode]);

  const handleClose25 = useCallback(async () => {
    try {
      await closePosition({ symbol: coin, percentage: 25 });
    } catch (error) {
      // Error closing 25% position
    }
  }, [coin, closePosition]);

  const handleClose50 = useCallback(async () => {
    try {
      await closePosition({ symbol: coin, percentage: 50 });
    } catch (error) {
      // Error closing 50% position
    }
  }, [coin, closePosition]);

  const handleClose75 = useCallback(async () => {
    try {
      await closePosition({ symbol: coin, percentage: 75 });
    } catch (error) {
      // Error closing 75% position
    }
  }, [coin, closePosition]);

  const handleClose100 = useCallback(async () => {
    try {
      await closePosition({ symbol: coin, percentage: 100 });
    } catch (error) {
      // Error closing 100% position
    }
  }, [coin, closePosition]);

  const handleCloseBest = useCallback(async () => {
    const positions = usePositionStore.getState().positions;
    const profitablePositions = Object.entries(positions)
      .filter(([_, pos]) => pos && pos.pnl > 0)
      .map(([symbol, pos]) => ({ ...pos!, symbol }))
      .sort((a, b) => b.pnl - a.pnl);

    const mostProfitable = profitablePositions[0];
    if (!mostProfitable) return;

    if (!confirm(`Close ${mostProfitable.symbol} position? (+$${mostProfitable.pnl.toFixed(2)})`)) return;

    try {
      await closePosition({ symbol: mostProfitable.symbol, percentage: 100 });
    } catch (error) {
      // Error closing best position
    }
  }, [closePosition]);

  const handleCloseAllProfitable = useCallback(async () => {
    const positions = usePositionStore.getState().positions;
    const profitablePositions = Object.entries(positions)
      .filter(([_, pos]) => pos && pos.pnl > 0)
      .map(([symbol, pos]) => ({ ...pos!, symbol }));

    if (profitablePositions.length === 0) return;

    const totalProfit = profitablePositions.reduce((sum, pos) => sum + pos.pnl, 0);
    if (!confirm(`Close ${profitablePositions.length} profitable positions? (Total: +$${totalProfit.toFixed(2)})`)) return;

    try {
      for (const pos of profitablePositions) {
        await closePosition({ symbol: pos.symbol, percentage: 100 });
      }
    } catch (error) {
      // Error closing profitable positions
    }
  }, [closePosition]);

  const handleCancelEntryOrders = useCallback(async () => {
    playNotificationSound('bearish', 'standard');
    try {
      await cancelEntryOrders(coin);
    } catch (error) {
      // Error cancelling entry orders
    }
  }, [coin, cancelEntryOrders]);

  const handleCancelAllOrders = useCallback(async () => {
    try {
      await cancelAllOrders(coin);
      playNotificationSound('bearish', 'standard');
    } catch (error) {
      // Error cancelling all orders
    }
  }, [coin, cancelAllOrders]);

  const handleMoveSL25 = useCallback(async () => {
    try {
      await moveStopLoss({ coin, percentage: 25 });
    } catch (error) {
      // Error moving stop loss 25%
    }
  }, [coin, moveStopLoss]);

  const handleMoveSL50 = useCallback(async () => {
    try {
      await moveStopLoss({ coin, percentage: 50 });
    } catch (error) {
      // Error moving stop loss 50%
    }
  }, [coin, moveStopLoss]);

  const handleMoveSL75 = useCallback(async () => {
    try {
      await moveStopLoss({ coin, percentage: 75 });
    } catch (error) {
      // Error moving stop loss 75%
    }
  }, [coin, moveStopLoss]);

  const handleMoveSLBreakeven = useCallback(async () => {
    try {
      await moveStopLoss({ coin, percentage: 0 });
    } catch (error) {
      // Error moving stop loss to breakeven
    }
  }, [coin, moveStopLoss]);

  const handleRefreshCharts = useCallback(async () => {
    try {
      console.log(`[SymbolView] Refreshing chart data for ${coin}`);

      const intervals: TimeInterval[] = ['1m', '5m', '15m', '1h'];

      intervals.forEach((interval) => {
        unsubscribeFromCandles(coin, interval);
      });

      clearCandles(coin);

      for (const interval of intervals) {
        const { startTime, endTime } = getCandleTimeWindow(interval, DEFAULT_CANDLE_COUNT);
        await fetchCandles(coin, interval, startTime, endTime);
        subscribeToCandles(coin, interval);
      }

      console.log(`[SymbolView] Chart refresh complete for ${coin}`);
    } catch (error) {
      console.error('[SymbolView] Error refreshing charts:', error);
    }
  }, [coin, unsubscribeFromCandles, fetchCandles, subscribeToCandles, clearCandles]);

  const handleAutoZoom = useCallback(() => {
    try {
      if (chartRef.current && chartRef.current.timeScale) {
        const candleKey = `${coin}-1m`;
        const candles = useCandleStore.getState().candles[candleKey] || [];

        if (candles.length >= 2) {
          const fromTime = candles[0].time / 1000;
          const toTime = candles[candles.length - 1].time / 1000;
          const rightPadding = 10 * 60; // 10 candles worth of time (10 minutes)

          chartRef.current.timeScale().setVisibleRange({
            from: fromTime,
            to: toTime + rightPadding,
          });
        } else {
          chartRef.current.timeScale().fitContent();
        }
        console.log('[SymbolView] Auto zoom applied');
      }
    } catch (error) {
      console.error('[SymbolView] Error applying auto zoom:', error);
    }
  }, [coin]);

  const handleZoomTo50 = useCallback(() => {
    try {
      if (chartRef.current && chartRef.current.timeScale) {
        const candleKey = `${coin}-1m`;
        const candles = useCandleStore.getState().candles[candleKey] || [];
        if (candles.length >= 2) {
          const endIndex = candles.length - 1;
          const startIndex = Math.max(0, endIndex - 49);
          const fromTime = candles[startIndex].time / 1000;
          const toTime = candles[endIndex].time / 1000;
          const rightPadding = 10 * 60; // 10 candles worth of time (10 minutes)

          chartRef.current.timeScale().setVisibleRange({
            from: fromTime,
            to: toTime + rightPadding,
          });
          console.log('[SymbolView] Zoomed to last 50 candles');
        }
      }
    } catch (error) {
      console.error('[SymbolView] Error zooming to 50 candles:', error);
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
    { key: 'x', modifiers: { shift: true }, action: handleCloseBest, description: 'Close Best Position' },
    { key: 'c', modifiers: { shift: true }, action: handleCloseAllProfitable, description: 'Close All Profitable' },
  ];

  useKeyboardShortcuts(keyBindings, !isPanelOpen);

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <div className="flex flex-col h-full w-full p-2 gap-2">
        {/* Header */}
        <TerminalHeader
          coin={coin}
          onRefreshCharts={handleRefreshCharts}
          onAutoZoom={handleAutoZoom}
          onZoomTo50={handleZoomTo50}
        />

        {/* Chart View - Single or Multi-Timeframe */}
        {isMultiChartView ? (
          <div className="flex-1 min-h-0">
            <MultiTimeframeChart coin={coin} />
          </div>
        ) : (
          <div className="terminal-border p-1.5 flex flex-col flex-1 min-h-0">
            <div className="text-[10px] text-primary-muted mb-1 uppercase tracking-wider">█ SCALPING CHART</div>
            <div className={`flex-1 min-h-0 ${crosshairActive ? 'cursor-crosshair' : ''}`}>
              <ScalpingChart
                coin={coin}
                interval="1m"
                onPriceUpdate={setCurrentPrice}
                onChartReady={(chart) => { chartRef.current = chart; }}
onChartClick={async (data) => {
                  const { active, type } = crosshairStateRef.current;
                  console.log('Chart clicked at price:', data.price, 'Crosshair active:', active, 'Type:', type);

                  if (active && type) {
                    try {
                      // Handle exit order types
                      if (type.startsWith('exit-')) {
                        const allPositions = usePositionStore.getState().positions;
                        const currentPosition = allPositions[coin];

                        console.log('[EXIT ORDER DEBUG] All positions:', allPositions);
                        console.log('[EXIT ORDER DEBUG] Current coin:', coin);
                        console.log('[EXIT ORDER DEBUG] Position for coin:', currentPosition);

                        if (!currentPosition) {
                          console.error('Cannot place exit order: no position for', coin);
                          alert(`No position to place exit order for ${coin}`);
                          return;
                        }

                        const percentageStr = type.replace('exit-', '');
                        const percentage = parseInt(percentageStr) as 25 | 50 | 75 | 100;

                        console.log('Placing exit order:', {
                          coin,
                          price: data.price,
                          currentPrice: currentPosition.currentPrice,
                          percentage,
                          positionSide: currentPosition.side,
                          positionSize: currentPosition.size
                        });

                        await placeExitOrderAtPrice({
                          symbol: coin,
                          price: data.price,
                          percentage,
                          positionSide: currentPosition.side,
                          positionSize: currentPosition.size,
                          currentPrice: currentPosition.currentPrice,
                        });

                        console.log('Exit order placed successfully!');
                        resetCrosshair();
                      } else {
                        // Handle entry order types
                        const isBuy = type.includes('long');
                        const isCloud = type.includes('cloud');
                        const isBig = type.includes('big');

                        let percentage: number;
                        if (isCloud) {
                          percentage = orderSettings.cloudPercentage;
                        } else if (isBig) {
                          percentage = orderSettings.bigPercentage;
                        } else {
                          percentage = orderSettings.smallPercentage;
                        }

                        console.log('Placing order:', { coin, price: data.price, currentPrice, isBuy, percentage, orderType: isCloud ? 'cloud' : isBig ? 'big' : 'small' });

                        await placeLimitOrderAtPrice({
                          symbol: coin,
                          price: data.price,
                          isBuy,
                          percentage,
                          currentPrice,
                        });

                        console.log('Order placed successfully!');
                        resetCrosshair();
                      }
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                      console.error('Order placement failed:', error);
                      alert(`Failed to place order: ${errorMessage}`);
                    }
                  }
                }}
                position={position}
                orders={orders}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(SymbolView);
