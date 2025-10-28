'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandleData, TimeInterval } from '@/types';
import { useCandleStore } from '@/stores/useCandleStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getThemeColors } from '@/lib/theme-utils';

interface CombinedStochasticChartProps {
  coin: string;
  onChartReady?: (chart: any) => void;
}

interface StochasticData {
  k: number;
  d: number;
}

function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const emaArray: number[] = [];
  let ema = data[0];

  emaArray.push(ema);

  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    emaArray.push(ema);
  }

  return emaArray;
}

function calculateStochastic(candles: CandleData[], period: number = 14, smoothK: number = 3, smoothD: number = 3): StochasticData[] {
  if (!candles || candles.length < period) return [];

  const validCandles = candles.filter(c => c && typeof c.high === 'number' && typeof c.low === 'number' && typeof c.close === 'number');
  if (validCandles.length < period) return [];

  const result: StochasticData[] = [];
  const kValues: number[] = [];

  for (let i = period - 1; i < validCandles.length; i++) {
    const slice = validCandles.slice(i - period + 1, i + 1);
    if (slice.length !== period) continue;

    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const close = validCandles[i].close;

    const k = high === low ? 50 : ((close - low) / (high - low)) * 100;
    kValues.push(k);
  }

  const smoothedK: number[] = [];
  for (let i = smoothK - 1; i < kValues.length; i++) {
    const sum = kValues.slice(i - smoothK + 1, i + 1).reduce((a, b) => a + b, 0);
    smoothedK.push(sum / smoothK);
  }

  for (let i = smoothD - 1; i < smoothedK.length; i++) {
    const sum = smoothedK.slice(i - smoothD + 1, i + 1).reduce((a, b) => a + b, 0);
    const d = sum / smoothD;
    result.push({
      k: smoothedK[i],
      d: d
    });
  }

  return result;
}

export default function CombinedStochasticChart({ coin, onChartReady }: CombinedStochasticChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRefsRef = useRef<Record<string, { k: any; d: any }>>({});
  const [chartReady, setChartReady] = useState(false);

  const stochasticSettings = useSettingsStore((state) => state.settings.indicators.stochastic);

  const enabledTimeframes = Object.entries(stochasticSettings.timeframes)
    .filter(([_, config]) => config.enabled && stochasticSettings.showMultiTimeframe)
    .map(([tf]) => tf as TimeInterval);

  const allCandles = useCandleStore((state) => state.candles);
  const allLoading = useCandleStore((state) => state.loading);

  const isLoading = enabledTimeframes.some(tf => allLoading[`${coin}-${tf}`]);

  useEffect(() => {
    let mounted = true;
    let resizeHandler: (() => void) | null = null;

    const initChart = async () => {
      if (!chartContainerRef.current || !mounted) return;

      try {
        const { createChart } = await import('lightweight-charts');

        if (!mounted || !chartContainerRef.current) return;

        const colors = getThemeColors();

        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: 250,
          layout: {
            background: { color: colors.backgroundPrimary },
            textColor: colors.primaryMuted,
          },
          grid: {
            vertLines: { color: colors.primaryDark },
            horzLines: { color: colors.primaryDark },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 12,
            barSpacing: 6,
            fixLeftEdge: false,
            fixRightEdge: false,
          },
          rightPriceScale: {
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          },
        });

        const timeframeColors: Record<string, { k: string; d: string }> = {
          '1m': { k: colors.accentBlue, d: colors.accentBlueDark },
          '5m': { k: colors.accentRose, d: colors.statusBearish },
          '15m': { k: colors.primary, d: colors.primaryDark },
          '30m': { k: colors.statusBullish, d: colors.primaryMuted },
          '1h': { k: colors.accentBlue, d: colors.accentBlueDark },
          '4h': { k: colors.accentRose, d: colors.statusBearish },
        };

        seriesRefsRef.current = {};

        enabledTimeframes.forEach((timeframe) => {
          const kSeries = chart.addLineSeries({
            color: timeframeColors[timeframe].k,
            lineWidth: 2,
            title: `${timeframe} %K`,
          });

          const dSeries = chart.addLineSeries({
            color: timeframeColors[timeframe].d,
            lineWidth: 1,
            lineStyle: 2,
            title: `${timeframe} %D`,
          });

          seriesRefsRef.current[timeframe] = { k: kSeries, d: dSeries };
        });

        chartRef.current = chart;

        resizeHandler = () => {
          if (chartContainerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
            });
          }
        };

        window.addEventListener('resize', resizeHandler);

        if (mounted) {
          setChartReady(true);
          if (onChartReady) {
            onChartReady(chart);
          }
        }
      } catch (error) {
        console.error('Error initializing chart:', error);
      }
    };

    initChart();

    return () => {
      mounted = false;
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [enabledTimeframes.join(','), stochasticSettings.showMultiTimeframe]);

  useEffect(() => {
    if (!chartReady || enabledTimeframes.length === 0) return;

    const endTime = Date.now();
    const startTime = endTime - (24 * 60 * 60 * 1000);

    const { fetchCandles, subscribeToCandles } = useCandleStore.getState();

    enabledTimeframes.forEach(interval => {
      fetchCandles(coin, interval, startTime, endTime);
      subscribeToCandles(coin, interval);
    });

    return () => {
      const { unsubscribeFromCandles } = useCandleStore.getState();
      enabledTimeframes.forEach(interval => {
        unsubscribeFromCandles(coin, interval);
      });
    };
  }, [coin, chartReady, enabledTimeframes.join(',')]);

  useEffect(() => {
    if (!chartReady || Object.keys(seriesRefsRef.current).length === 0) return;

    enabledTimeframes.forEach((timeframe) => {
      const candles = allCandles[`${coin}-${timeframe}`];
      if (!candles || candles.length === 0) return;

      const config = stochasticSettings.timeframes[timeframe];
      if (!config) return;

      const validCandles = candles.filter(c => c && typeof c.high === 'number' && typeof c.low === 'number' && typeof c.close === 'number');
      if (validCandles.length === 0) return;

      const stochData = calculateStochastic(validCandles, config.period, config.smoothK, config.smoothD);

      if (stochData.length > 0 && seriesRefsRef.current[timeframe]) {
        const offset = validCandles.length - stochData.length;

        seriesRefsRef.current[timeframe].k.setData(stochData.map((s, i) => ({
          time: (validCandles[i + offset].time / 1000) as any,
          value: s.k,
        })));

        seriesRefsRef.current[timeframe].d.setData(stochData.map((s, i) => ({
          time: (validCandles[i + offset].time / 1000) as any,
          value: s.d,
        })));
      }
    });
  }, [chartReady, enabledTimeframes.join(','), allCandles, stochasticSettings, coin]);

  const timeframeColorVars: Record<string, { k: string; d: string }> = {
    '1m': { k: 'var(--accent-blue)', d: 'var(--accent-blue-dark)' },
    '5m': { k: 'var(--accent-rose)', d: 'var(--status-bearish)' },
    '15m': { k: 'var(--primary)', d: 'var(--primary-dark)' },
    '30m': { k: 'var(--status-bullish)', d: 'var(--primary-muted)' },
    '1h': { k: 'var(--accent-blue)', d: 'var(--accent-blue-dark)' },
    '4h': { k: 'var(--accent-rose)', d: 'var(--status-bearish)' },
  };

  if (!stochasticSettings.showMultiTimeframe) {
    return (
      <div className="relative h-[250px] flex items-center justify-center">
        <div className="text-primary-muted text-xs">Multi-timeframe stochastics disabled</div>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary bg-opacity-90 z-10">
          <div className="text-primary">Loading chart...</div>
        </div>
      )}
      <div ref={chartContainerRef} />
      <div className="mt-1 flex gap-3 text-xs flex-wrap">
        {enabledTimeframes.map((timeframe) => (
          <div key={timeframe} className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5" style={{ backgroundColor: timeframeColorVars[timeframe].k }}></div>
              <span className="text-primary-muted">{timeframe} %K</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5" style={{ borderTop: `2px dashed ${timeframeColorVars[timeframe].d}`, background: 'none' }}></div>
              <span className="text-primary-muted">{timeframe} %D</span>
            </div>
          </div>
        ))}
        <div className="text-primary-muted ml-auto text-xs">
          OB: &gt;{stochasticSettings.overboughtLevel} | OS: &lt;{stochasticSettings.oversoldLevel}
        </div>
      </div>
    </div>
  );
}
