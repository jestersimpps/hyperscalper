'use client';

import { useEffect, useState, useRef } from 'react';
import { useWebSocketService } from '@/lib/websocket';
import { formatPrice, formatSize, formatTotal } from '@/lib/formatting-utils';

interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
}

interface OrderBookData {
  coin: string;
  timestamp: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

interface OrderBookProps {
  coin: string;
}

export default function OrderBook({ coin }: OrderBookProps) {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const prevPricesRef = useRef<Map<number, 'up' | 'down'>>(new Map());

  useEffect(() => {
    let mounted = true;

    const fetchInitialBook = async () => {
      try {
        const response = await fetch(`/api/orderbook?coin=${coin}`);
        const data: OrderBookData = await response.json();
        if (mounted && data && data.bids && data.asks) {
          setOrderBook(data);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching initial order book:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchInitialBook();

    return () => {
      mounted = false;
    };
  }, [coin]);

  useEffect(() => {
    if (isLoading) return;

    const { service: wsService, trackSubscription } = useWebSocketService('hyperliquid', false);
    const untrackSubscription = trackSubscription();

    const subscriptionId = wsService.subscribeToOrderBook(
      { coin },
      (data) => {
        if (!data || !data.bids || !data.asks) {
          console.warn('Invalid order book data received');
          return;
        }

        setOrderBook((prevOrderBook) => {
          if (prevOrderBook) {
            const newPrices = new Map<number, 'up' | 'down'>();

            data.asks?.forEach((ask, idx) => {
              const oldAsk = prevOrderBook.asks?.[idx];
              if (oldAsk && ask.price === oldAsk.price) {
                if (ask.size > oldAsk.size) newPrices.set(ask.price, 'up');
                else if (ask.size < oldAsk.size) newPrices.set(ask.price, 'down');
              }
            });

            data.bids?.forEach((bid, idx) => {
              const oldBid = prevOrderBook.bids?.[idx];
              if (oldBid && bid.price === oldBid.price) {
                if (bid.size > oldBid.size) newPrices.set(bid.price, 'up');
                else if (bid.size < oldBid.size) newPrices.set(bid.price, 'down');
              }
            });

            prevPricesRef.current = newPrices;
          }

          return data;
        });
      }
    );

    return () => {
      wsService.unsubscribe(subscriptionId);
      untrackSubscription();
    };
  }, [coin, isLoading]);

  const getFlashClass = (price: number): string => {
    const flash = prevPricesRef.current.get(price);
    if (flash === 'up') return 'animate-flash-green';
    if (flash === 'down') return 'animate-flash-red';
    return '';
  };

  if (isLoading || !orderBook || !orderBook.bids || !orderBook.asks) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary-muted text-[10px]">Loading order book...</div>
      </div>
    );
  }

  const maxTotal = Math.max(
    orderBook.bids.length > 0 ? orderBook.bids[orderBook.bids.length - 1]?.total || 0 : 0,
    orderBook.asks.length > 0 ? orderBook.asks[orderBook.asks.length - 1]?.total || 0 : 0
  );

  return (
    <div className="h-full flex flex-col">
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

      <div className="text-[10px] space-y-0.5 font-mono overflow-hidden flex-1 flex flex-col">
        <div className="grid grid-cols-3 text-primary-muted mb-1 font-bold">
          <div>PRICE</div>
          <div className="text-right">SIZE</div>
          <div className="text-right">TOTAL</div>
        </div>

        <div className="flex-1 flex flex-col-reverse overflow-y-auto scrollbar-thin scrollbar-thumb-primary-dark scrollbar-track-transparent">
          {orderBook.asks && orderBook.asks.slice(0, 12).map((ask, idx) => {
            const percentage = maxTotal > 0 ? (ask.total / maxTotal) * 100 : 0;
            return (
              <div
                key={`ask-${idx}-${ask.price}`}
                className={`grid grid-cols-3 text-bearish relative ${getFlashClass(ask.price)}`}
              >
                <div
                  className="absolute inset-0 bg-bearish opacity-20"
                  style={{ width: `${percentage}%` }}
                ></div>
                <div className="relative z-10">{formatPrice(ask.price, coin)}</div>
                <div className="relative z-10 text-right">{formatSize(ask.size, coin)}</div>
                <div className="relative z-10 text-right">{formatTotal(ask.total, coin)}</div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-primary-dark my-1 flex items-center justify-center py-0.5">
          <div className="text-primary font-bold">
            {orderBook.bids[0] && orderBook.asks[0]
              ? formatPrice((parseFloat(orderBook.bids[0].price.toString()) + parseFloat(orderBook.asks[0].price.toString())) / 2, coin)
              : '---'}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-primary-dark scrollbar-track-transparent">
          {orderBook.bids && orderBook.bids.slice(0, 12).map((bid, idx) => {
            const percentage = maxTotal > 0 ? (bid.total / maxTotal) * 100 : 0;
            return (
              <div
                key={`bid-${idx}-${bid.price}`}
                className={`grid grid-cols-3 text-bullish relative ${getFlashClass(bid.price)}`}
              >
                <div
                  className="absolute inset-0 bg-bullish opacity-20"
                  style={{ width: `${percentage}%` }}
                ></div>
                <div className="relative z-10">{formatPrice(bid.price, coin)}</div>
                <div className="relative z-10 text-right">{formatSize(bid.size, coin)}</div>
                <div className="relative z-10 text-right">{formatTotal(bid.total, coin)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
