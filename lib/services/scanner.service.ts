import type { HyperliquidService } from './hyperliquid.service';
import type { TimeInterval } from '@/types';
import type {
  StochasticValue,
  ScanResult,
  VolumeValue,
  EmaAlignmentValue,
  MacdReversalValue,
  RsiReversalValue,
  ChannelValue,
  DivergenceValue
} from '@/models/Scanner';
import type {
  StochasticScannerConfig,
  StochasticVariantConfig,
  VolumeSpikeConfig,
  EmaAlignmentScannerConfig,
  MacdReversalScannerConfig,
  RsiReversalScannerConfig,
  ChannelScannerConfig,
  DivergenceScannerConfig
} from '@/models/Settings';
import type { TransformedCandle } from './types';
import {
  calculateStochastic,
  detectEmaAlignment,
  calculateMACD,
  calculateRSI,
  detectChannels,
  detectPivots,
  detectStochasticPivots,
  detectDivergence
} from '@/lib/indicators';
import { aggregate1mTo5m } from '@/lib/candle-aggregator';
import { downsampleCandles } from '@/lib/candle-utils';
import { useCandleStore } from '@/stores/useCandleStore';

export interface StochasticScanParams {
  symbol: string;
  timeframes: TimeInterval[];
  config: StochasticScannerConfig;
  variants: Record<'ultraFast' | 'fast' | 'medium' | 'slow', StochasticVariantConfig>;
}

export interface VolumeScanParams {
  symbol: string;
  timeframes: TimeInterval[];
  config: VolumeSpikeConfig;
}

export interface EmaAlignmentScanParams {
  symbol: string;
  timeframes: TimeInterval[];
  config: EmaAlignmentScannerConfig;
}

export interface MacdReversalScanParams {
  symbol: string;
  timeframes: TimeInterval[];
  config: MacdReversalScannerConfig;
}

export interface RsiReversalScanParams {
  symbol: string;
  timeframes: TimeInterval[];
  config: RsiReversalScannerConfig;
}

export interface ChannelScanParams {
  symbol: string;
  timeframes: TimeInterval[];
  config: ChannelScannerConfig;
}

export interface DivergenceScanParams {
  symbol: string;
  timeframes: TimeInterval[];
  config: DivergenceScannerConfig;
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

  private getCandlesFromStore(
    symbol: string,
    targetTimeframe: TimeInterval,
    lookbackCandles: number
  ): TransformedCandle[] | null {
    const candleStore = useCandleStore.getState();

    if (targetTimeframe === '1m') {
      const candles = candleStore.getCandlesSync(symbol, '1m');
      if (!candles || candles.length < lookbackCandles) {
        return null;
      }
      return candles.slice(-lookbackCandles);
    } else if (targetTimeframe === '5m') {
      const baseCandleCount = lookbackCandles * 5;
      const candles1m = candleStore.getCandlesSync(symbol, '1m');
      if (!candles1m || candles1m.length < baseCandleCount) {
        return null;
      }
      const recentCandles = candles1m.slice(-baseCandleCount);
      return aggregate1mTo5m(recentCandles);
    }

    return null;
  }

  async scanStochastic(params: StochasticScanParams): Promise<ScanResult | null> {
    const { symbol, timeframes, config, variants } = params;

    const enabledVariants = Object.entries(variants).filter(([_, variantConfig]) => variantConfig.enabled);
    const enabledVariantCount = enabledVariants.length;

    if (enabledVariantCount === 0) {
      return null;
    }

    const candleStore = useCandleStore.getState();
    const closePrices = candleStore.getClosePrices(symbol, '1m', 100) || [];

    for (const timeframe of timeframes) {
      try {
        const lookbackCandles = 150;

        const candles = this.getCandlesFromStore(symbol, timeframe, lookbackCandles);

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
              closePrices,
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

  async scanVolumeSpike(params: VolumeScanParams): Promise<ScanResult | null> {
    const { symbol, timeframes, config } = params;

    const candleStore = useCandleStore.getState();
    const closePrices = candleStore.getClosePrices(symbol, '1m', 100) || [];

    for (const timeframe of timeframes) {
      try {
        const lookbackCandles = 150;

        const candles = this.getCandlesFromStore(symbol, timeframe, lookbackCandles);

        if (!candles || candles.length < config.lookbackPeriod + 1) {
          continue;
        }

        const currentCandle = candles[candles.length - 1];
        const volumeCandles = candles.slice(-(config.lookbackPeriod + 1), -1);
        const avgVolume = volumeCandles.reduce((sum, c) => sum + c.volume, 0) / volumeCandles.length;

        const volumeRatio = currentCandle.volume / avgVolume;
        const isVolumeSpike = volumeRatio >= config.volumeThreshold;

        const priceChangePercent = ((currentCandle.close - currentCandle.open) / currentCandle.open) * 100;
        const isPriceMove = Math.abs(priceChangePercent) >= config.priceChangeThreshold;

        if (isVolumeSpike && isPriceMove) {
          const signalType: 'bullish' | 'bearish' = priceChangePercent > 0 ? 'bullish' : 'bearish';
          const direction = signalType === 'bullish' ? 'increase' : 'decrease';

          const volumeValue: VolumeValue = {
            timeframe,
            volumeRatio,
            priceChangePercent,
            avgVolume,
            currentVolume: currentCandle.volume,
          };

          return {
            symbol,
            volumeSpikes: [volumeValue],
            matchedAt: Date.now(),
            signalType,
            description: `Volume spike (${volumeRatio.toFixed(1)}x) with ${Math.abs(priceChangePercent).toFixed(2)}% price ${direction} on ${timeframe}`,
            scanType: 'volumeSpike',
            closePrices,
          };
        }
      } catch (error) {
        console.error(`Error scanning volume for ${symbol} on ${timeframe}:`, error);
        continue;
      }
    }

    return null;
  }

  async scanEmaAlignment(params: EmaAlignmentScanParams): Promise<ScanResult | null> {
    const { symbol, timeframes, config } = params;

    const candleStore = useCandleStore.getState();
    const closePrices = candleStore.getClosePrices(symbol, '1m', 100) || [];

    for (const timeframe of timeframes) {
      try {
        const lookbackCandles = 150;

        const candles = this.getCandlesFromStore(symbol, timeframe, lookbackCandles);

        if (!candles || candles.length < config.lookbackBars) {
          continue;
        }

        const emaAlignment = detectEmaAlignment(
          candles as any,
          config.ema1Period,
          config.ema2Period,
          config.ema3Period,
          config.lookbackBars
        );

        if (emaAlignment) {
          const emaValue: EmaAlignmentValue = {
            timeframe,
            alignmentType: emaAlignment.type,
            barsAgo: emaAlignment.barsAgo,
            ema1: emaAlignment.ema1,
            ema2: emaAlignment.ema2,
            ema3: emaAlignment.ema3,
          };

          const description = emaAlignment.barsAgo === 0
            ? `EMA alignment just formed on ${timeframe} (${emaAlignment.type})`
            : `EMA ${emaAlignment.type} alignment ${emaAlignment.barsAgo} bars ago on ${timeframe}`;

          return {
            symbol,
            emaAlignments: [emaValue],
            matchedAt: Date.now(),
            signalType: emaAlignment.type,
            description,
            scanType: 'emaAlignment',
            closePrices,
          };
        }
      } catch (error) {
        console.error(`Error scanning EMA alignment for ${symbol} on ${timeframe}:`, error);
        continue;
      }
    }

    return null;
  }

  async scanMacdReversal(params: MacdReversalScanParams): Promise<ScanResult | null> {
    const { symbol, timeframes, config } = params;

    const candleStore = useCandleStore.getState();
    const closePrices = candleStore.getClosePrices(symbol, '1m', 100) || [];

    for (const timeframe of timeframes) {
      try {
        const lookbackCandles = Math.max(150, config.minCandles);

        const candles = this.getCandlesFromStore(symbol, timeframe, lookbackCandles);

        if (!candles || candles.length < config.minCandles) {
          continue;
        }

        const closes = candles.map(c => c.close);
        const macdResult = calculateMACD(closes, config.fastPeriod, config.slowPeriod, config.signalPeriod);

        if (macdResult.histogram.length < config.recentReversalLookback + 1) {
          continue;
        }

        const recentHistogram = macdResult.histogram.slice(-config.recentReversalLookback);
        let foundReversal = false;
        let signalType: 'bullish' | 'bearish' | null = null;

        for (let i = 1; i < recentHistogram.length; i++) {
          const prev = recentHistogram[i - 1];
          const curr = recentHistogram[i];
          const prevMacd = macdResult.macd[macdResult.macd.length - config.recentReversalLookback + i - 1];
          const currMacd = macdResult.macd[macdResult.macd.length - config.recentReversalLookback + i];
          const prevSignal = macdResult.signal[macdResult.signal.length - config.recentReversalLookback + i - 1];
          const currSignal = macdResult.signal[macdResult.signal.length - config.recentReversalLookback + i];

          if (prevMacd <= prevSignal && currMacd > currSignal) {
            foundReversal = true;
            signalType = 'bullish';
            break;
          }

          if (prevMacd >= prevSignal && currMacd < currSignal) {
            foundReversal = true;
            signalType = 'bearish';
            break;
          }
        }

        if (foundReversal && signalType) {
          const lastIndex = macdResult.histogram.length - 1;
          const lastCandle = candles[candles.length - 1];
          const macdValue: MacdReversalValue = {
            timeframe,
            direction: signalType,
            time: lastCandle.time,
            price: lastCandle.close,
            macdValue: macdResult.macd[lastIndex],
            signalValue: macdResult.signal[lastIndex],
          };

          const description = `MACD ${signalType} crossover on ${timeframe}`;

          return {
            symbol,
            macdReversals: [macdValue],
            matchedAt: Date.now(),
            signalType,
            description,
            scanType: 'macdReversal',
            closePrices,
          };
        }
      } catch (error) {
        console.error(`Error scanning MACD reversal for ${symbol} on ${timeframe}:`, error);
        continue;
      }
    }

    return null;
  }

  async scanRsiReversal(params: RsiReversalScanParams): Promise<ScanResult | null> {
    const { symbol, timeframes, config } = params;

    const candleStore = useCandleStore.getState();
    const closePrices = candleStore.getClosePrices(symbol, '1m', 100) || [];

    for (const timeframe of timeframes) {
      try {
        const lookbackCandles = Math.max(150, config.minCandles);

        const candles = this.getCandlesFromStore(symbol, timeframe, lookbackCandles);

        if (!candles || candles.length < config.minCandles) {
          continue;
        }

        const closes = candles.map(c => c.close);
        const rsi = calculateRSI(closes, config.period);

        if (rsi.length < config.recentReversalLookback + 1) {
          continue;
        }

        const recentRsi = rsi.slice(-config.recentReversalLookback);
        let foundReversal = false;
        let signalType: 'bullish' | 'bearish' | null = null;

        for (let i = 1; i < recentRsi.length; i++) {
          const prev = recentRsi[i - 1];
          const curr = recentRsi[i];

          if (prev <= config.oversoldLevel && curr > config.oversoldLevel) {
            foundReversal = true;
            signalType = 'bullish';
            break;
          }

          if (prev >= config.overboughtLevel && curr < config.overboughtLevel) {
            foundReversal = true;
            signalType = 'bearish';
            break;
          }
        }

        if (foundReversal && signalType) {
          const lastCandle = candles[candles.length - 1];
          const zone = signalType === 'bullish' ? 'oversold' : 'overbought';
          const rsiValue: RsiReversalValue = {
            timeframe,
            direction: signalType,
            time: lastCandle.time,
            price: lastCandle.close,
            rsiValue: rsi[rsi.length - 1],
            zone,
          };

          const zoneText = signalType === 'bullish' ? 'oversold' : 'overbought';
          const description = `RSI ${zoneText} reversal on ${timeframe} (${rsi[rsi.length - 1].toFixed(1)})`;

          return {
            symbol,
            rsiReversals: [rsiValue],
            matchedAt: Date.now(),
            signalType,
            description,
            scanType: 'rsiReversal',
            closePrices,
          };
        }
      } catch (error) {
        console.error(`Error scanning RSI reversal for ${symbol} on ${timeframe}:`, error);
        continue;
      }
    }

    return null;
  }

  async scanChannel(params: ChannelScanParams): Promise<ScanResult | null> {
    const { symbol, timeframes, config } = params;

    const candleStore = useCandleStore.getState();
    const closePrices = candleStore.getClosePrices(symbol, '1m', 100) || [];

    for (const timeframe of timeframes) {
      try {
        const lookbackCandles = config.lookbackBars;

        const candles = this.getCandlesFromStore(symbol, timeframe, lookbackCandles);

        if (!candles || candles.length < config.lookbackBars) {
          continue;
        }

        const channels = detectChannels(candles as any, {
          pivotStrength: config.pivotStrength,
          lookbackBars: config.lookbackBars,
          minTouches: config.minTouches,
        });

        if (channels.length > 0) {
          const bestChannel = channels[0];
          const currentPrice = candles[candles.length - 1].close;
          const lastIndex = candles.length - 1;
          const upperPrice = bestChannel.upperLine.slope * lastIndex + bestChannel.upperLine.intercept;
          const lowerPrice = bestChannel.lowerLine.slope * lastIndex + bestChannel.lowerLine.intercept;

          const distanceToUpper = ((upperPrice - currentPrice) / currentPrice) * 100;
          const distanceToLower = ((currentPrice - lowerPrice) / currentPrice) * 100;

          let signalType: 'bullish' | 'bearish';
          if (Math.abs(distanceToLower) < Math.abs(distanceToUpper)) {
            signalType = 'bullish';
          } else {
            signalType = 'bearish';
          }

          const channelValue: ChannelValue = {
            timeframe,
            type: bestChannel.type,
            touches: bestChannel.touches,
            strength: bestChannel.strength,
            angle: bestChannel.angle,
            upperPrice,
            lowerPrice,
            currentPrice,
            distanceToUpper,
            distanceToLower,
          };

          const channelTypeStr = bestChannel.type === 'horizontal' ? 'Horizontal' :
                                 bestChannel.type === 'ascending' ? 'Ascending' : 'Descending';
          const description = `${channelTypeStr} channel detected on ${timeframe} (${bestChannel.touches} touches)`;

          return {
            symbol,
            channels: [channelValue],
            matchedAt: Date.now(),
            signalType,
            description,
            scanType: 'channel',
            closePrices,
          };
        }
      } catch (error) {
        console.error(`Error scanning channel for ${symbol} on ${timeframe}:`, error);
        continue;
      }
    }

    return null;
  }

  async scanDivergence(params: DivergenceScanParams): Promise<ScanResult | null> {
    const { symbol, timeframes, config } = params;

    const candleStore = useCandleStore.getState();
    const closePrices = candleStore.getClosePrices(symbol, '1m', 100) || [];

    for (const timeframe of timeframes) {
      try {
        const lookbackCandles = 150;

        const candles = this.getCandlesFromStore(symbol, timeframe, lookbackCandles);

        if (!candles || candles.length < 50) {
          continue;
        }

        const pricePivots = detectPivots(candles as any, config.pivotStrength);
        const stochData = calculateStochastic(candles as any, 14, 3, 3);
        const stochPivots = detectStochasticPivots(stochData, candles as any, config.pivotStrength);

        const divergences = detectDivergence(pricePivots, stochPivots, candles as any);

        if (divergences.length > 0) {
          const recentDivergence = divergences[divergences.length - 1];

          const shouldReport =
            (config.scanBullish && recentDivergence.type === 'bullish') ||
            (config.scanBearish && recentDivergence.type === 'bearish') ||
            (config.scanHidden && (recentDivergence.type === 'hidden-bullish' || recentDivergence.type === 'hidden-bearish'));

          if (shouldReport) {
            const signalType: 'bullish' | 'bearish' =
              recentDivergence.type === 'bullish' || recentDivergence.type === 'hidden-bullish' ? 'bullish' : 'bearish';

            const divergenceValue: DivergenceValue = {
              type: recentDivergence.type,
              startTime: recentDivergence.startTime,
              endTime: recentDivergence.endTime,
              startPriceValue: recentDivergence.startPriceValue,
              endPriceValue: recentDivergence.endPriceValue,
              startStochValue: recentDivergence.startStochValue,
              endStochValue: recentDivergence.endStochValue,
              variant: 'medium',
            };

            const typeStr = recentDivergence.type.replace('-', ' ');
            const description = `${typeStr} divergence detected on ${timeframe}`;

            return {
              symbol,
              divergences: [divergenceValue],
              matchedAt: Date.now(),
              signalType,
              description,
              scanType: 'divergence',
              closePrices,
            };
          }
        }
      } catch (error) {
        console.error(`Error scanning divergence for ${symbol} on ${timeframe}:`, error);
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

  async scanMultipleSymbolsForVolume(
    symbols: string[],
    params: Omit<VolumeScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    const results = await Promise.allSettled(
      symbols.map(symbol =>
        this.scanVolumeSpike({ ...params, symbol })
      )
    );

    return results
      .filter((result): result is PromiseFulfilledResult<ScanResult | null> =>
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value as ScanResult);
  }

  async scanMultipleSymbolsForEmaAlignment(
    symbols: string[],
    params: Omit<EmaAlignmentScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    const results = await Promise.allSettled(
      symbols.map(symbol =>
        this.scanEmaAlignment({ ...params, symbol })
      )
    );

    return results
      .filter((result): result is PromiseFulfilledResult<ScanResult | null> =>
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value as ScanResult);
  }

  async scanMultipleSymbolsForMacdReversal(
    symbols: string[],
    params: Omit<MacdReversalScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    const results = await Promise.allSettled(
      symbols.map(symbol =>
        this.scanMacdReversal({ ...params, symbol })
      )
    );

    return results
      .filter((result): result is PromiseFulfilledResult<ScanResult | null> =>
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value as ScanResult);
  }

  async scanMultipleSymbolsForRsiReversal(
    symbols: string[],
    params: Omit<RsiReversalScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    const results = await Promise.allSettled(
      symbols.map(symbol =>
        this.scanRsiReversal({ ...params, symbol })
      )
    );

    return results
      .filter((result): result is PromiseFulfilledResult<ScanResult | null> =>
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value as ScanResult);
  }

  async scanMultipleSymbolsForChannel(
    symbols: string[],
    params: Omit<ChannelScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    const results = await Promise.allSettled(
      symbols.map(symbol =>
        this.scanChannel({ ...params, symbol })
      )
    );

    return results
      .filter((result): result is PromiseFulfilledResult<ScanResult | null> =>
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value as ScanResult);
  }

  async scanMultipleSymbolsForDivergence(
    symbols: string[],
    params: Omit<DivergenceScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    const results = await Promise.allSettled(
      symbols.map(symbol =>
        this.scanDivergence({ ...params, symbol })
      )
    );

    return results
      .filter((result): result is PromiseFulfilledResult<ScanResult | null> =>
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value as ScanResult);
  }
}
