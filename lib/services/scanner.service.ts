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
  DivergenceValue,
  SupportResistanceValue,
  AscendingTriangleValue,
  AscendingTriangleComponents,
  CupAndHandleValue,
  CupAndHandleComponents
} from '@/models/Scanner';
import type {
  StochasticScannerConfig,
  StochasticVariantConfig,
  VolumeSpikeConfig,
  EmaAlignmentScannerConfig,
  MacdReversalScannerConfig,
  RsiReversalScannerConfig,
  ChannelScannerConfig,
  DivergenceScannerConfig,
  SupportResistanceScannerConfig,
  AscendingTriangleScannerConfig,
  CupAndHandleScannerConfig
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
  detectRSIPivots,
  detectDivergence,
  calculateTrendlines,
  calculateATR,
  calculateEMA,
  linearRegression,
  type DivergenceOptions
} from '@/lib/indicators';
import { aggregate1mTo5m } from '@/lib/candle-aggregator';
import { downsampleCandles } from '@/lib/candle-utils';
import { useCandleStore } from '@/stores/useCandleStore';
import { yieldToMain } from '@/lib/performance-utils';

const YIELD_EVERY = 4;

async function scanWithYield<T, R>(
  items: T[],
  fn: (item: T) => Promise<R | null>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i++) {
    const result = await fn(items[i]);
    if (result !== null) {
      results.push(result);
    }
    if ((i + 1) % YIELD_EVERY === 0 && i < items.length - 1) {
      await yieldToMain();
    }
  }
  return results;
}

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

export interface SupportResistanceScanParams {
  symbol: string;
  timeframes: TimeInterval[];
  config: SupportResistanceScannerConfig;
}

export interface AscendingTriangleScanParams {
  symbol: string;
  timeframes: TimeInterval[];
  config: AscendingTriangleScannerConfig;
}

export interface CupAndHandleScanParams {
  symbol: string;
  timeframes: TimeInterval[];
  config: CupAndHandleScannerConfig;
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

        const closePricesForRsi = candles.map(c => c.close);
        const rsiData = calculateRSI(closePricesForRsi, 14);
        const rsiPivots = detectRSIPivots(rsiData, candles as any, config.pivotStrength);

        let divergenceOptions: DivergenceOptions | undefined = undefined;

        if (config.useDynamicThresholds) {
          const atrPeriod = config.atrPeriod || 14;
          const atrValues = calculateATR(candles as any, atrPeriod);

          divergenceOptions = {
            minPriceChangeATR: config.minPriceChangeATR,
            minRsiChange: config.minRsiChange,
            atrValues,
            rsiValues: rsiData,
          };
        }

        const divergences = detectDivergence(pricePivots, rsiPivots, candles as any, divergenceOptions);

        if (divergences.length > 0) {
          const recentDivergence = divergences[divergences.length - 1];

          const shouldReport =
            (config.scanBullish && recentDivergence.type === 'bullish') ||
            (config.scanBearish && recentDivergence.type === 'bearish') ||
            (config.scanHidden && (recentDivergence.type === 'hidden-bullish' || recentDivergence.type === 'hidden-bearish'));

          if (shouldReport) {
            const minStrength = (config as any).minStrength ?? 30;
            const strength = recentDivergence.strength ?? 0;

            if (strength < minStrength) {
              continue;
            }

            const isBullish = recentDivergence.type === 'bullish' || recentDivergence.type === 'hidden-bullish';
            const endRsi = recentDivergence.endRsiValue;

            if (isBullish && recentDivergence.type === 'bullish' && endRsi >= 40) {
              continue;
            }
            if (!isBullish && recentDivergence.type === 'bearish' && endRsi <= 60) {
              continue;
            }

            const signalType: 'bullish' | 'bearish' = isBullish ? 'bullish' : 'bearish';

            const divergenceValue: DivergenceValue = {
              type: recentDivergence.type,
              startTime: recentDivergence.startTime,
              endTime: recentDivergence.endTime,
              startPriceValue: recentDivergence.startPriceValue,
              endPriceValue: recentDivergence.endPriceValue,
              startRsiValue: recentDivergence.startRsiValue,
              endRsiValue: recentDivergence.endRsiValue,
              strength: recentDivergence.strength,
            };

            const typeStr = recentDivergence.type.replace('-', ' ');
            const description = `${typeStr} divergence (strength: ${strength}) detected on ${timeframe}`;

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

  async scanSupportResistance(params: SupportResistanceScanParams): Promise<ScanResult | null> {
    const { symbol, timeframes, config } = params;

    const candleStore = useCandleStore.getState();
    const closePrices = candleStore.getClosePrices(symbol, '1m', 100) || [];

    for (const timeframe of timeframes) {
      try {
        const lookbackCandles = 150;

        const candles = this.getCandlesFromStore(symbol, timeframe, lookbackCandles);

        if (!candles || candles.length < 30) {
          continue;
        }

        const trendlines = calculateTrendlines(candles as any);

        if (trendlines.supportLine.length === 0 && trendlines.resistanceLine.length === 0) {
          continue;
        }

        const currentPrice = candles[candles.length - 1].close;
        const currentTime = candles[candles.length - 1].time;

        let supportLevel: number | null = null;
        let resistanceLevel: number | null = null;
        let supportTouches = 0;
        let resistanceTouches = 0;

        if (trendlines.supportLine.length > 0) {
          const supportPoints = trendlines.supportLine[0].points;
          if (supportPoints.length >= 2) {
            // Use first two points to calculate slope (it's a linear trendline)
            const p1 = supportPoints[0];
            const p2 = supportPoints[1];

            if (p2.time !== p1.time) {
              const slope = (p2.value - p1.value) / (p2.time - p1.time);
              supportLevel = p1.value + slope * (currentTime - p1.time);
            } else {
              supportLevel = p1.value;
            }

            supportTouches = supportPoints.length;
          }
        }

        if (trendlines.resistanceLine.length > 0) {
          const resistancePoints = trendlines.resistanceLine[0].points;
          if (resistancePoints.length >= 2) {
            // Use first two points to calculate slope (it's a linear trendline)
            const p1 = resistancePoints[0];
            const p2 = resistancePoints[1];

            if (p2.time !== p1.time) {
              const slope = (p2.value - p1.value) / (p2.time - p1.time);
              resistanceLevel = p1.value + slope * (currentTime - p1.time);
            } else {
              resistanceLevel = p1.value;
            }

            resistanceTouches = resistancePoints.length;
          }
        }

        if (supportLevel === null && resistanceLevel === null) {
          continue;
        }

        if (supportTouches < config.minTouches && resistanceTouches < config.minTouches) {
          continue;
        }

        // Check if S/R line crosses last 3 candles
        const last3Candles = candles.slice(-3);
        let supportCrossesRecent = false;
        let resistanceCrossesRecent = false;

        if (supportLevel !== null && trendlines.supportLine.length > 0) {
          const supportPoints = trendlines.supportLine[0].points;
          if (supportPoints.length >= 2) {
            supportCrossesRecent = last3Candles.some(candle => {
              // Calculate support line value at this candle's time
              const lastPoint = supportPoints[supportPoints.length - 1];
              const firstPoint = supportPoints[0];
              const slope = (lastPoint.value - firstPoint.value) / (lastPoint.time - firstPoint.time);
              const intercept = firstPoint.value - slope * firstPoint.time;
              const lineValueAtCandle = slope * candle.time + intercept;

              // Check if line crosses through candle (within high/low range) with 2% tolerance
              const tolerance = candle.close * 0.02;
              return lineValueAtCandle >= (candle.low - tolerance) &&
                     lineValueAtCandle <= (candle.high + tolerance);
            });
          }
        }

        if (resistanceLevel !== null && trendlines.resistanceLine.length > 0) {
          const resistancePoints = trendlines.resistanceLine[0].points;
          if (resistancePoints.length >= 2) {
            resistanceCrossesRecent = last3Candles.some(candle => {
              // Calculate resistance line value at this candle's time
              const lastPoint = resistancePoints[resistancePoints.length - 1];
              const firstPoint = resistancePoints[0];
              const slope = (lastPoint.value - firstPoint.value) / (lastPoint.time - firstPoint.time);
              const intercept = firstPoint.value - slope * firstPoint.time;
              const lineValueAtCandle = slope * candle.time + intercept;

              // Check if line crosses through candle (within high/low range) with 2% tolerance
              const tolerance = candle.close * 0.02;
              return lineValueAtCandle >= (candle.low - tolerance) &&
                     lineValueAtCandle <= (candle.high + tolerance);
            });
          }
        }

        // Only show alert if at least one line crosses recent candles
        if (!supportCrossesRecent && !resistanceCrossesRecent) {
          continue;
        }

        const distanceToSupport = supportLevel !== null
          ? ((currentPrice - supportLevel) / currentPrice) * 100
          : Infinity;
        const distanceToResistance = resistanceLevel !== null
          ? ((resistanceLevel - currentPrice) / currentPrice) * 100
          : Infinity;

        const supportDistance = Math.abs(distanceToSupport);
        const resistanceDistance = Math.abs(distanceToResistance);

        // Determine which level to report - prefer the one crossing recent candles
        let nearLevel: 'support' | 'resistance';
        if (supportCrossesRecent && !resistanceCrossesRecent) {
          nearLevel = 'support';
        } else if (resistanceCrossesRecent && !supportCrossesRecent) {
          nearLevel = 'resistance';
        } else {
          // Both crossing or neither, use closest
          nearLevel = supportDistance < resistanceDistance ? 'support' : 'resistance';
        }

        const signalType: 'bullish' | 'bearish' = nearLevel === 'support' ? 'bullish' : 'bearish';

        const supportResistanceValue: SupportResistanceValue = {
          timeframe,
          supportLevel: supportLevel ?? 0,
          resistanceLevel: resistanceLevel ?? 0,
          currentPrice,
          distanceToSupport,
          distanceToResistance,
          supportTouches,
          resistanceTouches,
          nearLevel,
        };

        const levelPrice = nearLevel === 'support' ? supportLevel : resistanceLevel;
        const distance = nearLevel === 'support' ? supportDistance : resistanceDistance;
        const touches = nearLevel === 'support' ? supportTouches : resistanceTouches;

        // Determine proximity description
        const isNear = distance <= config.distanceThreshold;
        const proximityText = isNear ? 'near' : 'approaching';
        const priceDirection = nearLevel === 'support'
          ? (currentPrice > supportLevel! ? 'above' : 'at')
          : (currentPrice < resistanceLevel! ? 'below' : 'at');

        const description = `Price crossing ${nearLevel} at ${levelPrice?.toFixed(2)} on ${timeframe} (${priceDirection}, ${distance.toFixed(2)}% away, ${touches} touches)`;

        return {
          symbol,
          supportResistanceLevels: [supportResistanceValue],
          matchedAt: Date.now(),
          signalType,
          description,
          scanType: 'supportResistance',
          closePrices,
        };
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  async scanAscendingTriangle(params: AscendingTriangleScanParams): Promise<ScanResult | null> {
    const { symbol, timeframes, config } = params;

    const candleStore = useCandleStore.getState();
    const closePrices = candleStore.getClosePrices(symbol, '1m', 100) || [];

    for (const timeframe of timeframes) {
      try {
        const candles = this.getCandlesFromStore(symbol, timeframe, config.lookbackBars);
        if (!candles || candles.length < config.lookbackBars) {
          continue;
        }

        const evaluated = evaluateAscendingTriangle(candles, config);
        if (!evaluated) {
          continue;
        }

        if (evaluated.score < config.minScore) {
          continue;
        }

        const triangleValue: AscendingTriangleValue = {
          timeframe,
          ...evaluated,
        };

        const componentStr = Object.entries(evaluated.components)
          .map(([k, v]) => `${k}=${v.toFixed(2)}`)
          .join(' ');
        const description = `Ascending triangle forming on ${timeframe} (score ${evaluated.score.toFixed(2)}, ceiling $${evaluated.ceiling.toFixed(4)}) — ${componentStr}`;

        return {
          symbol,
          ascendingTriangles: [triangleValue],
          matchedAt: Date.now(),
          signalType: 'bullish',
          description,
          scanType: 'ascendingTriangle',
          closePrices,
        };
      } catch (error) {
        console.error(`Error scanning ascending triangle for ${symbol} on ${timeframe}:`, error);
        continue;
      }
    }

    return null;
  }

  async scanCupAndHandle(params: CupAndHandleScanParams): Promise<ScanResult | null> {
    const { symbol, timeframes, config } = params;

    const candleStore = useCandleStore.getState();
    const closePrices = candleStore.getClosePrices(symbol, '1m', 100) || [];

    for (const timeframe of timeframes) {
      try {
        const candles = this.getCandlesFromStore(symbol, timeframe, config.lookbackBars);
        if (!candles || candles.length < config.lookbackBars) {
          continue;
        }

        const evaluated = evaluateCupAndHandle(candles, config);
        if (!evaluated) {
          continue;
        }

        if (evaluated.score < config.minScore) {
          continue;
        }

        const cupValue: CupAndHandleValue = {
          timeframe,
          ...evaluated,
        };

        const componentStr = Object.entries(evaluated.components)
          .map(([k, v]) => `${k}=${v.toFixed(2)}`)
          .join(' ');
        const description = `Cup and handle forming on ${timeframe} (score ${evaluated.score.toFixed(2)}, resistance $${evaluated.resistance.toFixed(4)}) — ${componentStr}`;

        return {
          symbol,
          cupAndHandles: [cupValue],
          matchedAt: Date.now(),
          signalType: 'bullish',
          description,
          scanType: 'cupAndHandle',
          closePrices,
        };
      } catch (error) {
        console.error(`Error scanning cup and handle for ${symbol} on ${timeframe}:`, error);
        continue;
      }
    }

    return null;
  }

  async scanMultipleSymbols(
    symbols: string[],
    params: Omit<StochasticScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    return scanWithYield(symbols, symbol => this.scanStochastic({ ...params, symbol }));
  }

  async scanMultipleSymbolsForVolume(
    symbols: string[],
    params: Omit<VolumeScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    return scanWithYield(symbols, symbol => this.scanVolumeSpike({ ...params, symbol }));
  }

  async scanMultipleSymbolsForEmaAlignment(
    symbols: string[],
    params: Omit<EmaAlignmentScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    return scanWithYield(symbols, symbol => this.scanEmaAlignment({ ...params, symbol }));
  }

  async scanMultipleSymbolsForMacdReversal(
    symbols: string[],
    params: Omit<MacdReversalScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    return scanWithYield(symbols, symbol => this.scanMacdReversal({ ...params, symbol }));
  }

  async scanMultipleSymbolsForRsiReversal(
    symbols: string[],
    params: Omit<RsiReversalScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    return scanWithYield(symbols, symbol => this.scanRsiReversal({ ...params, symbol }));
  }

  async scanMultipleSymbolsForChannel(
    symbols: string[],
    params: Omit<ChannelScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    return scanWithYield(symbols, symbol => this.scanChannel({ ...params, symbol }));
  }

  async scanMultipleSymbolsForDivergence(
    symbols: string[],
    params: Omit<DivergenceScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    return scanWithYield(symbols, symbol => this.scanDivergence({ ...params, symbol }));
  }

  async scanMultipleSymbolsForSupportResistance(
    symbols: string[],
    params: Omit<SupportResistanceScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    return scanWithYield(symbols, symbol => this.scanSupportResistance({ ...params, symbol }));
  }

  async scanMultipleSymbolsForAscendingTriangle(
    symbols: string[],
    params: Omit<AscendingTriangleScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    return scanWithYield(symbols, symbol => this.scanAscendingTriangle({ ...params, symbol }));
  }

  async scanMultipleSymbolsForCupAndHandle(
    symbols: string[],
    params: Omit<CupAndHandleScanParams, 'symbol'>
  ): Promise<ScanResult[]> {
    return scanWithYield(symbols, symbol => this.scanCupAndHandle({ ...params, symbol }));
  }
}

interface EvaluatedTriangle {
  score: number;
  components: AscendingTriangleComponents;
  ceiling: number;
  supportLineAtNow: number;
  supportSlope: number;
  supportR2: number;
  stopSuggestion: number;
  highPivotCount: number;
  lowPivotCount: number;
  atr: number;
  currentPrice: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function evaluateAscendingTriangle(
  candles: TransformedCandle[],
  config: AscendingTriangleScannerConfig
): EvaluatedTriangle | null {
  const n = candles.length;
  if (n < config.lookbackBars) return null;

  const atrSeries = calculateATR(candles as any, 14);
  const atr = atrSeries.length > 0 ? atrSeries[atrSeries.length - 1] : 0;
  if (atr <= 0) return null;

  const pivots = detectPivots(candles as any, config.pivotStrength);
  const highPivots = pivots.filter(p => p.type === 'high');
  const lowPivots = pivots.filter(p => p.type === 'low');

  if (highPivots.length < config.minHighPivots || lowPivots.length < config.minLowPivots) {
    return null;
  }

  const ceiling = highPivots.reduce((sum, p) => sum + p.price, 0) / highPivots.length;
  const meanHigh = ceiling;
  const variance = highPivots.reduce((sum, p) => sum + (p.price - meanHigh) ** 2, 0) / highPivots.length;
  const stdDevHighs = Math.sqrt(variance);

  const flatness = clamp01(1 - (stdDevHighs / atr));

  const regression = linearRegression(
    lowPivots.map(p => ({ x: p.index, y: p.price }))
  );
  if (regression.slope <= 0 || regression.r2 < config.minSlopeR2) {
    return null;
  }

  const slopePerBarInAtr = regression.slope / atr;
  const slopeScore = clamp01(slopePerBarInAtr * 10);

  const lastIndex = n - 1;
  const supportLineAtNow = regression.slope * lastIndex + regression.intercept;
  const gap = Math.max(0, ceiling - supportLineAtNow);
  const convergence = clamp01(1 - (gap / (atr * 4)));

  const third = Math.floor(n / 3);
  const firstThird = candles.slice(0, third);
  const lastThird = candles.slice(n - third);
  const avgVolFirst = firstThird.reduce((sum, c) => sum + c.volume, 0) / Math.max(1, firstThird.length);
  const avgVolLast = lastThird.reduce((sum, c) => sum + c.volume, 0) / Math.max(1, lastThird.length);
  const volumeRatio = avgVolFirst > 0 ? avgVolLast / avgVolFirst : 1;
  const volumeScore = clamp01(1 - volumeRatio);

  const closes = candles.map(c => c.close);
  const ema5 = calculateEMA(closes, 5);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const e5 = ema5.length > 0 ? ema5[ema5.length - 1] : 0;
  const e20 = ema20.length > 0 ? ema20[ema20.length - 1] : 0;
  const e50 = ema50.length > 0 ? ema50[ema50.length - 1] : 0;
  const emaScore = (e5 > 0 && e20 > 0 && e50 > 0 && e5 > e20 && e20 > e50) ? 1 : 0;

  const currentPrice = candles[n - 1].close;
  const distanceToCeiling = Math.max(0, ceiling - currentPrice);
  const proximity = clamp01(1 - (distanceToCeiling / (atr * 2)));

  const components: AscendingTriangleComponents = {
    flatness,
    slope: slopeScore,
    convergence,
    volume: volumeScore,
    ema: emaScore,
    proximity,
  };

  const w = config.weights;
  const weightSum = w.flatness + w.slope + w.convergence + w.volume + w.ema + w.proximity;
  const weighted =
    components.flatness * w.flatness +
    components.slope * w.slope +
    components.convergence * w.convergence +
    components.volume * w.volume +
    components.ema * w.ema +
    components.proximity * w.proximity;
  const score = weightSum > 0 ? weighted / weightSum : 0;

  const lastLowPivot = lowPivots[lowPivots.length - 1];
  const stopSuggestion = lastLowPivot.price - atr;

  return {
    score,
    components,
    ceiling,
    supportLineAtNow,
    supportSlope: regression.slope,
    supportR2: regression.r2,
    stopSuggestion,
    highPivotCount: highPivots.length,
    lowPivotCount: lowPivots.length,
    atr,
    currentPrice,
  };
}

interface EvaluatedCupAndHandle {
  score: number;
  components: CupAndHandleComponents;
  resistance: number;
  leftRimPrice: number;
  rightRimPrice: number;
  cupBottomPrice: number;
  handleLowPrice: number;
  cupStartIndex: number;
  cupBottomIndex: number;
  rightRimIndex: number;
  handleEndIndex: number;
  stopSuggestion: number;
  atr: number;
  currentPrice: number;
}

function evaluateCupAndHandle(
  candles: TransformedCandle[],
  config: CupAndHandleScannerConfig
): EvaluatedCupAndHandle | null {
  const n = candles.length;
  if (n < config.lookbackBars) return null;

  const atrSeries = calculateATR(candles as any, 14);
  const atr = atrSeries.length > 0 ? atrSeries[atrSeries.length - 1] : 0;
  if (atr <= 0) return null;

  const pivots = detectPivots(candles as any, config.pivotStrength);
  const highPivots = pivots.filter(p => p.type === 'high');
  const lowPivots = pivots.filter(p => p.type === 'low');

  if (highPivots.length < 2 || lowPivots.length < 1) return null;

  const handleEndIndex = n - 1;
  const currentPrice = candles[handleEndIndex].close;

  let best: EvaluatedCupAndHandle | null = null;

  for (let li = 0; li < highPivots.length - 1; li++) {
    const leftRim = highPivots[li];

    for (let ri = highPivots.length - 1; ri > li; ri--) {
      const rightRim = highPivots[ri];

      const cupBars = rightRim.index - leftRim.index;
      if (cupBars < config.minCupBars || cupBars > config.maxCupBars) continue;

      const barsSinceRim = handleEndIndex - rightRim.index;
      if (barsSinceRim < config.minHandleBars) continue;
      if (barsSinceRim > config.maxHandleBars * 2) continue;

      const rimAvg = (leftRim.price + rightRim.price) / 2;
      const rimAsymmetry = Math.abs(leftRim.price - rightRim.price) / rimAvg;
      if (rimAsymmetry > config.maxRimAsymmetry) continue;

      const cupLowPivots = lowPivots.filter(p => p.index > leftRim.index && p.index < rightRim.index);
      if (cupLowPivots.length === 0) continue;

      const cupBottom = cupLowPivots.reduce((min, p) => p.price < min.price ? p : min, cupLowPivots[0]);

      const cupDepth = (rimAvg - cupBottom.price) / rimAvg;
      if (cupDepth < config.minCupDepth || cupDepth > config.maxCupDepth) continue;

      const handleStart = rightRim.index;
      const handleSearchEnd = Math.min(n - 1, rightRim.index + config.maxHandleBars);
      let handleLow = candles[handleStart].low;
      let handleLowIndex = handleStart;
      for (let k = handleStart; k <= handleSearchEnd; k++) {
        if (candles[k].low < handleLow) {
          handleLow = candles[k].low;
          handleLowIndex = k;
        }
      }
      const actualHandleBars = handleLowIndex - handleStart;
      if (actualHandleBars < config.minHandleBars) continue;

      const handleDrop = rightRim.price - handleLow;
      const cupRange = rimAvg - cupBottom.price;
      const handlePullback = cupRange > 0 ? handleDrop / cupRange : 1;
      if (handlePullback > config.maxHandlePullback) continue;
      if (handleLow < cupBottom.price) continue;

      const rimSymmetryScore = clamp01(1 - (rimAsymmetry / config.maxRimAsymmetry));

      const cupSlice = candles.slice(leftRim.index, rightRim.index + 1);
      const cupRoundnessScore = computeCupRoundness(cupSlice, leftRim.price, rightRim.price, cupBottom.price);

      const cupDepthScore = clamp01(1 - Math.abs(cupDepth - 0.08) / 0.08);

      const handlePullbackScore = clamp01(1 - Math.abs(handlePullback - 0.33) / 0.33);

      const handleVolumeScore = computeHandleVolumeScore(candles, leftRim.index, rightRim.index, handleLowIndex);

      const distanceToResistance = Math.max(0, rightRim.price - currentPrice);
      const proximityScore = clamp01(1 - (distanceToResistance / (atr * 2)));

      const components: CupAndHandleComponents = {
        rimSymmetry: rimSymmetryScore,
        cupRoundness: cupRoundnessScore,
        cupDepth: cupDepthScore,
        handlePullback: handlePullbackScore,
        handleVolume: handleVolumeScore,
        proximity: proximityScore,
      };

      const w = config.weights;
      const weightSum = w.rimSymmetry + w.cupRoundness + w.cupDepth + w.handlePullback + w.handleVolume + w.proximity;
      const weighted =
        components.rimSymmetry * w.rimSymmetry +
        components.cupRoundness * w.cupRoundness +
        components.cupDepth * w.cupDepth +
        components.handlePullback * w.handlePullback +
        components.handleVolume * w.handleVolume +
        components.proximity * w.proximity;
      const score = weightSum > 0 ? weighted / weightSum : 0;

      if (!best || score > best.score) {
        best = {
          score,
          components,
          resistance: Math.max(leftRim.price, rightRim.price),
          leftRimPrice: leftRim.price,
          rightRimPrice: rightRim.price,
          cupBottomPrice: cupBottom.price,
          handleLowPrice: handleLow,
          cupStartIndex: leftRim.index,
          cupBottomIndex: cupBottom.index,
          rightRimIndex: rightRim.index,
          handleEndIndex,
          stopSuggestion: handleLow - atr,
          atr,
          currentPrice,
        };
      }
    }
  }

  return best;
}

function computeCupRoundness(
  cupSlice: TransformedCandle[],
  leftPrice: number,
  rightPrice: number,
  bottomPrice: number
): number {
  const n = cupSlice.length;
  if (n < 5) return 0;

  const lows = cupSlice.map(c => c.low);
  const startV = leftPrice;
  const endV = rightPrice;
  const minV = bottomPrice;
  const range = ((startV + endV) / 2) - minV;
  if (range <= 0) return 0;

  let ssRes = 0;
  let ssTot = 0;
  const meanLow = lows.reduce((s, v) => s + v, 0) / n;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const expected = startV + (endV - startV) * t - 4 * range * t * (1 - t);
    ssRes += (lows[i] - expected) ** 2;
    ssTot += (lows[i] - meanLow) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return clamp01(r2);
}

function computeHandleVolumeScore(
  candles: TransformedCandle[],
  cupStartIndex: number,
  rightRimIndex: number,
  handleEndIndex: number
): number {
  const cupSlice = candles.slice(cupStartIndex, rightRimIndex + 1);
  const handleSlice = candles.slice(rightRimIndex, handleEndIndex + 1);
  if (cupSlice.length === 0 || handleSlice.length === 0) return 0;
  const cupAvgVol = cupSlice.reduce((s, c) => s + c.volume, 0) / cupSlice.length;
  const handleAvgVol = handleSlice.reduce((s, c) => s + c.volume, 0) / handleSlice.length;
  if (cupAvgVol <= 0) return 0;
  const ratio = handleAvgVol / cupAvgVol;
  return clamp01(1 - ratio);
}
