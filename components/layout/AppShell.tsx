'use client';

import { ReactNode, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import RightTradingPanel from '@/components/symbol/RightTradingPanel';
import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

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

  const handleBuyCloud = useCallback(async () => {
    try {
      const response = await fetch('/api/trade/buy-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(`Failed to place buy cloud orders: ${data.message}`);
      }
    } catch (error) {
      alert(`Error placing buy cloud orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin]);

  const handleSellCloud = useCallback(async () => {
    try {
      const response = await fetch('/api/trade/sell-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(`Failed to place sell cloud orders: ${data.message}`);
      }
    } catch (error) {
      alert(`Error placing sell cloud orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin]);

  const handleSmLong = useCallback(async () => {
    try {
      const response = await fetch('/api/trade/sm-long', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin, percentage: orderSettings.smLongPercentage }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(`Failed to place sm long order: ${data.message}`);
      }
    } catch (error) {
      alert(`Error placing sm long order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, orderSettings.smLongPercentage]);

  const handleSmShort = useCallback(async () => {
    try {
      const response = await fetch('/api/trade/sm-short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin, percentage: orderSettings.smShortPercentage }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(`Failed to place sm short order: ${data.message}`);
      }
    } catch (error) {
      alert(`Error placing sm short order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, orderSettings.smShortPercentage]);

  const handleBigLong = useCallback(async () => {
    try {
      const response = await fetch('/api/trade/big-long', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin, percentage: orderSettings.bigLongPercentage }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(`Failed to place big long order: ${data.message}`);
      }
    } catch (error) {
      alert(`Error placing big long order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, orderSettings.bigLongPercentage]);

  const handleBigShort = useCallback(async () => {
    try {
      const response = await fetch('/api/trade/big-short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: coin, percentage: orderSettings.bigShortPercentage }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(`Failed to place big short order: ${data.message}`);
      }
    } catch (error) {
      alert(`Error placing big short order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [coin, orderSettings.bigShortPercentage]);

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
      <aside className="w-[640px] border-r-2 border-border-frame overflow-y-auto">
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
