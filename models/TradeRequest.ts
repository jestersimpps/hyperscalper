export const POSITION_SIZES = {
  CLOUD: 'cloud',
  SM: 'small',
  BIG: 'big',
} as const;

export type PositionSize = typeof POSITION_SIZES[keyof typeof POSITION_SIZES];

export interface TradeRequestBase {
  symbol: string;
  percentage: number;
  timestamp: number;
}

export interface BuyCloudRequest extends TradeRequestBase {
  type: 'buy-cloud';
  size: typeof POSITION_SIZES.CLOUD;
  currentPrice: number;
  priceInterval: number;
}

export interface SellCloudRequest extends TradeRequestBase {
  type: 'sell-cloud';
  size: typeof POSITION_SIZES.CLOUD;
  currentPrice: number;
  priceInterval: number;
}

export interface SmLongRequest extends TradeRequestBase {
  type: 'sm-long';
  size: typeof POSITION_SIZES.SM;
  currentPrice: number;
}

export interface SmShortRequest extends TradeRequestBase {
  type: 'sm-short';
  size: typeof POSITION_SIZES.SM;
  currentPrice: number;
}

export interface BigLongRequest extends TradeRequestBase {
  type: 'big-long';
  size: typeof POSITION_SIZES.BIG;
  currentPrice: number;
}

export interface BigShortRequest extends TradeRequestBase {
  type: 'big-short';
  size: typeof POSITION_SIZES.BIG;
  currentPrice: number;
}

export type TradeRequest =
  | BuyCloudRequest
  | SellCloudRequest
  | SmLongRequest
  | SmShortRequest
  | BigLongRequest
  | BigShortRequest;

export interface TradeResponse {
  success: boolean;
  message: string;
  data?: {
    symbol: string;
    type: string;
    size: string;
    timestamp: number;
  };
  error?: string;
}
