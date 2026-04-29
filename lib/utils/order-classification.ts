import type { Order } from '@/models/Order';
import type { Position } from '@/models/Position';

export const isEntryOrder = (order: Order): boolean =>
  order.orderType === 'limit' || order.orderType === 'trigger';

export const isExitOrder = (order: Order): boolean =>
  order.orderType === 'stop' || order.orderType === 'tp';

export const isTpFor = (order: Order, position: Position): boolean => {
  if (position.side === 'long') {
    return order.side === 'sell' && order.price > position.entryPrice;
  }
  return order.side === 'buy' && order.price < position.entryPrice;
};

export const isSlFor = (order: Order, position: Position): boolean => {
  if (position.side === 'long') {
    return order.side === 'sell' && order.price < position.entryPrice;
  }
  return order.side === 'buy' && order.price > position.entryPrice;
};

interface RawHyperliquidOrder {
  isPositionTpsl?: boolean;
  isTrigger?: boolean;
  reduceOnly?: boolean;
  orderType?: string;
}

export const isRawEntryOrder = (order: RawHyperliquidOrder): boolean => {
  if (order.isPositionTpsl) return false;

  const ot = order.orderType?.toLowerCase() || '';
  if (ot.includes('stop')) return false;
  if (ot.includes('tp')) return false;

  if (order.isTrigger && order.reduceOnly && ot.includes('market')) return false;

  return true;
};

export const isRawExitOrder = (order: RawHyperliquidOrder): boolean => {
  if (order.isPositionTpsl) return true;

  const ot = order.orderType?.toLowerCase() || '';
  if (ot.includes('stop')) return true;
  if (ot.includes('tp')) return true;

  if (order.isTrigger && order.reduceOnly && ot.includes('market')) return true;

  return false;
};
