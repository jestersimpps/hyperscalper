'use client';

import { useEffect, useMemo, memo } from 'react';
import { useCandleStore } from '@/stores/useCandleStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTradesStore } from '@/stores/useTradesStore';
import type { Trade } from '@/types';
import {
  calculateStochastic,
  calculateMACD,
  calculateEMA,
  calculateStochasticMemoized,
  calculateMACDMemoized,
  calculateEMAMemoized,
  detectEmaAlignment,
  getStochasticZone,
  getStochasticTrend,
  getMacdTrend,
  detectMacdTurnPoint,
  calculateVolumeFlow,
  type StochasticZone,
  type TrendDirection,
  type MacdTurnPoint,
} from '@/lib/indicators';

interface IndicatorSignalsProps {
  coin: string;
}

const TrendArrow = ({ direction }: { direction: TrendDirection }) => {
  return (
    <span className={direction === 'up' ? 'text-bullish' : 'text-bearish'}>
      {direction === 'up' ? '↑' : '↓'}
    </span>
  );
};

const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toFixed(decimals);
};

const formatVolume = (volume: number): string => {
  const absVolume = Math.abs(volume);
  if (absVolume >= 1000000) {
    return `${(volume / 1000000).toFixed(2)}M`;
  }
  if (absVolume >= 1000) {
    return `${(volume / 1000).toFixed(2)}K`;
  }
  return volume.toFixed(2);
};

function IndicatorSignals({ coin }: IndicatorSignalsProps) {
  const stochasticSettings = useSettingsStore((state) => state.settings.indicators.stochastic);
  const emaSettings = useSettingsStore((state) => state.settings.indicators.ema);
  const macdSettings = useSettingsStore((state) => state.settings.indicators.macd);

  const subscribeToCandles = useCandleStore((state) => state.subscribeToCandles);
  const unsubscribeFromCandles = useCandleStore((state) => state.unsubscribeFromCandles);

  const candles1m = useCandleStore((state) => state.candles[`${coin}-1m`]);
  const candles5m = useCandleStore((state) => state.candles[`${coin}-5m`]);
  const candles15m = useCandleStore((state) => state.candles[`${coin}-15m`]);
  const candles1h = useCandleStore((state) => state.candles[`${coin}-1h`]);

  const tradesRecord = useTradesStore((state) => state.trades);
  const trades = useMemo(() => tradesRecord[coin] || [], [tradesRecord, coin]);

  useEffect(() => {
    const subscriptions: Array<{ coin: string; interval: string }> = [];

    subscribeToCandles(coin, '1m');
    subscriptions.push({ coin, interval: '1m' });

    if (macdSettings.showMultiTimeframe) {
      Object.entries(macdSettings.timeframes).forEach(([tf, settings]) => {
        if (settings.enabled) {
          subscribeToCandles(coin, tf as any);
          subscriptions.push({ coin, interval: tf });
        }
      });
    }

    return () => {
      subscriptions.forEach((sub) => unsubscribeFromCandles(sub.coin, sub.interval as any));
    };
  }, [
    coin,
    subscribeToCandles,
    unsubscribeFromCandles,
    macdSettings.showMultiTimeframe,
    macdSettings.timeframes,
  ]);

  const stochasticStats = useMemo(() => {
    if (!stochasticSettings.showMultiVariant) return [];
    if (!candles1m || candles1m.length === 0) return [];

    const stats: Array<{
      variant: string;
      k: number;
      d: number;
      zone: StochasticZone;
      trend: TrendDirection;
    }> = [];

    Object.entries(stochasticSettings.variants).forEach(([variantName, settings]) => {
      if (!settings.enabled) return;

      const stochData = calculateStochasticMemoized(
        candles1m,
        settings.period,
        settings.smoothK,
        settings.smoothD
      );

      if (stochData.length === 0) return;

      const latest = stochData[stochData.length - 1];
      const zone = getStochasticZone(
        latest.k,
        stochasticSettings.overboughtLevel,
        stochasticSettings.oversoldLevel
      );
      const trend = getStochasticTrend(latest.k, latest.d);

      stats.push({
        variant: variantName,
        k: latest.k,
        d: latest.d,
        zone,
        trend,
      });
    });

    return stats;
  }, [candles1m, stochasticSettings]);

  const emaSignal = useMemo(() => {
    if (!candles1m || candles1m.length === 0) return null;

    const ema1Period = emaSettings.ema1.enabled ? emaSettings.ema1.period : 5;
    const ema2Period = emaSettings.ema2.enabled ? emaSettings.ema2.period : 13;
    const ema3Period = emaSettings.ema3.enabled ? emaSettings.ema3.period : 21;

    const alignment = detectEmaAlignment(candles1m, ema1Period, ema2Period, ema3Period, 5);

    const closes = candles1m.map((c) => c.close);
    const ema1Values = calculateEMAMemoized(closes, ema1Period);
    const ema2Values = calculateEMAMemoized(closes, ema2Period);
    const ema3Values = calculateEMAMemoized(closes, ema3Period);

    if (ema1Values.length === 0 || ema2Values.length === 0 || ema3Values.length === 0) {
      return null;
    }

    const idx = ema1Values.length - 1;
    const ema1 = ema1Values[idx];
    const ema2 = ema2Values[idx];
    const ema3 = ema3Values[idx];

    let trend: 'uptrend' | 'downtrend' | 'indecisive';
    if (ema1 > ema2 && ema2 > ema3) {
      trend = 'uptrend';
    } else if (ema1 < ema2 && ema2 < ema3) {
      trend = 'downtrend';
    } else {
      trend = 'indecisive';
    }

    return {
      trend,
      alignment,
      ema1,
      ema2,
      ema3,
    };
  }, [candles1m, emaSettings]);

  const macdStats = useMemo(() => {
    if (!macdSettings.showMultiTimeframe) return [];

    const stats: Array<{
      timeframe: string;
      macd: number;
      signal: number;
      histogram: number;
      trend: TrendDirection;
      turnPoint: MacdTurnPoint;
    }> = [];

    const candlesByTimeframe: Record<string, any[] | undefined> = {
      '1m': candles1m,
      '5m': candles5m,
      '15m': candles15m,
      '1h': candles1h,
    };

    Object.entries(macdSettings.timeframes).forEach(([tf, settings]) => {
      if (!settings.enabled) return;

      const candleData = candlesByTimeframe[tf];
      if (!candleData || candleData.length === 0) return;

      const closes = candleData.map((c) => c.close);
      const macdData = calculateMACDMemoized(closes, settings.fastPeriod, settings.slowPeriod, settings.signalPeriod);

      if (macdData.macd.length === 0) return;

      const idx = macdData.macd.length - 1;
      const trend = getMacdTrend(macdData.macd[idx], macdData.signal[idx]);
      const turnPoint = detectMacdTurnPoint(macdData.histogram);

      stats.push({
        timeframe: tf,
        macd: macdData.macd[idx],
        signal: macdData.signal[idx],
        histogram: macdData.histogram[idx],
        trend,
        turnPoint,
      });
    });

    return stats;
  }, [candles1m, candles5m, candles15m, candles1h, macdSettings]);

  const volumeFlowData = useMemo(() => {
    const mappedTrades = trades.map((t: Trade) => ({
      price: t.price,
      qty: t.size,
      isBuyerMaker: t.side === 'sell',
      time: t.time,
    }));

    return calculateVolumeFlow(mappedTrades, 60);
  }, [trades]);

  return (
    <div className="terminal-border p-1.5">
      <div className="grid grid-cols-6 gap-3 text-[10px] font-mono">
        {/* Stochastic Section - Columns 1-2 */}
        {stochasticStats.length > 0 && (
          <div className="col-span-2">
            <div className="text-primary-muted uppercase tracking-wider font-bold mb-0.5">STOCHASTIC (1m)</div>
            <div className="flex items-center gap-2 flex-wrap">
              {stochasticStats.map((stat, idx) => {
                const zoneColor =
                  stat.zone === 'overbought'
                    ? 'text-bearish'
                    : stat.zone === 'oversold'
                    ? 'text-bullish'
                    : 'text-primary-muted';

                const variantLabel =
                  stat.variant === 'fast9' ? 'F9' :
                  stat.variant === 'fast14' ? 'F14' :
                  stat.variant === 'fast40' ? 'F40' :
                  stat.variant === 'full60' ? 'FL60' : stat.variant;

                return (
                  <div key={stat.variant} className="flex items-center gap-0.5">
                    {idx > 0 && <span className="text-primary-muted/40 mr-1">|</span>}
                    <span className="text-primary-muted">{variantLabel}</span>
                    <TrendArrow direction={stat.trend} />
                    <span className={zoneColor}>
                      {formatNumber(stat.k, 0)}/{formatNumber(stat.d, 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* EMA Section - Column 3 (aligns with 24H CHANGE) */}
        {emaSignal && (
          <div className="col-start-3">
            <div className="text-primary-muted uppercase tracking-wider font-bold mb-0.5">EMA TREND</div>
            <div className="flex items-center gap-1.5">
              {emaSignal.trend === 'indecisive' ? (
                <span className="text-primary-muted">─</span>
              ) : (
                <TrendArrow direction={emaSignal.trend === 'uptrend' ? 'up' : 'down'} />
              )}
              <span className={
                emaSignal.trend === 'uptrend'
                  ? 'text-bullish font-bold'
                  : emaSignal.trend === 'downtrend'
                  ? 'text-bearish font-bold'
                  : 'text-primary-muted font-bold'
              }>
                {emaSignal.trend === 'uptrend' ? 'UPTREND' : emaSignal.trend === 'downtrend' ? 'DOWNTREND' : 'INDECISIVE'}
              </span>
              {emaSignal.alignment && (
                <span className="text-primary-muted/60 text-[9px]">
                  ({emaSignal.alignment.barsAgo === 0 ? 'x now' : `x ${emaSignal.alignment.barsAgo}b`})
                </span>
              )}
            </div>
          </div>
        )}

        {/* MACD Section - Columns 4-5 (aligns with 24H HIGH and 24H LOW) */}
        {macdStats.length > 0 && (
          <div className="col-start-4 col-span-2">
            <div className="text-primary-muted uppercase tracking-wider font-bold mb-0.5">MACD</div>
            <div className="flex items-center gap-2 flex-wrap">
              {macdStats.map((stat, idx) => {
                const histColor = stat.histogram >= 0 ? 'text-bullish' : 'text-bearish';
                const turnPointColor = stat.turnPoint === 'topped' ? 'text-accent-rose' : 'text-accent-blue';

                return (
                  <div key={stat.timeframe} className="flex items-center gap-0.5">
                    {idx > 0 && <span className="text-primary-muted/40 mr-1">|</span>}
                    <span className="text-primary-muted">{stat.timeframe}</span>
                    <TrendArrow direction={stat.trend} />
                    <span className={histColor}>
                      {stat.histogram >= 0 ? '+' : ''}
                      {formatNumber(stat.histogram, 1)}
                    </span>
                    {stat.turnPoint && (
                      <span className={`${turnPointColor} text-[9px] font-bold`}>
                        [{stat.turnPoint === 'topped' ? 'T' : 'B'}]
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Volume Flow Section - Column 6 (aligns with 24H VOLUME) */}
        <div className="col-start-6">
          <div className="text-primary-muted uppercase tracking-wider font-bold mb-0.5">VOLUME FLOW (60s)</div>
          <div className="flex items-center gap-1">
            <TrendArrow direction={volumeFlowData.trend} />
            <span className={`font-bold ${volumeFlowData.netVolume >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {volumeFlowData.netVolume >= 0 ? '+' : ''}
              {formatVolume(volumeFlowData.netVolume)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(IndicatorSignals);
