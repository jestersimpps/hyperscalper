'use client';

import { useMemo, memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOrderStore } from '@/stores/useOrderStore';
import { usePositionStore } from '@/stores/usePositionStore';
import { useTradingStore } from '@/stores/useTradingStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAddressFromUrl } from '@/lib/hooks/use-address-from-url';
import {
  getOrderTypeLabel,
  sortOrdersByPrice,
  groupOrdersBySymbol,
  getAllOrdersAcrossSymbols
} from '@/lib/utils/order-helpers';
import { formatPrice, formatSize, formatPnlSchmeckles } from '@/lib/format-utils';
import type { Order } from '@/models/Order';
import type { Position } from '@/models/Position';

interface OpenOrdersListProps {
  currentSymbol: string;
}

type OrderOrPosition =
  | { type: 'order'; data: Order }
  | { type: 'position'; data: Position };

export default function OpenOrdersList({ currentSymbol }: OpenOrdersListProps) {
  const router = useRouter();
  const address = useAddressFromUrl();

  const ordersState = useOrderStore((state) => state.orders);
  const optimisticOrdersState = useOrderStore((state) => state.optimisticOrders);
  const positionsState = usePositionStore((state) => state.positions);
  const cancelOrder = useTradingStore((state) => state.cancelOrder);
  const closePosition = useTradingStore((state) => state.closePosition);
  const getDecimals = useSymbolMetaStore((state) => state.getDecimals);
  const schmecklesMode = useSettingsStore((state) => state.settings.chart.schmecklesMode);

  const confirmedCurrentOrders = ordersState[currentSymbol] || [];
  const optimisticCurrentOrders = optimisticOrdersState[currentSymbol] || [];
  const currentPosition = positionsState[currentSymbol];

  const currentItems = useMemo(() => {
    const orders = [...confirmedCurrentOrders, ...optimisticCurrentOrders];
    const items: OrderOrPosition[] = orders.map(order => ({ type: 'order' as const, data: order }));

    if (currentPosition) {
      items.push({ type: 'position' as const, data: currentPosition });
    }

    return items.sort((a, b) => {
      const priceA = a.type === 'order' ? a.data.price : a.data.entryPrice;
      const priceB = b.type === 'order' ? b.data.price : b.data.entryPrice;
      return priceB - priceA;
    });
  }, [confirmedCurrentOrders, optimisticCurrentOrders, currentPosition]);

  const allOrders = useMemo(
    () => getAllOrdersAcrossSymbols(ordersState, optimisticOrdersState),
    [ordersState, optimisticOrdersState]
  );

  const globalItems = useMemo(() => {
    const filtered = allOrders.filter(order => order.coin !== currentSymbol);
    const grouped = groupOrdersBySymbol(filtered);

    const symbolsWithItems = new Set<string>();
    const result = grouped.map(group => {
      symbolsWithItems.add(group.symbol);
      const items: OrderOrPosition[] = group.orders.map(order => ({ type: 'order' as const, data: order }));
      const position = positionsState[group.symbol];

      if (position) {
        items.push({ type: 'position' as const, data: position });
      }

      items.sort((a, b) => {
        const priceA = a.type === 'order' ? a.data.price : a.data.entryPrice;
        const priceB = b.type === 'order' ? b.data.price : b.data.entryPrice;
        return priceB - priceA;
      });

      return { symbol: group.symbol, items };
    });

    Object.entries(positionsState).forEach(([symbol, position]) => {
      if (position && symbol !== currentSymbol && !symbolsWithItems.has(symbol)) {
        result.push({
          symbol,
          items: [{ type: 'position' as const, data: position }]
        });
      }
    });

    return result;
  }, [allOrders, currentSymbol, positionsState]);

  const handleOrderClick = useCallback((symbol: string) => {
    if (symbol !== currentSymbol && address) {
      router.push(`/${address}/${symbol}`);
    }
  }, [currentSymbol, address, router]);

  const handleCancelOrder = useCallback(async (coin: string, oid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await cancelOrder(coin, oid);
    } catch (error) {
      console.error('Failed to cancel order:', error);
    }
  }, [cancelOrder]);

  const handleClosePosition = useCallback(async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await closePosition({ symbol, percentage: 100 });
    } catch (error) {
      console.error('Failed to close position:', error);
    }
  }, [closePosition]);

  const renderOrder = useCallback((order: Order, symbol: string, isClickable: boolean = false) => {
    const decimals = getDecimals(order.coin);
    const isBuy = order.side === 'buy';
    const bgColor = isBuy ? 'bg-bullish/10' : 'bg-bearish/10';
    const borderColor = isBuy ? 'border-bullish/40' : 'border-bearish/40';
    const textColor = isBuy ? 'text-bullish' : 'text-bearish';
    const typeLabel = getOrderTypeLabel(order.orderType);
    const isOptimistic = order.isOptimistic || order.isPendingCancellation;
    const opacity = isOptimistic ? 'opacity-50' : '';
    const usdValue = order.price * order.size;

    return (
      <div
        key={order.oid || order.tempId}
        className={`flex flex-col gap-1 text-xs font-mono ${bgColor} ${borderColor} border ${opacity} ${isClickable ? 'cursor-pointer hover:brightness-110' : ''} px-2 py-1.5 rounded`}
        onClick={isClickable ? () => handleOrderClick(order.coin) : undefined}
      >
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold ${textColor}`}>{typeLabel}</span>
          <button
            onClick={(e) => handleCancelOrder(order.coin, order.oid, e)}
            className="w-[18px] h-[18px] flex items-center justify-center hover:bg-bearish/30 border border-border-frame text-xs rounded flex-shrink-0"
            title="Cancel order"
          >
            ×
          </button>
        </div>
        <div className={`flex items-center justify-between text-[10px] ${textColor}`}>
          <span className="font-bold">{formatPrice(order.price, decimals.price)}</span>
          <span className="opacity-70">
            ${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    );
  }, [getDecimals, handleCancelOrder, handleOrderClick]);

  const renderPosition = useCallback((position: Position, symbol: string, isClickable: boolean = false) => {
    const decimals = getDecimals(symbol);
    const isLong = position.side === 'long';
    const bgColor = isLong ? 'bg-bullish/20' : 'bg-bearish/20';
    const borderColor = isLong ? 'border-bullish/60' : 'border-bearish/60';
    const textColor = isLong ? 'text-bullish' : 'text-bearish';
    const pnlColor = position.pnl >= 0 ? 'text-bullish' : 'text-bearish';
    const usdValue = position.currentPrice * position.size;
    const positionLabel = isLong ? 'LONG' : 'SHORT';

    const pnlDisplay = schmecklesMode
      ? formatPnlSchmeckles(position.pnl, usdValue)
      : `${position.pnl >= 0 ? '+' : ''}$${Math.abs(position.pnl).toFixed(2)}`;

    return (
      <div
        key={`position-${symbol}`}
        className={`flex flex-col gap-1 text-xs font-mono ${bgColor} ${borderColor} border-2 ${isClickable ? 'cursor-pointer hover:brightness-110' : ''} px-2 py-1.5 rounded`}
        onClick={isClickable ? () => handleOrderClick(symbol) : undefined}
      >
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold ${textColor}`}>{positionLabel}</span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold ${pnlColor}`}>
              {pnlDisplay}
            </span>
            <button
              onClick={(e) => handleClosePosition(symbol, e)}
              className="w-[18px] h-[18px] flex items-center justify-center hover:bg-bearish/30 border border-border-frame text-xs rounded flex-shrink-0"
              title="Close position"
            >
              ×
            </button>
          </div>
        </div>
        <div className={`flex items-center justify-between text-[10px] ${textColor}`}>
          <span className="font-bold">{formatPrice(position.entryPrice, decimals.price)}</span>
          <span className="opacity-70">
            ${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    );
  }, [getDecimals, handleClosePosition, handleOrderClick, schmecklesMode]);

  const renderItem = useCallback((item: OrderOrPosition, symbol: string, isClickable: boolean = false) => {
    if (item.type === 'order') {
      return renderOrder(item.data, symbol, isClickable);
    } else {
      return renderPosition(item.data, symbol, isClickable);
    }
  }, [renderOrder, renderPosition]);

  return (
    <div className="w-full md:w-[200px] md:border-l-2 border-border-frame flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-1.5">
        {/* Current Symbol Section */}
        <div className="mb-3">
          <div className="text-xs text-primary-muted mb-2 uppercase tracking-wider">
            {currentSymbol}
          </div>
          <div className="flex flex-col gap-[1px]">
            {currentItems.length === 0 ? (
              <div className="text-xs text-primary-muted/50">No orders or positions</div>
            ) : (
              currentItems.map(item => renderItem(item, currentSymbol, false))
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t-2 border-border-frame my-3"></div>

        {/* All Other Symbols Section */}
        <div>
          <div className="text-xs text-primary-muted mb-2 uppercase tracking-wider">
            ALL SYMBOLS
          </div>
          <div className="flex flex-col gap-2">
            {globalItems.length === 0 ? (
              <div className="text-xs text-primary-muted/50">No orders or positions</div>
            ) : (
              globalItems.map(({ symbol, items }) => (
                <div key={symbol} className="flex flex-col gap-[1px]">
                  <div className="text-[11px] text-primary-muted/70 uppercase tracking-wider font-bold mb-1">
                    {symbol}
                  </div>
                  {items.map(item => renderItem(item, symbol, true))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
