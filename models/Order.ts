export type OrderType = 'limit' | 'trigger' | 'stop' | 'tp';
export type OrderSide = 'buy' | 'sell';

export interface Order {
  oid: string;
  coin: string;
  side: OrderSide;
  price: number;
  size: number;
  orderType: OrderType;
  timestamp: number;
  isOptimistic?: boolean;
  tempId?: string;
  isPendingCancellation?: boolean;
}
