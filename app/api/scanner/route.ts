import { NextRequest, NextResponse } from 'next/server';
import { ExchangeFactory } from '@/lib/exchange-factory';
import { calculateStochastic } from '@/lib/indicators';
import type { TimeInterval, CandleData } from '@/types';
import type { StochasticValue } from '@/models/Scanner';
import type { PerpsMetaAndAssetCtxs } from '@nktkas/hyperliquid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ScanParams {
  timeframes: TimeInterval[];
  oversoldThreshold: number;
  overboughtThreshold: number;
  period: number;
  smoothK: number;
  smoothD: number;
  topMarkets: number;
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const scanStartTime = Date.now();

  try {
    const params: ScanParams = {
      timeframes: (searchParams.get('timeframes')?.split(',') as TimeInterval[]) || ['1m', '5m', '15m'],
      oversoldThreshold: parseInt(searchParams.get('oversoldThreshold') || '20'),
      overboughtThreshold: parseInt(searchParams.get('overboughtThreshold') || '80'),
      period: parseInt(searchParams.get('period') || '14'),
      smoothK: parseInt(searchParams.get('smoothK') || '3'),
      smoothD: parseInt(searchParams.get('smoothD') || '3'),
      topMarkets: parseInt(searchParams.get('topMarkets') || '20'),
    };

    console.log('🔍 Scanner started:', {
      timeframes: params.timeframes,
      oversoldThreshold: params.oversoldThreshold,
      overboughtThreshold: params.overboughtThreshold,
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

        const stochastics: StochasticValue[] = [];
        let allOversold = true;
        let allOverbought = true;

        for (const timeframe of params.timeframes) {
          const timeframeMinutes = getTimeframeMinutes(timeframe);
          const aggregatedCandles = aggregateCandles(candles1m, timeframeMinutes);

          if (aggregatedCandles.length === 0) {
            allOversold = false;
            allOverbought = false;
            break;
          }

          const stochData = calculateStochastic(aggregatedCandles, params.period, params.smoothK, params.smoothD);

          if (stochData.length === 0) {
            allOversold = false;
            allOverbought = false;
            break;
          }

          const latestStoch = stochData[stochData.length - 1];

          if (latestStoch.k > params.oversoldThreshold || latestStoch.d > params.oversoldThreshold) {
            allOversold = false;
          }

          if (latestStoch.k < params.overboughtThreshold || latestStoch.d < params.overboughtThreshold) {
            allOverbought = false;
          }

          stochastics.push({
            k: latestStoch.k,
            d: latestStoch.d,
            timeframe,
          });
        }

        if (allOversold || allOverbought) {
          const signalType = allOversold ? 'bullish' : 'bearish';
          const avgK = stochastics.reduce((sum, s) => sum + s.k, 0) / stochastics.length;
          const avgD = stochastics.reduce((sum, s) => sum + s.d, 0) / stochastics.length;

          let description = '';
          if (allOversold) {
            const intensity = avgK < 10 ? 'Extreme' : avgK < 15 ? 'Strong' : 'Moderate';
            description = `${intensity} oversold - Stochastics bottomed across ${stochastics.length} timeframe${stochastics.length > 1 ? 's' : ''} (avg K:${avgK.toFixed(1)})`;
          } else {
            const intensity = avgK > 90 ? 'Extreme' : avgK > 85 ? 'Strong' : 'Moderate';
            description = `${intensity} overbought - Stochastics topped across ${stochastics.length} timeframe${stochastics.length > 1 ? 's' : ''} (avg K:${avgK.toFixed(1)})`;
          }

          console.log(`  ✅ ${symbol}: MATCH! ${description}`);
          results.push({
            symbol,
            stochastics,
            matchedAt: Date.now(),
            signalType,
            description,
          });
        } else {
          filteredOutCount++;
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
