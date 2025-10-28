export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExchangeProvider {
  getCandles(params: {
    coin: string;
    interval: string;
    startTime?: number;
    endTime?: number;
  }): Promise<CandleData[]>;

  subscribeToCandlesStream(params: {
    coin: string;
    interval: string;
  }, callback: (candle: CandleData) => void): () => void;
}

export interface ExchangeConfig {
  type: 'hyperliquid' | 'binance' | 'bybit';
  isTestnet?: boolean;
}
