import type { HyperliquidService } from './hyperliquid.service';
import type { TimeInterval } from '@/types';
import type { StochasticValue, ScanResult } from '@/models/Scanner';
import type { StochasticScannerConfig, StochasticVariantConfig } from '@/models/Settings';
import { calculateStochastic } from '@/lib/indicators';

export interface StochasticScanParams {
  symbol: string;
  timeframes: TimeInterval[];
  config: StochasticScannerConfig;
  variants: Record<'ultraFast' | 'fast' | 'medium' | 'slow', StochasticVariantConfig>;
}

export class ScannerService {
  constructor(private hyperliquidService: HyperliquidService) {}

  private getIntervalMinutes(interval: TimeInterval): number {
    const intervalMap: Record<TimeInterval, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60,
    };
    return intervalMap[interval];
  }

  async scanStochastic(params: StochasticScanParams): Promise<ScanResult | null> {
    const { symbol, timeframes, config, variants } = params;

    const enabledVariants = Object.entries(variants).filter(([_, variantConfig]) => variantConfig.enabled);
    const enabledVariantCount = enabledVariants.length;

    if (enabledVariantCount === 0) {
      return null;
    }

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

        const timeframeResults: { k: number; d: number; signalType: 'bullish' | 'bearish' }[] = [];

        for (const [variantKey, variantConfig] of enabledVariants) {
          const stochData = calculateStochastic(
            candles,
            variantConfig.period,
            variantConfig.smoothK,
            variantConfig.smoothD
          );

          if (stochData.length === 0) break;

          const latestStoch = stochData[stochData.length - 1];

          if (latestStoch.k < config.oversoldThreshold) {
            timeframeResults.push({
              k: latestStoch.k,
              d: latestStoch.d,
              signalType: 'bullish',
            });
          } else if (latestStoch.k > config.overboughtThreshold) {
            timeframeResults.push({
              k: latestStoch.k,
              d: latestStoch.d,
              signalType: 'bearish',
            });
          }
        }

        if (timeframeResults.length === enabledVariantCount) {
          const signalType = timeframeResults[0].signalType;
          const allSameSignal = timeframeResults.every(r => r.signalType === signalType);

          if (allSameSignal) {
            const description = signalType === 'bullish'
              ? `All stochastic variants oversold on ${timeframe} (K < ${config.oversoldThreshold})`
              : `All stochastic variants overbought on ${timeframe} (K > ${config.overboughtThreshold})`;

            return {
              symbol,
              stochastics: timeframeResults.map(r => ({ k: r.k, d: r.d, timeframe })),
              matchedAt: Date.now(),
              signalType,
              description,
              scanType: 'stochastic',
            };
          }
        }
      } catch (error) {
        console.error(`Error scanning ${symbol} on ${timeframe}:`, error);
        continue;
      }
    }

    return null;
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
