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

export interface TradeData {
  time: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  priceFormatted: string;
  sizeFormatted: string;
}

export interface AllMidsData {
  [coin: string]: number;
}

export interface OrderbookLevel {
  price: number;
  size: number;
  total: number;
}

export interface OrderbookData {
  coin: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  time: number;
}

export interface CandleSubscriptionParams {
  coin: string;
  interval: string;
}

export interface TradeSubscriptionParams {
  coin: string;
}

export interface OrderbookSubscriptionParams {
  coin: string;
}

export type CandleCallback = (candle: CandleData) => void;
export type TradeCallback = (trades: TradeData | TradeData[]) => void;
export type AllMidsCallback = (mids: AllMidsData) => void;
export type OrderbookCallback = (book: OrderbookData) => void;

export interface ExchangeWebSocketService {
  subscribeToCandles(params: CandleSubscriptionParams, callback: CandleCallback): string;

  subscribeToTrades(params: TradeSubscriptionParams, callback: TradeCallback): string;

  subscribeToAllMids(callback: AllMidsCallback): string;

  subscribeToOrderbook(params: OrderbookSubscriptionParams, callback: OrderbookCallback): string;

  unsubscribe(subscriptionId: string): void;

  disconnect(): void;

  isConnected(): boolean;
}

export interface WebSocketConfig {
  type: 'hyperliquid' | 'binance' | 'bybit';
  isTestnet?: boolean;
}
