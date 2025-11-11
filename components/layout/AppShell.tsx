'use client';

import { ReactNode, useMemo, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import RightTradingPanel from '@/components/symbol/RightTradingPanel';
import Sidepanel from '@/components/layout/Sidepanel';
import WalletIndicator from '@/components/layout/WalletIndicator';
import CalendarIcon from '@/components/icons/CalendarIcon';
import SettingsIcon from '@/components/icons/SettingsIcon';
import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCandleStore } from '@/stores/useCandleStore';
import { useTradingStore } from '@/stores/useTradingStore';
import { useAddressFromUrl } from '@/lib/hooks/use-address-from-url';
import { calculateAverageCandleHeight } from '@/lib/trading-utils';
import { playNotificationSound } from '@/lib/sound-utils';

interface AppShellProps {
  selectedSymbol: string;
  children: ReactNode;
}

export default function AppShell({ selectedSymbol, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const coin = pathname?.split('/')[2]?.toUpperCase() || 'BTC';
  const address = useAddressFromUrl();
  const isTradesView = pathname?.includes('/trades');

  const position = usePositionStore((state) => state.positions[coin]);
  const orders = useOrderStore((state) => state.orders[coin]) || [];
  const getDecimals = useSymbolMetaStore((state) => state.getDecimals);
  const decimals = useMemo(() => getDecimals(coin), [getDecimals, coin]);
  const orderSettings = useSettingsStore((state) => state.settings.orders);
  const scannerEnabled = useSettingsStore((state) => state.settings.scanner.enabled);
  const invertedMode = useSettingsStore((state) => state.settings.chart.invertedMode);
  const togglePanel = useSettingsStore((state) => state.togglePanel);

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
    <div className="flex flex-col h-screen bg-bg-primary text-primary font-mono">
      {/* Top Header with Title, Navigation Icons, and Wallet Indicator */}
      <header className="border-b-2 border-border-frame flex items-center justify-between px-4 py-1.5">
        {/* Left: Title */}
        <div className="text-primary text-sm font-bold tracking-wider terminal-text flex items-center gap-2">
          <span>█ HYPERLIQUID TERMINAL <span className="text-primary-muted font-normal text-xs">v1.0.0</span></span>
          <span className="text-primary-muted font-normal text-xs">by</span>
          <a
            href="https://github.com/jestersimpps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-muted font-normal text-xs hover:text-primary hover:underline transition-colors"
          >
            @jestersimpps
          </a>
        </div>

        {/* Right: Navigation Icons + Wallet Indicator */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => address && router.push(`/${address}/trades`)}
            className={`px-2 py-1.5 active:scale-95 cursor-pointer transition-all rounded-sm ${
              isTradesView
                ? 'bg-primary/20 text-primary border-2 border-primary'
                : 'bg-bg-secondary text-primary-muted border-2 border-frame hover:text-primary hover:bg-primary/10'
            }`}
            title="Today's Trades"
          >
            <CalendarIcon />
          </button>
          <button
            onClick={togglePanel}
            className="px-2 py-1.5 bg-bg-secondary text-primary-muted border-2 border-frame hover:text-primary hover:bg-primary/10 active:scale-95 cursor-pointer transition-all rounded-sm"
            title="Settings"
          >
            <SettingsIcon />
          </button>
          <WalletIndicator />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidepanel */}
        <aside className={`${scannerEnabled ? 'w-[500px]' : 'w-[270px]'} border-r-2 border-border-frame overflow-y-auto transition-all duration-300`}>
          <Sidepanel selectedSymbol={selectedSymbol} />
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
    </div>
  );
}
