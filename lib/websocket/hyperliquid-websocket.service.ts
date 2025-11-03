import type {
  ExchangeWebSocketService,
  CandleSubscriptionParams,
  OrderBookSubscriptionParams,
  TradeSubscriptionParams,
  CandleCallback,
  OrderBookCallback,
  TradeCallback,
  AllMidsCallback,
  CandleData,
  OrderBookData,
  TradeData,
  AllMidsData,
  OrderBookLevel
} from './exchange-websocket.interface';

import { EventClient, WebSocketTransport } from '@nktkas/hyperliquid';
import type { Candle, Book, Trade } from '@nktkas/hyperliquid';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { formatPrice, formatSize } from '@/lib/format-utils';

interface Subscription {
  id: string;
  type: 'candle' | 'orderBook' | 'trade' | 'allMids';
  params: any;
  callback: any;
  unsubscribeFn: () => void;
}

const formatOrderBookLevel = (level: Omit<OrderBookLevel, 'priceFormatted' | 'sizeFormatted' | 'totalFormatted'>, coin: string): OrderBookLevel => {
  const decimals = useSymbolMetaStore.getState().getDecimals(coin);
  return {
    ...level,
    priceFormatted: formatPrice(level.price, decimals.price),
    sizeFormatted: formatSize(level.size, decimals.size),
    totalFormatted: formatSize(level.total, decimals.size),
  };
};

export class HyperliquidWebSocketService implements ExchangeWebSocketService {
  private wsTransport: WebSocketTransport | null = null;
  private eventClient: EventClient | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private isInitialized = false;
  private wsUrl: string;

  constructor(isTestnet: boolean = false) {
    this.wsUrl = isTestnet
      ? 'wss://api.hyperliquid-testnet.xyz/ws'
      : 'wss://api.hyperliquid.xyz/ws';
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.wsTransport = new WebSocketTransport({ url: this.wsUrl });
      this.eventClient = new EventClient({ transport: this.wsTransport });
      this.isInitialized = true;
      console.log('[HyperliquidWS] Initialized');
    } catch (error) {
      console.error('[HyperliquidWS] Failed to initialize:', error);
      throw error;
    }
  }

  subscribeToCandles(params: CandleSubscriptionParams, callback: CandleCallback): string {
    const subscriptionId = `candle_${params.coin}_${params.interval}_${Date.now()}`;

    this.initialize().then(() => {
      if (!this.eventClient) {
        console.error('[HyperliquidWS] EventClient not initialized');
        return;
      }

      const unsubscribeFn = this.eventClient.candle(
        { coin: params.coin, interval: params.interval },
        (candle: Candle) => {
          try {
            const candleData: CandleData = {
              time: candle.t,
              open: parseFloat(candle.o),
              high: parseFloat(candle.h),
              low: parseFloat(candle.l),
              close: parseFloat(candle.c),
              volume: parseFloat(candle.v || '0')
            };
            callback(candleData);
          } catch (error) {
            console.error('[HyperliquidWS] Error processing candle:', error);
          }
        }
      );

      const subscription: Subscription = {
        id: subscriptionId,
        type: 'candle',
        params,
        callback,
        unsubscribeFn
      };

      this.subscriptions.set(subscriptionId, subscription);
    }).catch((error) => {
      console.error('[HyperliquidWS] Failed to subscribe to candles:', error);
    });

    return subscriptionId;
  }

  subscribeToOrderBook(params: OrderBookSubscriptionParams, callback: OrderBookCallback): string {
    const precisionSuffix = params.nSigFigs ? `_${params.nSigFigs}` : '';
    const subscriptionId = `orderbook_${params.coin}${precisionSuffix}_${Date.now()}`;

    this.initialize().then(() => {
      if (!this.eventClient) {
        console.error('[HyperliquidWS] EventClient not initialized');
        return;
      }

      const unsubscribeFn = this.eventClient.l2Book(
        {
          coin: params.coin,
          nSigFigs: params.nSigFigs,
          mantissa: params.mantissa
        },
        (book: Book) => {
          try {
            const bids = book.levels[0].map(level => ({
              price: parseFloat(level.px),
              size: parseFloat(level.sz),
              total: 0
            }));

            const asks = book.levels[1].map(level => ({
              price: parseFloat(level.px),
              size: parseFloat(level.sz),
              total: 0
            }));

            let bidTotal = 0;
            bids.forEach(bid => {
              bidTotal += bid.size;
              bid.total = bidTotal;
            });

            let askTotal = 0;
            asks.forEach(ask => {
              askTotal += ask.size;
              ask.total = askTotal;
            });

            const formattedBook: OrderBookData = {
              coin: params.coin,
              timestamp: Date.now(),
              bids: bids.map(level => formatOrderBookLevel(level, params.coin)),
              asks: asks.map(level => formatOrderBookLevel(level, params.coin))
            };

            callback(formattedBook);
          } catch (error) {
            console.error('[HyperliquidWS] Error processing order book:', error);
          }
        }
      );

      const subscription: Subscription = {
        id: subscriptionId,
        type: 'orderBook',
        params,
        callback,
        unsubscribeFn
      };

      this.subscriptions.set(subscriptionId, subscription);
    }).catch((error) => {
      console.error('[HyperliquidWS] Failed to subscribe to order book:', error);
    });

    return subscriptionId;
  }

  subscribeToTrades(params: TradeSubscriptionParams, callback: TradeCallback): string {
    const subscriptionId = `trade_${params.coin}_${Date.now()}`;

    this.initialize().then(() => {
      if (!this.eventClient) {
        console.error('[HyperliquidWS] EventClient not initialized');
        return;
      }

      const unsubscribeFn = this.eventClient.trades(
        { coin: params.coin },
        (trades: Trade[]) => {
          try {
            const tradeBatch = trades.map((trade: Trade): TradeData => ({
              time: trade.time,
              price: parseFloat(trade.px),
              size: parseFloat(trade.sz),
              side: trade.side === 'B' ? 'buy' : 'sell'
            }));
            callback(tradeBatch);
          } catch (error) {
            console.error('[HyperliquidWS] Error processing trade:', error);
          }
        }
      );

      const subscription: Subscription = {
        id: subscriptionId,
        type: 'trade',
        params,
        callback,
        unsubscribeFn
      };

      this.subscriptions.set(subscriptionId, subscription);
    }).catch((error) => {
      console.error('[HyperliquidWS] Failed to subscribe to trades:', error);
    });

    return subscriptionId;
  }

  subscribeToAllMids(callback: AllMidsCallback): string {
    const subscriptionId = `allmids_${Date.now()}`;

    this.initialize().then(() => {
      if (!this.eventClient) {
        console.error('[HyperliquidWS] EventClient not initialized');
        return;
      }

      const unsubscribeFn = this.eventClient.allMids(
        (data: { mids: { [coin: string]: string } }) => {
          try {
            const prices: AllMidsData = {};
            Object.entries(data.mids).forEach(([coin, price]) => {
              prices[coin] = parseFloat(price);
            });
            callback(prices);
          } catch (error) {
            console.error('[HyperliquidWS] Error processing allMids:', error);
          }
        }
      );

      const subscription: Subscription = {
        id: subscriptionId,
        type: 'allMids',
        params: {},
        callback,
        unsubscribeFn
      };

      this.subscriptions.set(subscriptionId, subscription);
    }).catch((error) => {
      console.error('[HyperliquidWS] Failed to subscribe to allMids:', error);
    });

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      try {
        if (typeof subscription.unsubscribeFn === 'function') {
          subscription.unsubscribeFn();
        }
      } catch (error) {
        console.error('[HyperliquidWS] Error unsubscribing:', error);
      }
      this.subscriptions.delete(subscriptionId);
    }
  }

  disconnect(): void {
    this.subscriptions.forEach(sub => {
      try {
        if (typeof sub.unsubscribeFn === 'function') {
          sub.unsubscribeFn();
        }
      } catch (error) {
        console.error('[HyperliquidWS] Error during cleanup:', error);
      }
    });
    this.subscriptions.clear();

    if (this.wsTransport) {
      try {
        this.wsTransport.close().catch(() => {});
      } catch (error) {
        // Ignore cleanup errors
      }
      this.wsTransport = null;
    }

    this.eventClient = null;
    this.isInitialized = false;
    console.log('[HyperliquidWS] Disconnected');
  }

  isConnected(): boolean {
    return this.isInitialized && this.wsTransport !== null;
  }
}
