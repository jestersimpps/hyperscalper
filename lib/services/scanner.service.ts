import type { HyperliquidService } from './hyperliquid.service';
import type { TimeInterval } from '@/types';
import type { StochasticValue, ScanResult } from '@/models/Scanner';
import type { StochasticScannerConfig, StochasticVariantConfig } from '@/models/Settings';
import { calculateStochastic } from '@/lib/indicators';

export interface StochasticScanParams {
  symbol: string;
  timeframes: TimeInterval[];
  config: StochasticScannerConfig;
  variants: Record<'fast9' | 'fast14' | 'fast40' | 'full60', StochasticVariantConfig>;
}

export class ScannerService {
  constructor(private hyperliquidService: HyperliquidService) {}

  private getIntervalMinutes(interval: TimeInterval): number {
    const intervalMap: Record<TimeInterval, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
    };
    return intervalMap[interval];
  }

  async scanStochastic(params: StochasticScanParams): Promise<ScanResult | null> {
    const { symbol, timeframes, config, variants } = params;
    const stochasticValues: StochasticValue[] = [];
    let signalType: 'bullish' | 'bearish' | null = null;

    for (const timeframe of timeframes) {
      try {
        const intervalMinutes = this.getIntervalMinutes(timeframe);
        const lookbackCandles = 150;
        const endTime = Date.now();
        const startTime = endTime - (lookbackCandles * intervalMinutes * 60 * 1000);

        const candles = await this.hyperliquidService.getCandles({
          coin: symbol,
          interval: timeframe,
          startTime,
          endTime,
        });

        if (!candles || candles.length === 0) {
          continue;
        }

        for (const [variantKey, variantConfig] of Object.entries(variants)) {
          if (!variantConfig.enabled) continue;

          const stochData = calculateStochastic(
            candles,
            variantConfig.period,
            variantConfig.smoothK,
            variantConfig.smoothD
          );

          if (stochData.length === 0) continue;

          const latestStoch = stochData[stochData.length - 1];

          if (latestStoch.k < config.oversoldThreshold) {
            stochasticValues.push({
              k: latestStoch.k,
              d: latestStoch.d,
              timeframe,
            });
            signalType = 'bullish';
          } else if (latestStoch.k > config.overboughtThreshold) {
            stochasticValues.push({
              k: latestStoch.k,
              d: latestStoch.d,
              timeframe,
            });
            signalType = 'bearish';
          }
        }
      } catch (error) {
        console.error(`Error scanning ${symbol} on ${timeframe}:`, error);
        continue;
      }
    }

    if (stochasticValues.length === 0 || !signalType) {
      return null;
    }

    const description = signalType === 'bullish'
      ? `Oversold condition detected (K < ${config.oversoldThreshold})`
      : `Overbought condition detected (K > ${config.overboughtThreshold})`;

    return {
      symbol,
      stochastics: stochasticValues,
      matchedAt: Date.now(),
      signalType,
      description,
      scanType: 'stochastic',
    };
  }

  async scanMultipleSymbols(
    symbols: string[],
    params: Omit<StochasticScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    const results = await Promise.allSettled(
      symbols.map(symbol =>
        this.scanStochastic({ ...params, symbol })
      )
    );

    return results
      .filter((result): result is PromiseFulfilledResult<ScanResult | null> =>
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value as ScanResult);
  }
}
