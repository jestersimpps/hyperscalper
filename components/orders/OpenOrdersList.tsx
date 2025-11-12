'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useOrderStore } from '@/stores/useOrderStore';
import { usePositionStore } from '@/stores/usePositionStore';
import { useTradingStore } from '@/stores/useTradingStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useAddressFromUrl } from '@/lib/hooks/use-address-from-url';
import {
  getOrderTypeLabel,
  sortOrdersByPrice,
  groupOrdersBySymbol,
  getAllOrdersAcrossSymbols
} from '@/lib/utils/order-helpers';
import { formatPrice, formatSize } from '@/lib/format-utils';
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

    return grouped.map(group => {
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
  }, [allOrders, currentSymbol, positionsState]);

  const handleOrderClick = (symbol: string) => {
    if (symbol !== currentSymbol && address) {
      router.push(`/${address}/${symbol}`);
    }
  };

  const handleCancelOrder = async (coin: string, oid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await cancelOrder(coin, oid);
    } catch (error) {
      console.error('Failed to cancel order:', error);
    }
  };

  const handleClosePosition = async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await closePosition({ symbol, percentage: 100 });
    } catch (error) {
      console.error('Failed to close position:', error);
    }
  };

  const renderOrder = (order: Order, isClickable: boolean = false) => {
    const decimals = getDecimals(order.coin);
    const isBuy = order.side === 'buy';
    const bgColor = isBuy ? 'bg-bullish/10' : 'bg-bearish/10';
    const borderColor = isBuy ? 'border-bullish/40' : 'border-bearish/40';
    const textColor = isBuy ? 'text-bullish' : 'text-bearish';
    const typeLabel = getOrderTypeLabel(order.orderType);
    const isOptimistic = order.isOptimistic || order.isPendingCancellation;
    const opacity = isOptimistic ? 'opacity-50' : '';

    return (
      <div
        key={order.oid || order.tempId}
        className={`flex items-center gap-2 text-[9px] font-mono ${bgColor} ${borderColor} border ${opacity} ${isClickable ? 'cursor-pointer hover:brightness-110' : ''} px-2 py-1 rounded`}
        onClick={isClickable ? () => handleOrderClick(order.coin) : undefined}
      >
        <span className={`text-[8px] font-bold ${textColor} w-[45px]`}>{typeLabel}</span>
        <span className={`flex-1 font-bold ${textColor} truncate`}>{formatPrice(order.price, decimals.price)}</span>
        <button
          onClick={(e) => handleCancelOrder(order.coin, order.oid, e)}
          className="w-[16px] h-[16px] flex items-center justify-center hover:bg-bearish/30 border border-border-frame text-[11px] rounded flex-shrink-0"
          title="Cancel order"
        >
          ×
        </button>
      </div>
    );
  };

  const renderPosition = (position: Position, symbol: string, isClickable: boolean = false) => {
    const decimals = getDecimals(symbol);
    const isLong = position.side === 'long';
    const bgColor = isLong ? 'bg-bullish/20' : 'bg-bearish/20';
    const borderColor = isLong ? 'border-bullish/60' : 'border-bearish/60';
    const textColor = isLong ? 'text-bullish' : 'text-bearish';
    const pnlColor = position.pnl >= 0 ? 'text-bullish' : 'text-bearish';
    const blinkAnimation = position.pnl > 0 ? 'animate-blink-green' : '';

    return (
      <div
        key={`position-${symbol}`}
        className={`flex items-center gap-2 text-[9px] font-mono ${bgColor} ${borderColor} border-2 ${blinkAnimation} ${isClickable ? 'cursor-pointer hover:brightness-110' : ''} px-2 py-1 rounded`}
        onClick={isClickable ? () => handleOrderClick(symbol) : undefined}
      >
        <span className={`text-[8px] font-bold ${textColor} w-[45px]`}>ENTRY</span>
        <span className={`flex-1 font-bold ${textColor} truncate`}>{formatPrice(position.entryPrice, decimals.price)}</span>
        <span className={`text-[8px] font-bold ${pnlColor} mr-1`}>
          {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)}
        </span>
        <button
          onClick={(e) => handleClosePosition(symbol, e)}
          className="w-[16px] h-[16px] flex items-center justify-center hover:bg-bearish/30 border border-border-frame text-[11px] rounded flex-shrink-0"
          title="Close position"
        >
          ×
        </button>
      </div>
    );
  };

  const renderItem = (item: OrderOrPosition, symbol: string, isClickable: boolean = false) => {
    if (item.type === 'order') {
      return renderOrder(item.data, isClickable);
    } else {
      return renderPosition(item.data, symbol, isClickable);
    }
  };

  return (
    <div className="w-[200px] border-l-2 border-border-frame flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-1.5">
        {/* Current Symbol Section */}
        <div className="mb-3">
          <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">
            {currentSymbol}
          </div>
          <div className="space-y-1.5">
            {currentItems.length === 0 ? (
              <div className="text-[9px] text-primary-muted/50">No orders or positions</div>
            ) : (
              currentItems.map(item => renderItem(item, currentSymbol, false))
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t-2 border-border-frame my-3"></div>

        {/* All Other Symbols Section */}
        <div>
          <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">
            ALL SYMBOLS
          </div>
          <div className="space-y-2">
            {globalItems.length === 0 ? (
              <div className="text-[9px] text-primary-muted/50">No orders or positions</div>
            ) : (
              globalItems.map(({ symbol, items }) => (
                <div key={symbol} className="space-y-1.5">
                  <div className="text-[9px] text-primary-muted/70 uppercase tracking-wider font-bold">
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
