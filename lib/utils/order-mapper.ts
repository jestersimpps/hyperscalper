import { Order, OrderType, OrderSide } from '@/models/Order';

export function mapHyperliquidOrder(order: any): Order {
  const side = order.side?.toUpperCase() === 'A' ? 'sell' : 'buy';
  const size = Math.abs(parseFloat(order.origSz || order.sz || '0'));

  let orderType: OrderType = 'limit';
  let price = 0;

  if (order.isTrigger && order.triggerPx) {
    price = parseFloat(order.triggerPx);

    if (order.isPositionTpsl) {
      const ot = order.orderType?.toLowerCase() || '';
      if (ot.includes('stop market') || (order.reduceOnly && !side)) {
        orderType = 'stop';
      } else {
        orderType = 'tp';
      }
    } else if (order.orderType) {
      const ot = order.orderType.toLowerCase();
      if (ot.includes('stop')) {
        orderType = 'stop';
      } else {
        orderType = 'trigger';
      }
    } else {
      orderType = 'trigger';
    }
  } else {
    price = parseFloat(order.limitPx || '0');
    orderType = 'limit';
  }

  return {
    oid: order.oid.toString(),
    coin: order.coin,
    side: side as OrderSide,
    price,
    size,
    orderType,
    timestamp: order.timestamp || Date.now(),
  };
}

export function mapHyperliquidOrders(orders: any[]): Order[] {
  return orders.map(mapHyperliquidOrder);
}
