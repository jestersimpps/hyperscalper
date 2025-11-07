'use client';

import { ReactNode, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import RightTradingPanel from '@/components/symbol/RightTradingPanel';
import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCandleStore } from '@/stores/useCandleStore';
import { useTradingStore } from '@/stores/useTradingStore';
import { calculateAverageCandleHeight } from '@/lib/trading-utils';
import { playNotificationSound } from '@/lib/sound-utils';

interface AppShellProps {
  sidepanel: ReactNode;
  children: ReactNode;
}

export default function AppShell({ sidepanel, children }: AppShellProps) {
  const pathname = usePathname();
  const coin = pathname?.split('/')[1]?.toUpperCase() || 'BTC';

  const position = usePositionStore((state) => state.positions[coin]);
  const orders = useOrderStore((state) => state.orders[coin]) || [];
  const getDecimals = useSymbolMetaStore((state) => state.getDecimals);
  const decimals = useMemo(() => getDecimals(coin), [getDecimals, coin]);
  const orderSettings = useSettingsStore((state) => state.settings.orders);
  const scannerEnabled = useSettingsStore((state) => state.settings.scanner.enabled);

  const candleKey = `${coin}-1m`;
  const candles = useCandleStore((state) => state.candles[candleKey]) || [];
  const buyCloud = useTradingStore((state) => state.buyCloud);
  const sellCloud = useTradingStore((state) => state.sellCloud);
  const smLong = useTradingStore((state) => state.smLong);
  const smShort = useTradingStore((state) => state.smShort);
  const bigLong = useTradingStore((state) => state.bigLong);
  const bigShort = useTradingStore((state) => state.bigShort);
  const closePosition = useTradingStore((state) => state.closePosition);
  const moveStopLoss = useTradingStore((state) => state.moveStopLoss);
  const cancelEntryOrders = useTradingStore((state) => state.cancelEntryOrders);
  const cancelExitOrders = useTradingStore((state) => state.cancelExitOrders);
  const cancelAllOrders = useTradingStore((state) => state.cancelAllOrders);

  const handleBuyCloud = useCallback(async () => {
    playNotificationSound('bullish', 'cloud');
    try {
      if (candles.length < 5) {
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPrice = latestCandle.close;

      await buyCloud({
        symbol: coin,
        currentPrice,
        priceInterval,
        percentage: orderSettings.cloudPercentage
      });
    } catch (error) {
      // Error executing buy cloud
    }
  }, [coin, candles, orderSettings.cloudPercentage, buyCloud]);

  const handleSellCloud = useCallback(async () => {
    playNotificationSound('bearish', 'cloud');
    try {
      if (candles.length < 5) {
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPrice = latestCandle.close;

      await sellCloud({
        symbol: coin,
        currentPrice,
        priceInterval,
        percentage: orderSettings.cloudPercentage
      });
    } catch (error) {
      // Error executing sell cloud
    }
  }, [coin, candles, orderSettings.cloudPercentage, sellCloud]);

  const handleSmLong = useCallback(async () => {
    playNotificationSound('bullish', 'standard');
    try {
      if (candles.length < 5) {
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPrice = latestCandle.close;

      await smLong({
        symbol: coin,
        currentPrice,
        priceInterval,
        percentage: orderSettings.smallPercentage
      });
    } catch (error) {
      // Error executing sm long
    }
  }, [coin, candles, orderSettings.smallPercentage, smLong]);

  const handleSmShort = useCallback(async () => {
    playNotificationSound('bearish', 'standard');
    try {
      if (candles.length < 5) {
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPrice = latestCandle.close;

      await smShort({
        symbol: coin,
        currentPrice,
        priceInterval,
        percentage: orderSettings.smallPercentage
      });
    } catch (error) {
      // Error executing sm short
    }
  }, [coin, candles, orderSettings.smallPercentage, smShort]);

  const handleBigLong = useCallback(async () => {
    playNotificationSound('bullish', 'big');
    try {
      if (candles.length < 5) {
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPrice = latestCandle.close;

      await bigLong({
        symbol: coin,
        currentPrice,
        priceInterval,
        percentage: orderSettings.bigPercentage
      });
    } catch (error) {
      // Error executing big long
    }
  }, [coin, candles, orderSettings.bigPercentage, bigLong]);

  const handleBigShort = useCallback(async () => {
    playNotificationSound('bearish', 'big');
    try {
      if (candles.length < 5) {
        return;
      }

      const priceInterval = calculateAverageCandleHeight(candles);
      const latestCandle = candles[candles.length - 1];
      const currentPrice = latestCandle.close;

      await bigShort({
        symbol: coin,
        currentPrice,
        priceInterval,
        percentage: orderSettings.bigPercentage
      });
    } catch (error) {
      // Error executing big short
    }
  }, [coin, candles, orderSettings.bigPercentage, bigShort]);

  const handleClose25 = useCallback(async () => {
    try {
      await closePosition({ symbol: coin, percentage: 25 });
    } catch (error) {
      alert(`Error closing position: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, closePosition]);

  const handleClose50 = useCallback(async () => {
    try {
      await closePosition({ symbol: coin, percentage: 50 });
    } catch (error) {
      alert(`Error closing position: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, closePosition]);

  const handleClose75 = useCallback(async () => {
    try {
      await closePosition({ symbol: coin, percentage: 75 });
    } catch (error) {
      alert(`Error closing position: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, closePosition]);

  const handleClose100 = useCallback(async () => {
    try {
      await closePosition({ symbol: coin, percentage: 100 });
    } catch (error) {
      alert(`Error closing position: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, closePosition]);

  const handleMoveSL25 = useCallback(async () => {
    try {
      await moveStopLoss({ coin, percentage: 25 });
    } catch (error) {
      alert(`Error moving stop loss: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, moveStopLoss]);

  const handleMoveSL50 = useCallback(async () => {
    try {
      await moveStopLoss({ coin, percentage: 50 });
    } catch (error) {
      alert(`Error moving stop loss: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, moveStopLoss]);

  const handleMoveSL75 = useCallback(async () => {
    try {
      await moveStopLoss({ coin, percentage: 75 });
    } catch (error) {
      alert(`Error moving stop loss: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, moveStopLoss]);

  const handleMoveSLBreakeven = useCallback(async () => {
    try {
      await moveStopLoss({ coin, percentage: 0 });
    } catch (error) {
      alert(`Error moving stop loss: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, moveStopLoss]);

  const handleCancelEntryOrders = useCallback(async () => {
    try {
      await cancelEntryOrders(coin);
    } catch (error) {
      alert(`Error canceling entry orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, cancelEntryOrders]);

  const handleCancelExitOrders = useCallback(async () => {
    try {
      await cancelExitOrders(coin);
    } catch (error) {
      alert(`Error canceling exit orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, cancelExitOrders]);

  const handleCancelAllOrders = useCallback(async () => {
    try {
      await cancelAllOrders(coin);
    } catch (error) {
      alert(`Error canceling all orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, cancelAllOrders]);

  return (
    <div className="flex h-screen bg-bg-primary text-primary font-mono">
      {/* Left Sidepanel */}
      <aside className={`${scannerEnabled ? 'w-[640px]' : 'w-[320px]'} border-r-2 border-border-frame overflow-y-auto transition-all duration-300`}>
        {sidepanel}
      </aside>

      {/* Center Content */}
      <main className="flex-1 h-full overflow-hidden">
        {children}
      </main>

      {/* Right Trading Panel */}
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
        onCancelExitOrders={handleCancelExitOrders}
        onCancelAllOrders={handleCancelAllOrders}
      />
    </div>
  );
}
