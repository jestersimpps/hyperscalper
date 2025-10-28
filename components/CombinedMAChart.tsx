'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandleData, TimeInterval } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calculateEMA } from '@/lib/indicators';

interface CombinedMAChartProps {
  coin: string;
}

interface CrossoverMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
}

function detectCrossovers(ema5: number[], ema13: number[], candles: CandleData[], color: string, label: string): CrossoverMarker[] {
  const markers: CrossoverMarker[] = [];

  for (let i = 1; i < ema5.length && i < ema13.length; i++) {
    const prevEma5 = ema5[i - 1];
    const prevEma13 = ema13[i - 1];
    const currEma5 = ema5[i];
    const currEma13 = ema13[i];

    if (prevEma5 <= prevEma13 && currEma5 > currEma13) {
      markers.push({
        time: candles[i].time / 1000,
        position: 'belowBar',
        color: color,
        shape: 'arrowUp',
        text: label
      });
    } else if (prevEma5 >= prevEma13 && currEma5 < currEma13) {
      markers.push({
        time: candles[i].time / 1000,
        position: 'aboveBar',
        color: color,
        shape: 'arrowDown',
        text: label
      });
    }
  }

  return markers;
}

export default function CombinedMAChart({ coin }: CombinedMAChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const price1mSeriesRef = useRef<any>(null);
  const price5mSeriesRef = useRef<any>(null);
  const price15mSeriesRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const emaSettings = useSettingsStore((state) => state.settings.indicators.ema);
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
          height: 400,
          layout: {
            background: { color: '#1a1a1a' },
            textColor: '#d1d4dc',
          },
          grid: {
            vertLines: { color: '#2a2a2a' },
            horzLines: { color: '#2a2a2a' },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
          },
        });

        const price1mSeries = chart.addLineSeries({
          color: '#2962FF',
          lineWidth: 1,
          title: '1m Price',
        });

        const price5mSeries = chart.addLineSeries({
          color: '#FF6D00',
          lineWidth: 1,
          title: '5m Price',
        });

        const price15mSeries = chart.addLineSeries({
          color: '#00E676',
          lineWidth: 1,
          title: '15m Price',
        });

        chartRef.current = chart;
        price1mSeriesRef.current = price1mSeries;
        price5mSeriesRef.current = price5mSeries;
        price15mSeriesRef.current = price15mSeries;

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

        if (price1mSeriesRef.current && price5mSeriesRef.current && price15mSeriesRef.current) {
          price1mSeriesRef.current.setData(responses[0].map((c: CandleData) => ({
            time: (c.time / 1000) as any,
            value: c.close,
          })));

          price5mSeriesRef.current.setData(responses[1].map((c: CandleData) => ({
            time: (c.time / 1000) as any,
            value: c.close,
          })));

          price15mSeriesRef.current.setData(responses[2].map((c: CandleData) => ({
            time: (c.time / 1000) as any,
            value: c.close,
          })));

          if (emaSettings.ema1.enabled && emaSettings.ema2.enabled) {
            const closePrices1m = responses[0].map((c: CandleData) => c.close);
            const closePrices5m = responses[1].map((c: CandleData) => c.close);
            const closePrices15m = responses[2].map((c: CandleData) => c.close);

            const ema1m1 = calculateEMA(closePrices1m, emaSettings.ema1.period);
            const ema1m2 = calculateEMA(closePrices1m, emaSettings.ema2.period);
            const ema5m1 = calculateEMA(closePrices5m, emaSettings.ema1.period);
            const ema5m2 = calculateEMA(closePrices5m, emaSettings.ema2.period);
            const ema15m1 = calculateEMA(closePrices15m, emaSettings.ema1.period);
            const ema15m2 = calculateEMA(closePrices15m, emaSettings.ema2.period);

            const markers1m = detectCrossovers(ema1m1, ema1m2, responses[0], '#2962FF', '1m');
            const markers5m = detectCrossovers(ema5m1, ema5m2, responses[1], '#FF6D00', '5m');
            const markers15m = detectCrossovers(ema15m1, ema15m2, responses[2], '#00E676', '15m');

            price1mSeriesRef.current.setMarkers(markers1m);
            price5mSeriesRef.current.setMarkers(markers5m);
            price15mSeriesRef.current.setMarkers(markers15m);
          } else {
            price1mSeriesRef.current.setMarkers([]);
            price5mSeriesRef.current.setMarkers([]);
            price15mSeriesRef.current.setMarkers([]);
          }
        }
      } catch (error) {
        console.error('Error fetching candles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllCandles();
  }, [coin, chartReady, emaSettings]);

  useEffect(() => {
    if (!chartReady) return;

    const eventSources: EventSource[] = [];
    const intervals: TimeInterval[] = ['1m', '5m', '15m'];

    intervals.forEach((interval) => {
      const eventSource = new EventSource(`/api/stream?coin=${coin}&interval=${interval}`);

      eventSource.onmessage = (event) => {
        const candle: CandleData = JSON.parse(event.data);

        candlesBufferRef.current[interval] = [...candlesBufferRef.current[interval].slice(-200), candle];

        const time = (candle.time / 1000) as any;

        if (interval === '1m' && price1mSeriesRef.current) {
          price1mSeriesRef.current.update({ time, value: candle.close });

          if (emaSettings.ema1.enabled && emaSettings.ema2.enabled) {
            const closePrices = candlesBufferRef.current[interval].map(c => c.close);
            const ema1 = calculateEMA(closePrices, emaSettings.ema1.period);
            const ema2 = calculateEMA(closePrices, emaSettings.ema2.period);
            const markers = detectCrossovers(ema1, ema2, candlesBufferRef.current[interval], '#2962FF', '1m');
            price1mSeriesRef.current.setMarkers(markers);
          } else {
            price1mSeriesRef.current.setMarkers([]);
          }
        } else if (interval === '5m' && price5mSeriesRef.current) {
          price5mSeriesRef.current.update({ time, value: candle.close });

          if (emaSettings.ema1.enabled && emaSettings.ema2.enabled) {
            const closePrices = candlesBufferRef.current[interval].map(c => c.close);
            const ema1 = calculateEMA(closePrices, emaSettings.ema1.period);
            const ema2 = calculateEMA(closePrices, emaSettings.ema2.period);
            const markers = detectCrossovers(ema1, ema2, candlesBufferRef.current[interval], '#FF6D00', '5m');
            price5mSeriesRef.current.setMarkers(markers);
          } else {
            price5mSeriesRef.current.setMarkers([]);
          }
        } else if (interval === '15m' && price15mSeriesRef.current) {
          price15mSeriesRef.current.update({ time, value: candle.close });

          if (emaSettings.ema1.enabled && emaSettings.ema2.enabled) {
            const closePrices = candlesBufferRef.current[interval].map(c => c.close);
            const ema1 = calculateEMA(closePrices, emaSettings.ema1.period);
            const ema2 = calculateEMA(closePrices, emaSettings.ema2.period);
            const markers = detectCrossovers(ema1, ema2, candlesBufferRef.current[interval], '#00E676', '15m');
            price15mSeriesRef.current.setMarkers(markers);
          } else {
            price15mSeriesRef.current.setMarkers([]);
          }
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
      };

      eventSources.push(eventSource);
    });

    return () => {
      eventSources.forEach(es => es.close());
    };
  }, [coin, chartReady, emaSettings]);

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a] bg-opacity-75 z-10">
          <div className="text-white">Loading chart...</div>
        </div>
      )}
      <div ref={chartContainerRef} />
      <div className="mt-2 flex gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-[#2962FF]"></div>
          <span className="text-gray-400">1m Price</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#2962FF]">↑</span>
          <span className="text-gray-400">1m Bullish Crossover</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#2962FF]">↓</span>
          <span className="text-gray-400">1m Bearish Crossover</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-[#FF6D00]"></div>
          <span className="text-gray-400">5m Price</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#FF6D00]">↑</span>
          <span className="text-gray-400">5m Bullish Crossover</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#FF6D00]">↓</span>
          <span className="text-gray-400">5m Bearish Crossover</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-[#00E676]"></div>
          <span className="text-gray-400">15m Price</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#00E676]">↑</span>
          <span className="text-gray-400">15m Bullish Crossover</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#00E676]">↓</span>
          <span className="text-gray-400">15m Bearish Crossover</span>
        </div>
      </div>
    </div>
  );
}
