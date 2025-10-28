'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandleData, TimeInterval } from '@/types';
import { useWebSocketService } from '@/lib/websocket';

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
  const [isLoading, setIsLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const candlesBufferRef = useRef<{
    '1m': CandleData[];
    '5m': CandleData[];
    '15m': CandleData[];
  }>({
    '1m': [],
    '5m': [],
    '15m': []
  });

  useEffect(() => {
    let mounted = true;
    let resizeHandler: (() => void) | null = null;

    const initChart = async () => {
      if (!chartContainerRef.current || !mounted) return;

      try {
        const { createChart } = await import('lightweight-charts');

        if (!mounted || !chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: 250,
          layout: {
            background: { color: getComputedStyle(document.documentElement).getPropertyValue('--background-primary').trim() },
            textColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-muted').trim(),
          },
          grid: {
            vertLines: { color: getComputedStyle(document.documentElement).getPropertyValue('--primary-dark').trim() },
            horzLines: { color: getComputedStyle(document.documentElement).getPropertyValue('--primary-dark').trim() },
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
          color: '#3274aa',
          lineWidth: 2,
          title: '1m %K',
        });

        const stoch1mDSeries = chart.addLineSeries({
          color: '#29486b',
          lineWidth: 1,
          lineStyle: 2,
          title: '1m %D',
        });

        const stoch5mKSeries = chart.addLineSeries({
          color: '#c2968d',
          lineWidth: 2,
          title: '5m %K',
        });

        const stoch5mDSeries = chart.addLineSeries({
          color: '#ef5350',
          lineWidth: 1,
          lineStyle: 2,
          title: '5m %D',
        });

        const stoch15mKSeries = chart.addLineSeries({
          color: '#44baba',
          lineWidth: 2,
          title: '15m %K',
        });

        const stoch15mDSeries = chart.addLineSeries({
          color: '#244140',
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

    const fetchAllCandles = async () => {
      setIsLoading(true);
      try {
        const endTime = Date.now();
        const startTime = endTime - (24 * 60 * 60 * 1000);

        const intervals: TimeInterval[] = ['1m', '5m', '15m'];
        const responses = await Promise.all(
          intervals.map(interval =>
            fetch(`/api/candles?coin=${coin}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`)
              .then(res => res.json())
          )
        );

        candlesBufferRef.current = {
          '1m': responses[0],
          '5m': responses[1],
          '15m': responses[2]
        };

        if (stoch1mKSeriesRef.current && stoch5mKSeriesRef.current && stoch15mKSeriesRef.current) {
          const stoch1m = calculateStochastic(responses[0]);
          const stoch5m = calculateStochastic(responses[1]);
          const stoch15m = calculateStochastic(responses[2]);

          const offset1m = responses[0].length - stoch1m.length;
          const offset5m = responses[1].length - stoch5m.length;
          const offset15m = responses[2].length - stoch15m.length;

          stoch1mKSeriesRef.current.setData(stoch1m.map((s, i) => ({
            time: (responses[0][i + offset1m].time / 1000) as any,
            value: s.k,
          })));

          stoch1mDSeriesRef.current.setData(stoch1m.map((s, i) => ({
            time: (responses[0][i + offset1m].time / 1000) as any,
            value: s.d,
          })));

          stoch5mKSeriesRef.current.setData(stoch5m.map((s, i) => ({
            time: (responses[1][i + offset5m].time / 1000) as any,
            value: s.k,
          })));

          stoch5mDSeriesRef.current.setData(stoch5m.map((s, i) => ({
            time: (responses[1][i + offset5m].time / 1000) as any,
            value: s.d,
          })));

          stoch15mKSeriesRef.current.setData(stoch15m.map((s, i) => ({
            time: (responses[2][i + offset15m].time / 1000) as any,
            value: s.k,
          })));

          stoch15mDSeriesRef.current.setData(stoch15m.map((s, i) => ({
            time: (responses[2][i + offset15m].time / 1000) as any,
            value: s.d,
          })));
        }
      } catch (error) {
        console.error('Error fetching candles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllCandles();
  }, [coin, chartReady]);

  useEffect(() => {
    if (!chartReady) return;

    const { service: wsService, trackSubscription } = useWebSocketService('hyperliquid', false);
    const untrackSubscriptions: (() => void)[] = [];
    const subscriptionIds: string[] = [];
    const intervals: TimeInterval[] = ['1m', '5m', '15m'];

    intervals.forEach((interval) => {
      const untrack = trackSubscription();
      untrackSubscriptions.push(untrack);

      const subscriptionId = wsService.subscribeToCandles(
        { coin, interval },
        (candle) => {
          candlesBufferRef.current[interval] = [...candlesBufferRef.current[interval].slice(-200), candle];

          const stochData = calculateStochastic(candlesBufferRef.current[interval]);
          if (stochData.length > 0) {
            const latestStoch = stochData[stochData.length - 1];
            const time = (candle.time / 1000) as any;

            if (interval === '1m' && stoch1mKSeriesRef.current) {
              stoch1mKSeriesRef.current.update({ time, value: latestStoch.k });
              stoch1mDSeriesRef.current.update({ time, value: latestStoch.d });
            } else if (interval === '5m' && stoch5mKSeriesRef.current) {
              stoch5mKSeriesRef.current.update({ time, value: latestStoch.k });
              stoch5mDSeriesRef.current.update({ time, value: latestStoch.d });
            } else if (interval === '15m' && stoch15mKSeriesRef.current) {
              stoch15mKSeriesRef.current.update({ time, value: latestStoch.k });
              stoch15mDSeriesRef.current.update({ time, value: latestStoch.d });
            }
          }
        }
      );

      subscriptionIds.push(subscriptionId);
    });

    return () => {
      subscriptionIds.forEach(id => wsService.unsubscribe(id));
      untrackSubscriptions.forEach(untrack => untrack());
    };
  }, [coin, chartReady]);

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
          <div className="w-6 h-0.5 bg-[#3274aa]"></div>
          <span className="text-[#537270]">1m %K</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5 bg-[#29486b]" style={{ borderTop: '2px dashed #29486b', background: 'none' }}></div>
          <span className="text-[#537270]">1m %D</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5 bg-[#c2968d]"></div>
          <span className="text-[#537270]">5m %K</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5 bg-[#ef5350]" style={{ borderTop: '2px dashed #ef5350', background: 'none' }}></div>
          <span className="text-[#537270]">5m %D</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5 bg-[#44baba]"></div>
          <span className="text-[#537270]">15m %K</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5 bg-[#244140]" style={{ borderTop: '2px dashed #244140', background: 'none' }}></div>
          <span className="text-[#537270]">15m %D</span>
        </div>
        <div className="text-[#537270] ml-auto text-xs">
          OB: &gt;80 | OS: &lt;20
        </div>
      </div>
    </div>
  );
}
