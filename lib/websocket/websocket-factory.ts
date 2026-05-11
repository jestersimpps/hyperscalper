import type { ExchangeWebSocketService, WebSocketConfig } from './exchange-websocket.interface';
import { HyperliquidWebSocketService } from './hyperliquid-websocket.service';

export class WebSocketFactory {
  static createService(config: WebSocketConfig): ExchangeWebSocketService {
    switch (config.type) {
      case 'hyperliquid':
        return new HyperliquidWebSocketService(config.isTestnet || false);

      case 'binance':
        throw new Error('Binance WebSocket service not yet implemented');

      case 'bybit':
        throw new Error('Bybit WebSocket service not yet implemented');

      default:
        throw new Error(`Unsupported exchange type: ${config.type}`);
    }
  }

  static createFromEnv(): ExchangeWebSocketService {
    const w = typeof window !== 'undefined'
      ? (window as Window & { __EXCHANGE_TYPE__?: WebSocketConfig['type']; __EXCHANGE_TESTNET__?: string })
      : undefined;
    const exchangeType = (w?.__EXCHANGE_TYPE__ ?? 'hyperliquid') as WebSocketConfig['type'];
    const isTestnet = w?.__EXCHANGE_TESTNET__ === 'true';

    return WebSocketFactory.createService({
      type: exchangeType,
      isTestnet
    });
  }
}
