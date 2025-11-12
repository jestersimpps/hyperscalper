'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
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

  const [newlyAddedItems, setNewlyAddedItems] = useState<Set<string>>(new Set());
  const [exitingItems, setExitingItems] = useState<Set<string>>(new Set());
  const prevItemsRef = useRef<Map<string, Set<string>>>(new Map());

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

  const getItemId = (item: OrderOrPosition, symbol: string): string => {
    if (item.type === 'order') {
      return `order-${item.data.oid || item.data.tempId}`;
    }
    return `position-${symbol}`;
  };

  useEffect(() => {
    const allSymbols = [currentSymbol, ...globalItems.map(g => g.symbol)];
    const currentItemIds = new Map<string, Set<string>>();

    allSymbols.forEach(symbol => {
      const ids = new Set<string>();

      if (symbol === currentSymbol) {
        currentItems.forEach(item => {
          ids.add(getItemId(item, symbol));
        });
      } else {
        const group = globalItems.find(g => g.symbol === symbol);
        group?.items.forEach(item => {
          ids.add(getItemId(item, symbol));
        });
      }

      currentItemIds.set(symbol, ids);
    });

    const newIds = new Set<string>();
    const removedIds = new Set<string>();

    allSymbols.forEach(symbol => {
      const prevIds = prevItemsRef.current.get(symbol) || new Set();
      const currIds = currentItemIds.get(symbol) || new Set();

      currIds.forEach(id => {
        if (!prevIds.has(id)) {
          newIds.add(id);
        }
      });

      prevIds.forEach(id => {
        if (!currIds.has(id)) {
          removedIds.add(id);
        }
      });
    });

    if (newIds.size > 0) {
      setNewlyAddedItems(prev => new Set([...prev, ...newIds]));

      newIds.forEach(id => {
        setTimeout(() => {
          setNewlyAddedItems(prev => {
            const updated = new Set(prev);
            updated.delete(id);
            return updated;
          });
        }, 500);
      });
    }

    if (removedIds.size > 0) {
      setExitingItems(prev => new Set([...prev, ...removedIds]));

      setTimeout(() => {
        setExitingItems(prev => {
          const updated = new Set(prev);
          removedIds.forEach(id => updated.delete(id));
          return updated;
        });
      }, 400);
    }

    prevItemsRef.current = currentItemIds;
  }, [currentItems, globalItems, currentSymbol]);

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

  const renderOrder = (order: Order, symbol: string, isClickable: boolean = false) => {
    const itemId = getItemId({ type: 'order', data: order }, symbol);
    const decimals = getDecimals(order.coin);
    const isBuy = order.side === 'buy';
    const bgColor = isBuy ? 'bg-bullish/10' : 'bg-bearish/10';
    const borderColor = isBuy ? 'border-bullish/40' : 'border-bearish/40';
    const textColor = isBuy ? 'text-bullish' : 'text-bearish';
    const typeLabel = getOrderTypeLabel(order.orderType);
    const isOptimistic = order.isOptimistic || order.isPendingCancellation;
    const opacity = isOptimistic ? 'opacity-50' : '';
    const usdValue = order.price * order.size;

    const isNewlyAdded = newlyAddedItems.has(itemId);
    const isExiting = exitingItems.has(itemId);
    const entranceAnimation = isNewlyAdded ? 'animate-slideInDown' : '';
    const exitAnimation = isExiting ? 'animate-slideOutUp' : '';

    return (
      <div
        key={order.oid || order.tempId}
        className={`flex flex-col gap-1 text-xs font-mono ${bgColor} ${borderColor} border ${opacity} ${entranceAnimation} ${exitAnimation} ${isClickable ? 'cursor-pointer hover:brightness-110' : ''} px-2 py-1.5 rounded`}
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
  };

  const renderPosition = (position: Position, symbol: string, isClickable: boolean = false) => {
    const itemId = getItemId({ type: 'position', data: position }, symbol);
    const decimals = getDecimals(symbol);
    const isLong = position.side === 'long';
    const bgColor = isLong ? 'bg-bullish/20' : 'bg-bearish/20';
    const borderColor = isLong ? 'border-bullish/60' : 'border-bearish/60';
    const textColor = isLong ? 'text-bullish' : 'text-bearish';
    const pnlColor = position.pnl >= 0 ? 'text-bullish' : 'text-bearish';
    const pulseAnimation = position.pnl > 0 ? 'animate-pulseProfitGlow' : '';
    const usdValue = position.currentPrice * position.size;

    const isNewlyAdded = newlyAddedItems.has(itemId);
    const isExiting = exitingItems.has(itemId);
    const entranceAnimation = isNewlyAdded ? 'animate-slideInDown' : '';
    const exitAnimation = isExiting ? 'animate-slideOutUp' : '';

    return (
      <div
        key={`position-${symbol}`}
        className={`flex flex-col gap-1 text-xs font-mono ${bgColor} ${borderColor} border-2 ${pulseAnimation} ${entranceAnimation} ${exitAnimation} ${isClickable ? 'cursor-pointer hover:brightness-110' : ''} px-2 py-1.5 rounded`}
        onClick={isClickable ? () => handleOrderClick(symbol) : undefined}
      >
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold ${textColor}`}>ENTRY</span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold ${pnlColor}`}>
              {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)}
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
  };

  const renderItem = (item: OrderOrPosition, symbol: string, isClickable: boolean = false) => {
    if (item.type === 'order') {
      return renderOrder(item.data, symbol, isClickable);
    } else {
      return renderPosition(item.data, symbol, isClickable);
    }
  };

  return (
    <div className="w-[200px] border-l-2 border-border-frame flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-1.5">
        {/* Current Symbol Section */}
        <div className="mb-3">
          <div className="text-xs text-primary-muted mb-2 uppercase tracking-wider">
            {currentSymbol}
          </div>
          <div className="space-y-1.5">
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
          <div className="space-y-2">
            {globalItems.length === 0 ? (
              <div className="text-xs text-primary-muted/50">No orders or positions</div>
            ) : (
              globalItems.map(({ symbol, items }) => (
                <div key={symbol} className="space-y-1.5">
                  <div className="text-[11px] text-primary-muted/70 uppercase tracking-wider font-bold">
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
