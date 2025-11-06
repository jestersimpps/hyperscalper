'use client';

import { ReactNode, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import RightTradingPanel from '@/components/symbol/RightTradingPanel';
import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCandleStore } from '@/stores/useCandleStore';
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

  const handleBuyCloud = useCallback(async () => {
    playNotificationSound('bullish', 'cloud');
    try {
      if (candles.length < 5) {
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
      await response.json();
    } catch (error) {
      // Error executing buy cloud
    }
  }, [coin, candles, orderSettings.cloudPercentage]);

  const handleSellCloud = useCallback(async () => {
    playNotificationSound('bearish', 'cloud');
    try {
      if (candles.length < 5) {
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
      await response.json();
    } catch (error) {
      // Error executing sell cloud
    }
  }, [coin, candles, orderSettings.cloudPercentage]);

  const handleSmLong = useCallback(async () => {
    playNotificationSound('bullish', 'standard');
    try {
      if (candles.length < 5) {
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
      await response.json();
    } catch (error) {
      // Error executing sm long
    }
  }, [coin, candles, orderSettings.smallPercentage]);

  const handleSmShort = useCallback(async () => {
    playNotificationSound('bearish', 'standard');
    try {
      if (candles.length < 5) {
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
      await response.json();
    } catch (error) {
      // Error executing sm short
    }
  }, [coin, candles, orderSettings.smallPercentage]);

  const handleBigLong = useCallback(async () => {
    playNotificationSound('bullish', 'big');
    try {
      if (candles.length < 5) {
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
      await response.json();
    } catch (error) {
      // Error executing big long
    }
  }, [coin, candles, orderSettings.bigPercentage]);

  const handleBigShort = useCallback(async () => {
    playNotificationSound('bearish', 'big');
    try {
      if (candles.length < 5) {
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
      await response.json();
    } catch (error) {
      // Error executing big short
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
      if (!data.success) {
        alert(`Failed to close 25% position: ${data.message}`);
      }
    } catch (error) {
      alert(`Error closing position: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      if (!data.success) {
        alert(`Failed to close 50% position: ${data.message}`);
      }
    } catch (error) {
      alert(`Error closing position: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      if (!data.success) {
        alert(`Failed to close 75% position: ${data.message}`);
      }
    } catch (error) {
      alert(`Error closing position: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      if (!data.success) {
        alert(`Failed to close 100% position: ${data.message}`);
      }
    } catch (error) {
      alert(`Error closing position: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin]);

  const handleMoveSL25 = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/move-stop-loss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin, percentage: 25 }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(`Failed to move stop loss to 25%: ${data.message}`);
      }
    } catch (error) {
      alert(`Error moving stop loss: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin]);

  const handleMoveSL50 = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/move-stop-loss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin, percentage: 50 }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(`Failed to move stop loss to 50%: ${data.message}`);
      }
    } catch (error) {
      alert(`Error moving stop loss: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin]);

  const handleMoveSL75 = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/move-stop-loss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin, percentage: 75 }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(`Failed to move stop loss to 75%: ${data.message}`);
      }
    } catch (error) {
      alert(`Error moving stop loss: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin]);

  const handleMoveSLBreakeven = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/move-stop-loss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin, percentage: 0 }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(`Failed to move stop loss to breakeven: ${data.message}`);
      }
    } catch (error) {
      alert(`Error moving stop loss: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin]);

  const handleCancelEntryOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/cancel-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(`Failed to cancel entry orders: ${data.message}`);
      }
    } catch (error) {
      alert(`Error canceling entry orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      if (!data.success) {
        alert(`Failed to cancel all orders: ${data.message}`);
      }
    } catch (error) {
      alert(`Error canceling all orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin]);

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
        onCancelAllOrders={handleCancelAllOrders}
      />
    </div>
  );
}
