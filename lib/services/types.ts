import type { Book, Candle, WsTrade } from '@nktkas/hyperliquid';
import type { CandleData, TimeInterval } from '@/types';

export interface CandleParams {
  coin: string;
  interval: TimeInterval;
  startTime?: number;
  endTime?: number;
}

export interface OrderBookParams {
  coin: string;
}

export interface TradesParams {
  coin: string;
}

export interface OrderParams {
  coin: string;
  isBuy: boolean;
  price: string;
  size: string;
  reduceOnly?: boolean;
}

export interface StopLossParams {
  coin: string;
  triggerPrice: string;
  size: string;
  isBuy: boolean;
}

export interface TakeProfitParams {
  coin: string;
  triggerPrice: string;
  size: string;
  isBuy: boolean;
}

export interface LongParams {
  coin: string;
  size: string;
  price?: string;
}

export interface ShortParams {
  coin: string;
  size: string;
  price?: string;
}

export interface ClosePositionParams {
  coin: string;
  size?: string;
}

export interface AccountBalance {
  withdrawable: string;
  marginUsed: string;
  accountValue: string;
}

export interface IHyperliquidService {
  getCandles(params: CandleParams): Promise<Candle[]>;
  getOrderBook(params: OrderBookParams): Promise<Book>;
  getRecentTrades(params: TradesParams): Promise<any[]>;

  subscribeToOrderBook(params: OrderBookParams, callback: (data: Book) => void): Promise<() => void>;
  subscribeToCandles(params: CandleParams, callback: (data: Candle) => void): Promise<() => void>;
  subscribeToTrades(params: TradesParams, callback: (data: WsTrade[]) => void): Promise<() => void>;

  placeMarketBuy(coin: string, size: string): Promise<any>;
  placeMarketSell(coin: string, size: string): Promise<any>;
  placeLimitOrder(params: OrderParams): Promise<any>;
  placeStopLoss(params: StopLossParams): Promise<any>;
  placeTakeProfit(params: TakeProfitParams): Promise<any>;

  getAccountState(user?: string): Promise<any>;
  getOpenPositions(user?: string): Promise<any[]>;
  getAccountBalance(user?: string): Promise<AccountBalance>;
  getOpenOrders(user?: string): Promise<any[]>;

  openLong(params: LongParams): Promise<any>;
  openShort(params: ShortParams): Promise<any>;
  closePosition(params: ClosePositionParams): Promise<any>;

  setLeverage(coin: string, leverage: number, isCross?: boolean): Promise<any>;

  getCoinIndex(coin: string): Promise<number>;
  formatPrice(price: number, coin: string): Promise<string>;
  formatSize(size: number, coin: string): Promise<string>;
}
