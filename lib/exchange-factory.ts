import type { ExchangeProvider, ExchangeConfig } from './exchange-provider.interface';
import { HyperliquidProvider } from './hyperliquid-provider';

export class ExchangeFactory {
  static createProvider(config: ExchangeConfig): ExchangeProvider {
    switch (config.type) {
      case 'hyperliquid':
        return new HyperliquidProvider(config.isTestnet || false);

      case 'binance':
        throw new Error('Binance provider not yet implemented');

      case 'bybit':
        throw new Error('Bybit provider not yet implemented');

      default:
        throw new Error(`Unsupported exchange type: ${config.type}`);
    }
  }

  static createFromEnv(): ExchangeProvider {
    const exchangeType = (process.env.EXCHANGE_TYPE || 'hyperliquid') as ExchangeConfig['type'];
    const isTestnet = process.env.HYPERLIQUID_TESTNET === 'true' || process.env.EXCHANGE_TESTNET === 'true';

    return ExchangeFactory.createProvider({
      type: exchangeType,
      isTestnet
    });
  }
}
