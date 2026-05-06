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

