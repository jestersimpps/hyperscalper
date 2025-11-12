import { Order } from '@/models/Order';

export const getOrderTypeAbbreviation = (orderType: Order['orderType']): string => {
  switch (orderType) {
    case 'limit':
      return 'L';
    case 'trigger':
      return 'T';
    case 'stop':
      return 'SL';
    case 'tp':
      return 'TP';
    default:
      return 'L';
  }
};

export const getOrderTypeLabel = (orderType: Order['orderType']): string => {
  switch (orderType) {
    case 'limit':
      return 'LIMIT';
    case 'trigger':
      return 'TRIGGER';
    case 'stop':
      return 'STOP';
    case 'tp':
      return 'TP';
    default:
      return 'LIMIT';
  }
};

export const sortOrdersByPrice = (orders: Order[], descending: boolean = true): Order[] => {
  return [...orders].sort((a, b) => descending ? b.price - a.price : a.price - b.price);
};

export interface GroupedOrders {
  symbol: string;
  orders: Order[];
}

export const groupOrdersBySymbol = (orders: Order[]): GroupedOrders[] => {
  const grouped = orders.reduce<Record<string, Order[]>>((acc, order) => {
    if (!acc[order.coin]) {
      acc[order.coin] = [];
    }
    acc[order.coin].push(order);
    return acc;
  }, {});

  return Object.entries(grouped).map(([symbol, orders]) => ({
    symbol,
    orders: sortOrdersByPrice(orders),
  }));
};

export const getAllOrdersAcrossSymbols = (
  ordersState: Record<string, Order[]>,
  optimisticOrdersState: Record<string, Order[]>
): Order[] => {
  const allOrders: Order[] = [];

  const allSymbols = new Set([
    ...Object.keys(ordersState),
    ...Object.keys(optimisticOrdersState),
  ]);

  allSymbols.forEach((symbol) => {
    const confirmed = ordersState[symbol] || [];
    const optimistic = optimisticOrdersState[symbol] || [];
    allOrders.push(...confirmed, ...optimistic);
  });

  return allOrders;
};
