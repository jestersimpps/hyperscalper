import type {
  Book,
  Candle,
  WsTrade,
  PerpsClearinghouseState,
  AssetPosition,
  FrontendOrder,
  OrderResponse,
  CancelResponse,
  PerpsMeta,
  AllMids,
  SuccessResponse
} from '@nktkas/hyperliquid';
import type { CandleData, TimeInterval } from '@/types';
import type { SymbolMetadata } from './metadata-cache.service';

export interface TransformedCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleParams {
  coin: string;
  interval: TimeInterval;
  startTime?: number;
  endTime?: number;
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

export interface TriggerMarketOrderParams {
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

export interface AssetCtx {
  dayNtlVlm: string;
  funding: string;
  openInterest: string;
  prevDayPx: string;
  markPx: string;
  midPx?: string;
}

export interface MetaAndAssetCtxs {
  meta: PerpsMeta;
  assetCtxs: AssetCtx[];
}

export interface IHyperliquidService {
  getCandles(params: CandleParams): Promise<TransformedCandle[]>;
  getRecentTrades(params: TradesParams): Promise<WsTrade[]>;

  subscribeToCandles(params: CandleParams, callback: (data: TransformedCandle) => void): Promise<() => void>;
  subscribeToTrades(params: TradesParams, callback: (data: WsTrade[]) => void): Promise<() => void>;

  placeMarketBuy(coin: string, size: string, price: string, metadata: SymbolMetadata): Promise<OrderResponse>;
  placeMarketSell(coin: string, size: string, price: string, metadata: SymbolMetadata): Promise<OrderResponse>;
  placeLimitOrder(params: OrderParams, metadata: SymbolMetadata): Promise<OrderResponse>;
  placeBatchLimitOrders(orders: OrderParams[], metadata: SymbolMetadata): Promise<OrderResponse>;
  placeStopLoss(params: StopLossParams, metadata: SymbolMetadata): Promise<OrderResponse>;
  placeTakeProfit(params: TakeProfitParams, metadata: SymbolMetadata): Promise<OrderResponse>;
  placeTriggerMarketOrder(params: TriggerMarketOrderParams, metadata: SymbolMetadata): Promise<OrderResponse>;

  getAccountState(user?: string): Promise<PerpsClearinghouseState>;
  getOpenPositions(user?: string): Promise<AssetPosition[]>;
  getAccountBalance(user?: string): Promise<AccountBalance>;
  getOpenOrders(user?: string): Promise<FrontendOrder[]>;
  cancelOrder(coin: string, orderId: number, metadata: SymbolMetadata): Promise<CancelResponse>;
  cancelAllOrders(coin: string, metadata: SymbolMetadata): Promise<CancelResponse>;
  cancelEntryOrders(coin: string, metadata: SymbolMetadata): Promise<CancelResponse>;
  cancelExitOrders(coin: string, metadata: SymbolMetadata): Promise<CancelResponse>;
  cancelTPOrders(coin: string, metadata: SymbolMetadata): Promise<CancelResponse>;
  cancelSLOrders(coin: string, metadata: SymbolMetadata): Promise<CancelResponse>;

  openLong(params: LongParams, metadata: SymbolMetadata): Promise<OrderResponse>;
  openShort(params: ShortParams, metadata: SymbolMetadata): Promise<OrderResponse>;
  closePosition(params: ClosePositionParams, price: string, metadata: SymbolMetadata, positionData: AssetPosition): Promise<OrderResponse>;

  setLeverage(coin: string, leverage: number, metadata: SymbolMetadata, isCross?: boolean): Promise<SuccessResponse | null>;

  getCoinIndex(coin: string): Promise<number>;
  formatPrice(price: number, coin: string): Promise<string>;
  formatSize(size: number, coin: string): Promise<string>;
  getMeta(): Promise<PerpsMeta>;
  getAllMids(): Promise<AllMids>;
  getMetaAndAssetCtxs(): Promise<MetaAndAssetCtxs>;
  getMetadataCache(coin: string): Promise<SymbolMetadata>;
  formatPriceCached(price: number, metadata: SymbolMetadata): string;
  formatSizeCached(size: number, metadata: SymbolMetadata): string;
  getAccountBalanceCached(user?: string): Promise<AccountBalance>;
  invalidateAccountCache(): void;
}
