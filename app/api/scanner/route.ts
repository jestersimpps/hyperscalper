import { NextRequest, NextResponse } from 'next/server';
import { ExchangeFactory } from '@/lib/exchange-factory';
import { calculateStochastic, calculateMACD, calculateRSI, detectEmaAlignment, detectChannels, detectPivots, detectStochasticPivots, detectDivergence, detectMacdReversals, detectRsiReversals } from '@/lib/indicators';
import type { TimeInterval, CandleData } from '@/types';
import type { StochasticValue, EmaAlignmentValue, ChannelValue, DivergenceValue, MacdReversalValue, RsiReversalValue } from '@/models/Scanner';
import type { PerpsMetaAndAssetCtxs } from '@nktkas/hyperliquid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StochasticVariantConfig {
  enabled: boolean;
  period: number;
  smoothK: number;
  smoothD: number;
}

interface ScanParams {
  oversoldThreshold: number;
  overboughtThreshold: number;
  topMarkets: number;
  stochasticEnabled: boolean;
  stochasticVariants: {
    fast9: StochasticVariantConfig;
    fast14: StochasticVariantConfig;
    fast40: StochasticVariantConfig;
    full60: StochasticVariantConfig;
  };
  emaAlignmentEnabled: boolean;
  emaTimeframes: TimeInterval[];
  ema1Period: number;
  ema2Period: number;
  ema3Period: number;
  emaLookbackBars: number;
  channelEnabled: boolean;
  channelTimeframes: ('1m' | '5m')[];
  channelMinTouches: number;
  channelPivotStrength: number;
  channelLookbackBars: number;
  divergenceEnabled: boolean;
  divergenceScanBullish: boolean;
  divergenceScanBearish: boolean;
  divergenceScanHidden: boolean;
  macdReversalEnabled: boolean;
  macdTimeframes: TimeInterval[];
  macdFastPeriod: number;
  macdSlowPeriod: number;
  macdSignalPeriod: number;
  rsiReversalEnabled: boolean;
  rsiTimeframes: TimeInterval[];
  rsiPeriod: number;
  rsiOversoldLevel: number;
  rsiOverboughtLevel: number;
}

interface SymbolWithVolume {
  name: string;
  volume: number;
  isDelisted?: boolean;
}

function aggregateCandles(candles: CandleData[], timeframeMinutes: number): CandleData[] {
  if (timeframeMinutes === 1) return candles;

  const aggregated: CandleData[] = [];
  const barsPerCandle = timeframeMinutes;

  for (let i = 0; i < candles.length; i += barsPerCandle) {
    const chunk = candles.slice(i, i + barsPerCandle);
    if (chunk.length < barsPerCandle) break;

    const open = chunk[0].open;
    const high = Math.max(...chunk.map((c) => c.high));
    const low = Math.min(...chunk.map((c) => c.low));
    const close = chunk[chunk.length - 1].close;
    const volume = chunk.reduce((sum, c) => sum + c.volume, 0);
    const time = chunk[chunk.length - 1].time;

    aggregated.push({
      time,
      open,
      high,
      low,
      close,
      volume,
      openFormatted: open.toString(),
      highFormatted: high.toString(),
      lowFormatted: low.toString(),
      closeFormatted: close.toString(),
      volumeFormatted: volume.toString(),
    });
  }

  return aggregated;
}

function getTimeframeMinutes(interval: TimeInterval): number {
  const map: Record<TimeInterval, number> = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '4h': 240,
    '1d': 1440,
  };
  return map[interval];
}

export async function POST(request: NextRequest) {
  const scanStartTime = Date.now();

  try {
    const body = await request.json();
    const params: ScanParams = {
      oversoldThreshold: body.oversoldThreshold ?? 20,
      overboughtThreshold: body.overboughtThreshold ?? 80,
      topMarkets: body.topMarkets ?? 20,
      stochasticEnabled: body.stochasticEnabled ?? false,
      stochasticVariants: {
        fast9: {
          enabled: body.stochasticVariants?.fast9?.enabled ?? false,
          period: body.stochasticVariants?.fast9?.period ?? 9,
          smoothK: body.stochasticVariants?.fast9?.smoothK ?? 1,
          smoothD: body.stochasticVariants?.fast9?.smoothD ?? 3,
        },
        fast14: {
          enabled: body.stochasticVariants?.fast14?.enabled ?? false,
          period: body.stochasticVariants?.fast14?.period ?? 14,
          smoothK: body.stochasticVariants?.fast14?.smoothK ?? 1,
          smoothD: body.stochasticVariants?.fast14?.smoothD ?? 3,
        },
        fast40: {
          enabled: body.stochasticVariants?.fast40?.enabled ?? false,
          period: body.stochasticVariants?.fast40?.period ?? 40,
          smoothK: body.stochasticVariants?.fast40?.smoothK ?? 1,
          smoothD: body.stochasticVariants?.fast40?.smoothD ?? 4,
        },
        full60: {
          enabled: body.stochasticVariants?.full60?.enabled ?? false,
          period: body.stochasticVariants?.full60?.period ?? 60,
          smoothK: body.stochasticVariants?.full60?.smoothK ?? 10,
          smoothD: body.stochasticVariants?.full60?.smoothD ?? 10,
        },
      },
      emaAlignmentEnabled: body.emaAlignmentEnabled ?? false,
      emaTimeframes: body.emaTimeframes ?? ['1m', '5m', '15m'],
      ema1Period: body.ema1Period ?? 5,
      ema2Period: body.ema2Period ?? 13,
      ema3Period: body.ema3Period ?? 21,
      emaLookbackBars: body.emaLookbackBars ?? 3,
      channelEnabled: body.channelEnabled ?? false,
      channelTimeframes: body.channelTimeframes ?? ['1m', '5m'],
      channelMinTouches: body.channelMinTouches ?? 3,
      channelPivotStrength: body.channelPivotStrength ?? 3,
      channelLookbackBars: body.channelLookbackBars ?? 50,
      divergenceEnabled: body.divergenceEnabled ?? false,
      divergenceScanBullish: body.divergenceScanBullish ?? true,
      divergenceScanBearish: body.divergenceScanBearish ?? true,
      divergenceScanHidden: body.divergenceScanHidden ?? false,
      macdReversalEnabled: body.macdReversalEnabled ?? false,
      macdTimeframes: body.macdTimeframes ?? ['1m', '5m', '15m', '1h'],
      macdFastPeriod: body.macdFastPeriod ?? 5,
      macdSlowPeriod: body.macdSlowPeriod ?? 13,
      macdSignalPeriod: body.macdSignalPeriod ?? 5,
      rsiReversalEnabled: body.rsiReversalEnabled ?? false,
      rsiTimeframes: body.rsiTimeframes ?? ['1m', '5m', '15m', '1h'],
      rsiPeriod: body.rsiPeriod ?? 14,
      rsiOversoldLevel: body.rsiOversoldLevel ?? 30,
      rsiOverboughtLevel: body.rsiOverboughtLevel ?? 70,
    };

    console.log('🔍 Scanner started:', {
      stochasticEnabled: params.stochasticEnabled,
      stochasticVariants: Object.entries(params.stochasticVariants).filter(([_, v]) => v.enabled).map(([k]) => k),
      emaAlignmentEnabled: params.emaAlignmentEnabled,
      channelEnabled: params.channelEnabled,
      divergenceEnabled: params.divergenceEnabled,
      macdReversalEnabled: params.macdReversalEnabled,
      rsiReversalEnabled: params.rsiReversalEnabled,
      emaTimeframes: params.emaTimeframes,
      channelTimeframes: params.channelTimeframes,
      macdTimeframes: params.macdTimeframes,
      rsiTimeframes: params.rsiTimeframes,
      topMarkets: params.topMarkets,
    });

    const API_URL = 'https://api.hyperliquid.xyz/info';
    const metaResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
    });

    if (!metaResponse.ok) {
      throw new Error('Failed to fetch symbol metadata');
    }

    const [metaData, assetCtxs] = await metaResponse.json() as PerpsMetaAndAssetCtxs;

    const symbolsWithVolume: SymbolWithVolume[] = metaData.universe
      .map((u, index) => ({
        name: u.name,
        volume: parseFloat(assetCtxs[index]?.dayNtlVlm || '0'),
        isDelisted: u.isDelisted,
      }))
      .filter((s) => !s.isDelisted)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, params.topMarkets);

    const symbols = symbolsWithVolume.map((s) => s.name);

    console.log(`📊 Scanning ${symbols.length} symbols by volume:`, symbols.join(', '));

    const exchange = ExchangeFactory.createFromEnv();
    const results = [];
    let scannedCount = 0;
    let failedFetchCount = 0;
    let filteredOutCount = 0;

    const endTime = Date.now();
    const startTime = endTime - 24 * 60 * 60 * 1000;

    for (const symbol of symbols) {
      try {
        let candles1m: CandleData[];
        try {
          candles1m = await exchange.getCandles({
            coin: symbol,
            interval: '1m',
            startTime,
            endTime,
          });
          scannedCount++;
        } catch (error) {
          failedFetchCount++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.log(`  ⚠️  ${symbol}: Failed to fetch candles - ${errorMsg}`);
          continue;
        }

        if (!candles1m || candles1m.length === 0) {
          failedFetchCount++;
          console.log(`  ⚠️  ${symbol}: No candle data`);
          continue;
        }

        if (params.stochasticEnabled) {
          const stochastics: StochasticValue[] = [];
          let allOversold = true;
          let allOverbought = true;
          let enabledVariantsCount = 0;

          for (const [variantName, config] of Object.entries(params.stochasticVariants)) {
            if (!config.enabled) continue;
            enabledVariantsCount++;

            const stochData = calculateStochastic(candles1m, config.period, config.smoothK, config.smoothD);

            if (stochData.length === 0) {
              allOversold = false;
              allOverbought = false;
              break;
            }

            const latestStoch = stochData[stochData.length - 1];

            if (latestStoch.d > params.oversoldThreshold) {
              allOversold = false;
            }

            if (latestStoch.d < params.overboughtThreshold) {
              allOverbought = false;
            }

            stochastics.push({
              k: latestStoch.k,
              d: latestStoch.d,
              timeframe: '1m',
            });
          }

          if (enabledVariantsCount > 0 && (allOversold || allOverbought)) {
            const signalType = allOversold ? 'bullish' : 'bearish';
            const avgD = stochastics.reduce((sum, s) => sum + s.d, 0) / stochastics.length;

            let description = '';
            if (allOversold) {
              const intensity = avgD < 10 ? 'Extreme' : avgD < 15 ? 'Strong' : 'Moderate';
              description = `${intensity} oversold - All stochastic variants bottomed (avg D:${avgD.toFixed(1)})`;
            } else {
              const intensity = avgD > 90 ? 'Extreme' : avgD > 85 ? 'Strong' : 'Moderate';
              description = `${intensity} overbought - All stochastic variants topped (avg D:${avgD.toFixed(1)})`;
            }

            console.log(`  ✅ ${symbol}: STOCHASTIC MATCH! ${description}`);
            results.push({
              symbol,
              stochastics,
              matchedAt: Date.now(),
              signalType,
              description,
              scanType: 'stochastic' as const,
            });
          } else if (enabledVariantsCount > 0) {
            filteredOutCount++;
          }
        }

        if (params.emaAlignmentEnabled) {
          const emaAlignments: EmaAlignmentValue[] = [];
          let hasAlignment = false;
          let alignmentType: 'bullish' | 'bearish' | null = null;

          for (const timeframe of params.emaTimeframes) {
            const timeframeMinutes = getTimeframeMinutes(timeframe);
            const aggregatedCandles = aggregateCandles(candles1m, timeframeMinutes);

            if (aggregatedCandles.length === 0) {
              break;
            }

            const alignment = detectEmaAlignment(
              aggregatedCandles,
              params.ema1Period,
              params.ema2Period,
              params.ema3Period,
              params.emaLookbackBars
            );

            if (alignment) {
              hasAlignment = true;
              if (!alignmentType) {
                alignmentType = alignment.type;
              } else if (alignmentType !== alignment.type) {
                hasAlignment = false;
                break;
              }

              emaAlignments.push({
                ema1: alignment.ema1,
                ema2: alignment.ema2,
                ema3: alignment.ema3,
                timeframe,
                alignmentType: alignment.type,
                barsAgo: alignment.barsAgo,
              });
            } else {
              hasAlignment = false;
              break;
            }
          }

          if (hasAlignment && alignmentType && emaAlignments.length > 0) {
            const description = `EMA alignment ${alignmentType === 'bullish' ? 'crossed up' : 'crossed down'} across ${emaAlignments.length} timeframe${emaAlignments.length > 1 ? 's' : ''}`;

            console.log(`  ✅ ${symbol}: EMA MATCH! ${description}`);
            results.push({
              symbol,
              emaAlignments,
              matchedAt: Date.now(),
              signalType: alignmentType,
              description,
              scanType: 'emaAlignment' as const,
            });
          }
        }

        if (params.channelEnabled) {
          const channels: ChannelValue[] = [];
          let bestChannel = null;

          for (const timeframe of params.channelTimeframes) {
            const timeframeMinutes = getTimeframeMinutes(timeframe);
            const aggregatedCandles = aggregateCandles(candles1m, timeframeMinutes);

            if (aggregatedCandles.length === 0) {
              break;
            }

            const detectedChannels = detectChannels(aggregatedCandles, {
              pivotStrength: params.channelPivotStrength,
              lookbackBars: params.channelLookbackBars,
              minTouches: params.channelMinTouches,
            });

            if (detectedChannels.length > 0) {
              const channel = detectedChannels[0];
              const currentPrice = aggregatedCandles[aggregatedCandles.length - 1].close;
              const lastIndex = aggregatedCandles.length - 1;

              const upperPrice = channel.upperLine.slope * lastIndex + channel.upperLine.intercept;
              const lowerPrice = channel.lowerLine.slope * lastIndex + channel.lowerLine.intercept;

              const distanceToUpper = ((upperPrice - currentPrice) / currentPrice) * 100;
              const distanceToLower = ((currentPrice - lowerPrice) / currentPrice) * 100;

              channels.push({
                type: channel.type,
                upperPrice,
                lowerPrice,
                currentPrice,
                distanceToUpper,
                distanceToLower,
                angle: channel.angle,
                touches: channel.touches,
                strength: channel.strength,
                timeframe,
              });

              if (!bestChannel || channel.strength > bestChannel.strength) {
                bestChannel = channel;
              }
            }
          }

          if (channels.length > 0 && bestChannel) {
            const channelTypeLabel =
              bestChannel.type === 'ascending'
                ? 'Ascending'
                : bestChannel.type === 'descending'
                  ? 'Descending'
                  : 'Horizontal';
            const signalType = bestChannel.type === 'ascending' ? 'bullish' : 'bearish';
            const description = `${channelTypeLabel} channel detected across ${channels.length} timeframe${channels.length > 1 ? 's' : ''} (${bestChannel.touches} touches, ${bestChannel.angle.toFixed(1)}°)`;

            console.log(`  ✅ ${symbol}: CHANNEL MATCH! ${description}`);
            results.push({
              symbol,
              channels,
              matchedAt: Date.now(),
              signalType,
              description,
              scanType: 'channel' as const,
            });
          }
        }

        if (params.divergenceEnabled) {
          const allDivergences: Array<DivergenceValue> = [];

          for (const [variantName, variantConfig] of Object.entries(params.stochasticVariants)) {
            if (!variantConfig.enabled) continue;

            const stochData = calculateStochastic(candles1m, variantConfig.period, variantConfig.smoothK, variantConfig.smoothD);

            if (stochData.length > 0) {
              const offset = candles1m.length - stochData.length;
              const alignedCandles = candles1m.slice(offset);

              const pricePivots = detectPivots(alignedCandles, 3);
              const stochPivots = detectStochasticPivots(stochData, alignedCandles, 3);
              const divergences = detectDivergence(pricePivots, stochPivots, alignedCandles);

              const filteredDivergences = divergences.filter(div => {
                if (div.type === 'bullish' && params.divergenceScanBullish) return true;
                if (div.type === 'bearish' && params.divergenceScanBearish) return true;
                if ((div.type === 'hidden-bullish' || div.type === 'hidden-bearish') && params.divergenceScanHidden) return true;
                return false;
              });

              filteredDivergences.forEach(div => {
                allDivergences.push({
                  type: div.type,
                  startTime: div.startTime,
                  endTime: div.endTime,
                  startPriceValue: div.startPriceValue,
                  endPriceValue: div.endPriceValue,
                  startStochValue: div.startStochValue,
                  endStochValue: div.endStochValue,
                  variant: variantName as 'fast9' | 'fast14' | 'fast40' | 'full60',
                });
              });
            }
          }

          if (allDivergences.length > 0) {
            const latestDivergence = allDivergences[allDivergences.length - 1];
            const signalType = latestDivergence.type === 'bullish' || latestDivergence.type === 'hidden-bullish' ? 'bullish' : 'bearish';

            const divergenceTypeLabels: Record<string, string> = {
              'bullish': 'Bullish',
              'bearish': 'Bearish',
              'hidden-bullish': 'Hidden Bullish',
              'hidden-bearish': 'Hidden Bearish'
            };

            const variantCounts: Record<string, number> = {};
            allDivergences.forEach(div => {
              variantCounts[div.variant] = (variantCounts[div.variant] || 0) + 1;
            });

            const variantSummary = Object.entries(variantCounts)
              .map(([variant, count]) => `${variant.toUpperCase()}:${count}`)
              .join(', ');

            const description = `${divergenceTypeLabels[latestDivergence.type]} divergence detected (${allDivergences.length} total across ${variantSummary})`;

            console.log(`  ✅ ${symbol}: DIVERGENCE MATCH! ${description}`);
            results.push({
              symbol,
              divergences: allDivergences,
              matchedAt: Date.now(),
              signalType,
              description,
              scanType: 'divergence' as const,
            });
          }
        }

        if (params.macdReversalEnabled) {
          const macdReversals: MacdReversalValue[] = [];

          for (const timeframe of params.macdTimeframes) {
            const timeframeMinutes = getTimeframeMinutes(timeframe);
            const aggregatedCandles = aggregateCandles(candles1m, timeframeMinutes);

            if (aggregatedCandles.length < 50) continue;

            const closePrices = aggregatedCandles.map(c => c.close);
            const macdResult = calculateMACD(closePrices, params.macdFastPeriod, params.macdSlowPeriod, params.macdSignalPeriod);

            if (macdResult.macd.length > 0) {
              const reversals = detectMacdReversals(macdResult, aggregatedCandles);
              const recentReversals = reversals.filter(r => aggregatedCandles.length - aggregatedCandles.findIndex(c => c.time === r.time) <= 3);

              recentReversals.forEach(reversal => {
                macdReversals.push({
                  direction: reversal.direction,
                  timeframe,
                  time: reversal.time,
                  price: reversal.price,
                  macdValue: macdResult.macd[macdResult.macd.length - 1],
                  signalValue: macdResult.signal[macdResult.signal.length - 1],
                });
              });
            }
          }

          if (macdReversals.length > 0) {
            const latestReversal = macdReversals[macdReversals.length - 1];
            const signalType = latestReversal.direction;
            const timeframeSummary = macdReversals.map(r => r.timeframe).join(', ');
            const description = `MACD ${signalType} reversal on ${timeframeSummary}`;

            console.log(`  ✅ ${symbol}: MACD REVERSAL MATCH! ${description}`);
            results.push({
              symbol,
              macdReversals,
              matchedAt: Date.now(),
              signalType,
              description,
              scanType: 'macdReversal' as const,
            });
          }
        }

        if (params.rsiReversalEnabled) {
          const rsiReversals: RsiReversalValue[] = [];

          for (const timeframe of params.rsiTimeframes) {
            const timeframeMinutes = getTimeframeMinutes(timeframe);
            const aggregatedCandles = aggregateCandles(candles1m, timeframeMinutes);

            if (aggregatedCandles.length < 50) continue;

            const closePrices = aggregatedCandles.map(c => c.close);
            const rsi = calculateRSI(closePrices, params.rsiPeriod);

            if (rsi.length > 0) {
              const reversals = detectRsiReversals(rsi, aggregatedCandles, params.rsiOversoldLevel, params.rsiOverboughtLevel);
              const recentReversals = reversals.filter(r => aggregatedCandles.length - aggregatedCandles.findIndex(c => c.time === r.time) <= 3);

              recentReversals.forEach(reversal => {
                const zone = reversal.direction === 'bullish' ? 'oversold' : 'overbought';
                rsiReversals.push({
                  direction: reversal.direction,
                  timeframe,
                  time: reversal.time,
                  price: reversal.price,
                  rsiValue: rsi[rsi.length - 1],
                  zone,
                });
              });
            }
          }

          if (rsiReversals.length > 0) {
            const latestReversal = rsiReversals[rsiReversals.length - 1];
            const signalType = latestReversal.direction;
            const timeframeSummary = rsiReversals.map(r => r.timeframe).join(', ');
            const description = `RSI ${signalType} reversal (exiting ${latestReversal.zone}) on ${timeframeSummary}`;

            console.log(`  ✅ ${symbol}: RSI REVERSAL MATCH! ${description}`);
            results.push({
              symbol,
              rsiReversals,
              matchedAt: Date.now(),
              signalType,
              description,
              scanType: 'rsiReversal' as const,
            });
          }
        }
      } catch (error) {
        failedFetchCount++;
        console.log(`  ❌ ${symbol}: Error -`, error instanceof Error ? error.message : 'Unknown error');
        continue;
      }
    }

    const scanDuration = Date.now() - scanStartTime;

    console.log('✨ Scanner completed:', {
      duration: `${(scanDuration / 1000).toFixed(2)}s`,
      totalSymbols: symbols.length,
      scanned: scannedCount,
      failed: failedFetchCount,
      filteredOut: filteredOutCount,
      matches: results.length,
      matchedSymbols: results.map(r => r.symbol).join(', ') || 'none',
    });

    return NextResponse.json({ results, scannedSymbols: symbols.length });
  } catch (error) {
    console.error('❌ Scanner error:', error);
    return NextResponse.json({ error: 'Failed to run scanner' }, { status: 500 });
  }
}
