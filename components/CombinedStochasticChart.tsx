'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandleData, TimeInterval } from '@/types';
import { useCandleStore } from '@/stores/useCandleStore';
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
  if (candles.length < period) return [];

  const result: StochasticData[] = [];
  const kValues: number[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const close = candles[i].close;

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
  const stoch1mKSeriesRef = useRef<any>(null);
  const stoch1mDSeriesRef = useRef<any>(null);
  const stoch5mKSeriesRef = useRef<any>(null);
  const stoch5mDSeriesRef = useRef<any>(null);
  const stoch15mKSeriesRef = useRef<any>(null);
  const stoch15mDSeriesRef = useRef<any>(null);
  const [chartReady, setChartReady] = useState(false);

  const candles1m = useCandleStore((state) => state.candles[`${coin}-1m`]) || [];
  const candles5m = useCandleStore((state) => state.candles[`${coin}-5m`]) || [];
  const candles15m = useCandleStore((state) => state.candles[`${coin}-15m`]) || [];
  const loading1m = useCandleStore((state) => state.loading[`${coin}-1m`]) || false;
  const loading5m = useCandleStore((state) => state.loading[`${coin}-5m`]) || false;
  const loading15m = useCandleStore((state) => state.loading[`${coin}-15m`]) || false;
  const isLoading = loading1m || loading5m || loading15m;

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

        const stoch1mKSeries = chart.addLineSeries({
          color: colors.accentBlue,
          lineWidth: 2,
          title: '1m %K',
        });

        const stoch1mDSeries = chart.addLineSeries({
          color: colors.accentBlueDark,
          lineWidth: 1,
          lineStyle: 2,
          title: '1m %D',
        });

        const stoch5mKSeries = chart.addLineSeries({
          color: colors.accentRose,
          lineWidth: 2,
          title: '5m %K',
        });

        const stoch5mDSeries = chart.addLineSeries({
          color: colors.statusBearish,
          lineWidth: 1,
          lineStyle: 2,
          title: '5m %D',
        });

        const stoch15mKSeries = chart.addLineSeries({
          color: colors.primary,
          lineWidth: 2,
          title: '15m %K',
        });

        const stoch15mDSeries = chart.addLineSeries({
          color: colors.primaryDark,
          lineWidth: 1,
          lineStyle: 2,
          title: '15m %D',
        });

        chartRef.current = chart;
        stoch1mKSeriesRef.current = stoch1mKSeries;
        stoch1mDSeriesRef.current = stoch1mDSeries;
        stoch5mKSeriesRef.current = stoch5mKSeries;
        stoch5mDSeriesRef.current = stoch5mDSeries;
        stoch15mKSeriesRef.current = stoch15mKSeries;
        stoch15mDSeriesRef.current = stoch15mDSeries;

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
  }, []);

  useEffect(() => {
    if (!chartReady) return;

    const endTime = Date.now();
    const startTime = endTime - (24 * 60 * 60 * 1000);

    const intervals: TimeInterval[] = ['1m', '5m', '15m'];
    const { fetchCandles, subscribeToCandles } = useCandleStore.getState();

    intervals.forEach(interval => {
      fetchCandles(coin, interval, startTime, endTime);
      subscribeToCandles(coin, interval);
    });

    return () => {
      const { unsubscribeFromCandles } = useCandleStore.getState();
      intervals.forEach(interval => {
        unsubscribeFromCandles(coin, interval);
      });
    };
  }, [coin, chartReady]);

  useEffect(() => {
    if (!chartReady || !stoch1mKSeriesRef.current || candles1m.length === 0) return;

    const stoch1m = calculateStochastic(candles1m);
    const stoch5m = calculateStochastic(candles5m);
    const stoch15m = calculateStochastic(candles15m);

    if (stoch1m.length > 0) {
      const offset1m = candles1m.length - stoch1m.length;
      stoch1mKSeriesRef.current.setData(stoch1m.map((s, i) => ({
        time: (candles1m[i + offset1m].time / 1000) as any,
        value: s.k,
      })));
      stoch1mDSeriesRef.current.setData(stoch1m.map((s, i) => ({
        time: (candles1m[i + offset1m].time / 1000) as any,
        value: s.d,
      })));
    }

    if (stoch5m.length > 0) {
      const offset5m = candles5m.length - stoch5m.length;
      stoch5mKSeriesRef.current.setData(stoch5m.map((s, i) => ({
        time: (candles5m[i + offset5m].time / 1000) as any,
        value: s.k,
      })));
      stoch5mDSeriesRef.current.setData(stoch5m.map((s, i) => ({
        time: (candles5m[i + offset5m].time / 1000) as any,
        value: s.d,
      })));
    }

    if (stoch15m.length > 0) {
      const offset15m = candles15m.length - stoch15m.length;
      stoch15mKSeriesRef.current.setData(stoch15m.map((s, i) => ({
        time: (candles15m[i + offset15m].time / 1000) as any,
        value: s.k,
      })));
      stoch15mDSeriesRef.current.setData(stoch15m.map((s, i) => ({
        time: (candles15m[i + offset15m].time / 1000) as any,
        value: s.d,
      })));
    }
  }, [candles1m, candles5m, candles15m, chartReady]);

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary bg-opacity-90 z-10">
          <div className="text-primary">Loading chart...</div>
        </div>
      )}
      <div ref={chartContainerRef} />
      <div className="mt-1 flex gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--accent-blue)' }}></div>
          <span className="text-primary-muted">1m %K</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5" style={{ borderTop: '2px dashed var(--accent-blue-dark)', background: 'none' }}></div>
          <span className="text-primary-muted">1m %D</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--accent-rose)' }}></div>
          <span className="text-primary-muted">5m %K</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5" style={{ borderTop: '2px dashed var(--status-bearish)', background: 'none' }}></div>
          <span className="text-primary-muted">5m %D</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--primary)' }}></div>
          <span className="text-primary-muted">15m %K</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5" style={{ borderTop: '2px dashed var(--primary-dark)', background: 'none' }}></div>
          <span className="text-primary-muted">15m %D</span>
        </div>
        <div className="text-primary-muted ml-auto text-xs">
          OB: &gt;80 | OS: &lt;20
        </div>
      </div>
    </div>
  );
}
