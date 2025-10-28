export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
}

export interface OrderBookData {
  coin: string;
  timestamp: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface CandleSubscriptionParams {
  coin: string;
  interval: string;
}

export interface OrderBookSubscriptionParams {
  coin: string;
}

export type CandleCallback = (candle: CandleData) => void;
export type OrderBookCallback = (orderBook: OrderBookData) => void;

export interface ExchangeWebSocketService {
  subscribeToCandles(params: CandleSubscriptionParams, callback: CandleCallback): string;

  subscribeToOrderBook(params: OrderBookSubscriptionParams, callback: OrderBookCallback): string;

  unsubscribe(subscriptionId: string): void;

  disconnect(): void;

  isConnected(): boolean;
}

export interface WebSocketConfig {
  type: 'hyperliquid' | 'binance' | 'bybit';
  isTestnet?: boolean;
}
