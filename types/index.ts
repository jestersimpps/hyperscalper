export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openFormatted: string;
  highFormatted: string;
  lowFormatted: string;
  closeFormatted: string;
  volumeFormatted: string;
}

export interface MarketStats {
  currentPrice: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  currentPriceFormatted: string;
  high24hFormatted: string;
  low24hFormatted: string;
}

export interface Trade {
  time: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  priceFormatted: string;
  sizeFormatted: string;
}

export type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
