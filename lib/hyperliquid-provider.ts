import type { ExchangeProvider, CandleData } from './exchange-provider.interface';
import type { Candle } from '@nktkas/hyperliquid';

export class HyperliquidProvider implements ExchangeProvider {
  private baseUrl: string;
  private wsUrl: string;

  constructor(isTestnet: boolean = false) {
    this.baseUrl = isTestnet
      ? 'https://api.hyperliquid-testnet.xyz/info'
      : 'https://api.hyperliquid.xyz/info';

    this.wsUrl = isTestnet
      ? 'wss://api.hyperliquid-testnet.xyz/ws'
      : 'wss://api.hyperliquid.xyz/ws';
  }

  async getCandles(params: {
    coin: string;
    interval: string;
    startTime?: number;
    endTime?: number;
  }): Promise<CandleData[]> {
    const payload: any = {
      type: 'candleSnapshot',
      req: {
        coin: params.coin,
        interval: params.interval
      }
    };

    if (params.startTime) payload.req.startTime = params.startTime;
    if (params.endTime) payload.req.endTime = params.endTime;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.statusText} - ${errorText}`);
    }

    const candles = await response.json() as Candle[];

    if (!Array.isArray(candles)) {
      throw new Error(`Invalid response format for ${params.coin}: expected array, got ${typeof candles}`);
    }

    return candles.map((candle) => ({
      time: candle.t,
      open: parseFloat(candle.o),
      high: parseFloat(candle.h),
      low: parseFloat(candle.l),
      close: parseFloat(candle.c),
      volume: parseFloat(candle.v || '0'),
      openFormatted: candle.o,
      highFormatted: candle.h,
      lowFormatted: candle.l,
      closeFormatted: candle.c,
      volumeFormatted: candle.v || '0',
    }));
  }

  subscribeToCandlesStream(params: {
    coin: string;
    interval: string;
  }, callback: (candle: CandleData) => void): () => void {
    throw new Error('WebSocket streams should be handled at the API route level');
  }
}
