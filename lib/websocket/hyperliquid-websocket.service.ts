import type {
  ExchangeWebSocketService,
  CandleSubscriptionParams,
  TradeSubscriptionParams,
  OrderbookSubscriptionParams,
  CandleCallback,
  TradeCallback,
  AllMidsCallback,
  OrderbookCallback,
  CandleData,
  TradeData,
  AllMidsData,
  OrderbookData,
  OrderbookLevel
} from './exchange-websocket.interface';

import { EventClient, WebSocketTransport } from '@nktkas/hyperliquid';
import type { Candle, WsTrade } from '@nktkas/hyperliquid';

interface BookLevelRaw {
  px: string;
  sz: string;
  n?: number;
}
interface BookSnapshot {
  coin: string;
  time: number;
  levels: [BookLevelRaw[], BookLevelRaw[]];
}
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useWebSocketStatusStore } from '@/stores/useWebSocketStatusStore';
import { formatPrice, formatSize } from '@/lib/format-utils';

interface Subscription {
  id: string;
  type: 'candle' | 'trade' | 'allMids' | 'orderbook';
  params: any;
  callback: any;
  unsubscribeFn: Promise<{ unsubscribe: () => void }> | (() => void);
}

const MAX_BOOK_LEVELS = 25;

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
      useWebSocketStatusStore.getState().setOverallStatus('connecting');
      this.wsTransport = new WebSocketTransport({
        url: this.wsUrl,
        keepAlive: { interval: 20_000 },
        reconnect: {
          maxRetries: Number.POSITIVE_INFINITY,
          connectionTimeout: 10_000,
          connectionDelay: (attempt) => Math.min(150 * (1 << Math.min(attempt, 6)), 10_000),
        },
      });
      this.eventClient = new EventClient({ transport: this.wsTransport });
      this.isInitialized = true;
      useWebSocketStatusStore.getState().setOverallStatus('connected');

      const socket = this.wsTransport.socket;
      socket.addEventListener('open', () => {
        useWebSocketStatusStore.getState().setOverallStatus('connected');
      });
      socket.addEventListener('close', () => {
        useWebSocketStatusStore.getState().setOverallStatus('connecting');
      });
      socket.addEventListener('error', () => {
        useWebSocketStatusStore.getState().setOverallStatus('error');
      });
    } catch (error) {
      useWebSocketStatusStore.getState().setOverallStatus('error');
      throw error;
    }
  }

  subscribeToCandles(params: CandleSubscriptionParams, callback: CandleCallback): string {
    const subscriptionId = `candle_${params.coin}_${params.interval}_${Date.now()}`;

    this.initialize().then(() => {
      if (!this.eventClient) {
        return;
      }

      const unsubscribeFn = this.eventClient.candle(
        { coin: params.coin, interval: params.interval },
        (candle: Candle) => {
          try {
            const open = parseFloat(candle.o);
            const high = parseFloat(candle.h);
            const low = parseFloat(candle.l);
            const close = parseFloat(candle.c);
            const volume = parseFloat(candle.v || '0');

            const decimals = useSymbolMetaStore.getState().getDecimals(params.coin);

            const candleData: CandleData = {
              time: candle.t,
              open,
              high,
              low,
              close,
              volume,
              openFormatted: formatPrice(open, decimals.price),
              highFormatted: formatPrice(high, decimals.price),
              lowFormatted: formatPrice(low, decimals.price),
              closeFormatted: formatPrice(close, decimals.price),
              volumeFormatted: formatSize(volume, decimals.size)
            };
            callback(candleData);
          } catch (error) {
            // Error processing candle
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
    }).catch(() => {});

    return subscriptionId;
  }

  subscribeToTrades(params: TradeSubscriptionParams, callback: TradeCallback): string {
    const subscriptionId = `trade_${params.coin}_${Date.now()}`;

    this.initialize().then(() => {
      if (!this.eventClient) {
        return;
      }

      const unsubscribeFn = this.eventClient.trades(
        { coin: params.coin },
        (trades: WsTrade[]) => {
          try {
            const decimals = useSymbolMetaStore.getState().getDecimals(params.coin);
            const tradeBatch = trades.map((trade: WsTrade): TradeData => {
              const price = parseFloat(trade.px);
              const size = parseFloat(trade.sz);
              return {
                time: trade.time,
                price,
                size,
                side: trade.side === 'B' ? 'buy' : 'sell',
                priceFormatted: formatPrice(price, decimals.price),
                sizeFormatted: formatSize(size, decimals.size)
              };
            });
            callback(tradeBatch);
          } catch (error) {
            // Error processing trade
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
    }).catch(() => {});

    return subscriptionId;
  }

  subscribeToAllMids(callback: AllMidsCallback): string {
    const subscriptionId = `allmids_${Date.now()}`;

    this.initialize().then(() => {
      if (!this.eventClient) {
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
            // Error processing allMids
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
    }).catch(() => {});

    return subscriptionId;
  }

  subscribeToOrderbook(params: OrderbookSubscriptionParams, callback: OrderbookCallback): string {
    const subscriptionId = `orderbook_${params.coin}_${Date.now()}`;

    this.initialize().then(() => {
      if (!this.eventClient) {
        return;
      }

      const l2Args: { coin: string; nSigFigs?: 2 | 3 | 4 | 5 | null; mantissa?: 2 | 5 | null } = {
        coin: params.coin,
      };
      if (params.nSigFigs !== undefined) l2Args.nSigFigs = params.nSigFigs;
      if (params.mantissa !== undefined) l2Args.mantissa = params.mantissa;

      const unsubscribeFn = this.eventClient.l2Book(
        l2Args,
        (book: BookSnapshot) => {
          try {
            const rawBids = book.levels?.[0] ?? [];
            const rawAsks = book.levels?.[1] ?? [];

            let bidTotal = 0;
            const bids: OrderbookLevel[] = [];
            for (let i = 0; i < rawBids.length && i < MAX_BOOK_LEVELS; i++) {
              const price = parseFloat(rawBids[i].px);
              const size = parseFloat(rawBids[i].sz);
              if (!Number.isFinite(price) || !Number.isFinite(size)) continue;
              bidTotal += size;
              bids.push({ price, size, total: bidTotal });
            }

            let askTotal = 0;
            const asks: OrderbookLevel[] = [];
            for (let i = 0; i < rawAsks.length && i < MAX_BOOK_LEVELS; i++) {
              const price = parseFloat(rawAsks[i].px);
              const size = parseFloat(rawAsks[i].sz);
              if (!Number.isFinite(price) || !Number.isFinite(size)) continue;
              askTotal += size;
              asks.push({ price, size, total: askTotal });
            }

            const data: OrderbookData = {
              coin: book.coin ?? params.coin,
              time: book.time ?? Date.now(),
              bids,
              asks,
            };
            callback(data);
          } catch (error) {
            // Error processing orderbook
          }
        }
      );

      const subscription: Subscription = {
        id: subscriptionId,
        type: 'orderbook',
        params,
        callback,
        unsubscribeFn
      };

      this.subscriptions.set(subscriptionId, subscription);
    }).catch(() => {});

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      try {
        if (typeof subscription.unsubscribeFn === 'function') {
          subscription.unsubscribeFn();
        } else if (subscription.unsubscribeFn instanceof Promise) {
          subscription.unsubscribeFn.then(sub => sub.unsubscribe());
        }
      } catch (error) {
        // Error unsubscribing
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
        // Error during cleanup
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
    useWebSocketStatusStore.getState().setOverallStatus('disconnected');
  }

  isConnected(): boolean {
    return this.isInitialized && this.wsTransport !== null;
  }
}
