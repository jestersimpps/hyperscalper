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
    const exchangeType = (typeof window !== 'undefined'
      ? (window as any).__EXCHANGE_TYPE__
      : 'hyperliquid') as WebSocketConfig['type'];

    const isTestnet = typeof window !== 'undefined'
      ? (window as any).__EXCHANGE_TESTNET__ === 'true'
      : false;

    return WebSocketFactory.createService({
      type: exchangeType,
      isTestnet
    });
  }
}
