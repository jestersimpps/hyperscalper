export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openFormatted: string;
  highFormatted: string;
  lowFormatted: string;
  closeFormatted: string;
  volumeFormatted: string;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
  priceFormatted: string;
  sizeFormatted: string;
  totalFormatted: string;
}

export interface OrderBookData {
  coin: string;
  timestamp: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface TradeData {
  time: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  priceFormatted: string;
  sizeFormatted: string;
}

export interface CandleSubscriptionParams {
  coin: string;
  interval: string;
}

export interface OrderBookSubscriptionParams {
  coin: string;
}

export interface TradeSubscriptionParams {
  coin: string;
}

export type CandleCallback = (candle: CandleData) => void;
export type OrderBookCallback = (orderBook: OrderBookData) => void;
export type TradeCallback = (trades: TradeData | TradeData[]) => void;

export interface ExchangeWebSocketService {
  subscribeToCandles(params: CandleSubscriptionParams, callback: CandleCallback): string;

  subscribeToOrderBook(params: OrderBookSubscriptionParams, callback: OrderBookCallback): string;

  subscribeToTrades(params: TradeSubscriptionParams, callback: TradeCallback): string;

  unsubscribe(subscriptionId: string): void;

  disconnect(): void;

  isConnected(): boolean;
}

export interface WebSocketConfig {
  type: 'hyperliquid' | 'binance' | 'bybit';
  isTestnet?: boolean;
}
