import type { Position } from '@/models/Position';
import type { Order } from '@/models/Order';

export interface BridgeAccountState {
  walletAddress: string | null;
  isTestnet: boolean;
  symbol: string | null;
  ready: boolean;
}

export interface BridgePositionView extends Position {}

export interface BridgeOrderView extends Order {}

export interface BridgePriceView {
  coin: string;
  price: number | null;
}

export interface BridgeReadyState {
  installedAt: number;
  storesAvailable: boolean;
}

export interface BridgePlaceOrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  type: 'market' | 'limit';
  price?: number;
  reduceOnly?: boolean;
  tif?: 'Gtc' | 'Ioc' | 'Alo';
}

export interface BridgeCancelOrderParams {
  symbol: string;
  oid: string;
}

export interface BridgeSetSymbolParams {
  symbol: string;
}

export type BridgeMethodName =
  | 'getReadyState'
  | 'getAccountState'
  | 'getPositions'
  | 'getOpenOrders'
  | 'getLastPrice'
  | 'setSymbol'
  | 'placeOrder'
  | 'cancelOrder';

export interface BridgeError {
  code: 'BRIDGE_NOT_READY' | 'STORE_UNAVAILABLE' | 'NOT_AUTHENTICATED' | 'INVALID_ARGS' | 'EXECUTION_FAILED';
  message: string;
}
