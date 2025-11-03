export interface OrderBookZone {
  price: number;
  volume: number;
  intensity: number;
  side: 'bid' | 'ask';
}

export interface OrderBookZones {
  bids: OrderBookZone[];
  asks: OrderBookZone[];
  timestamp: number;
}
