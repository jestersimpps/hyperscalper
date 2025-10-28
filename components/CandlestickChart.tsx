'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandleData, TimeInterval } from '@/types';
import { useCandleStore } from '@/stores/useCandleStore';
import { getThemeColors } from '@/lib/theme-utils';

interface CandlestickChartProps {
  coin: string;
  interval: TimeInterval;
  onPriceUpdate?: (price: number) => void;
  onChartReady?: (chart: any) => void;
}

interface CrossoverMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
}

function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const emaArray: number[] = [];

  if (data.length === 0) return emaArray;

  let ema = data[0];
  emaArray.push(ema);

  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    emaArray.push(ema);
  }

  return emaArray;
}

function detectCrossovers(ema5: number[], ema13: number[], candles: CandleData[]): CrossoverMarker[] {
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
        color: 'var(--primary)',
        shape: 'arrowUp',
        text: 'Buy'
      });
    } else if (prevEma5 >= prevEma13 && currEma5 < currEma13) {
      markers.push({
        time: candles[i].time / 1000,
        position: 'aboveBar',
        color: 'var(--status-bearish)',
        shape: 'arrowDown',
        text: 'Sell'
      });
    }
  }

  return markers;
}


export default function CandlestickChart({ coin, interval, onPriceUpdate, onChartReady }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const ema5SeriesRef = useRef<any>(null);
  const ema13SeriesRef = useRef<any>(null);
  const [chartReady, setChartReady] = useState(false);
  const candlesBufferRef = useRef<CandleData[]>([]);
  const markersRef = useRef<CrossoverMarker[]>([]);
  const lastEmaRef = useRef<{ ema5: number; ema13: number } | null>(null);
  const lastCandleTimeRef = useRef<number | null>(null);

  const candleKey = `${coin}-${interval}`;
  const candles = useCandleStore((state) => state.candles[candleKey]) || [];
  const isLoading = useCandleStore((state) => state.loading[candleKey]) || false;

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
          height: 350,
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
              bottom: 0.2,
            },
          },
        });

        const candleSeries = chart.addCandlestickSeries({
          upColor: colors.statusBullish,
          downColor: colors.statusBearish,
          borderVisible: false,
          wickUpColor: colors.statusBullish,
          wickDownColor: colors.statusBearish,
        });

        const volumeSeries = chart.addHistogramSeries({
          color: colors.statusBullish,
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '',
        });

        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.7,
            bottom: 0,
          },
        });

        const ema5Series = chart.addLineSeries({
          color: colors.accentBlue,
          lineWidth: 2,
          title: '5 EMA',
        });

        const ema13Series = chart.addLineSeries({
          color: colors.accentRose,
          lineWidth: 2,
          title: '13 EMA',
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;
        ema5SeriesRef.current = ema5Series;
        ema13SeriesRef.current = ema13Series;

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
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
        ema5SeriesRef.current = null;
        ema13SeriesRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!chartReady) return;

    const endTime = Date.now();
    const startTime = endTime - (24 * 60 * 60 * 1000);

    const { fetchCandles, subscribeToCandles, unsubscribeFromCandles } = useCandleStore.getState();
    fetchCandles(coin, interval, startTime, endTime);
    subscribeToCandles(coin, interval);

    return () => {
      const { unsubscribeFromCandles } = useCandleStore.getState();
      unsubscribeFromCandles(coin, interval);
    };
  }, [coin, interval, chartReady]);

  useEffect(() => {
    if (!chartReady || !candleSeriesRef.current || candles.length === 0) return;

    candlesBufferRef.current = candles;

    const candleData = candles.map(c => ({
      time: (c.time / 1000) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const colors = getThemeColors();
    const volumeData = candles.map(c => ({
      time: (c.time / 1000) as any,
      value: c.volume,
      color: c.close >= c.open ? colors.statusBullish + '80' : colors.statusBearish + '80',
    }));

    const closePrices = candles.map(c => c.close);
    const ema5 = calculateEMA(closePrices, 5);
    const ema13 = calculateEMA(closePrices, 13);

    if (ema5.length > 0 && ema13.length > 0) {
      const currentEma5 = ema5[ema5.length - 1];
      const currentEma13 = ema13[ema13.length - 1];

      const lastCandle = candles[candles.length - 1];
      const isNewCandle = lastCandleTimeRef.current !== null && lastCandle.time !== lastCandleTimeRef.current;

      if (isNewCandle || lastCandleTimeRef.current === null) {
        const markers = detectCrossovers(ema5, ema13, candles);
        markersRef.current = markers;
        candleSeriesRef.current.setData(candleData);
        volumeSeriesRef.current.setData(volumeData);

        const ema5Data = ema5.map((value, i) => ({
          time: (candles[i].time / 1000) as any,
          value,
        }));

        const ema13Data = ema13.map((value, i) => ({
          time: (candles[i].time / 1000) as any,
          value,
        }));

        ema5SeriesRef.current.setData(ema5Data);
        ema13SeriesRef.current.setData(ema13Data);
        candleSeriesRef.current.setMarkers(markers);
      } else {
        candleSeriesRef.current.update(candleData[candleData.length - 1]);
        volumeSeriesRef.current.update(volumeData[volumeData.length - 1]);
        ema5SeriesRef.current.update({
          time: (lastCandle.time / 1000) as any,
          value: currentEma5,
        });
        ema13SeriesRef.current.update({
          time: (lastCandle.time / 1000) as any,
          value: currentEma13,
        });
      }

      lastEmaRef.current = {
        ema5: currentEma5,
        ema13: currentEma13
      };

      lastCandleTimeRef.current = lastCandle.time;

      if (onPriceUpdate) {
        onPriceUpdate(lastCandle.close);
      }
    }
  }, [candles, chartReady, onPriceUpdate]);

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
          <span className="text-primary-muted">5 EMA</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--accent-rose)' }}></div>
          <span className="text-primary-muted">13 EMA</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-primary">↑</span>
          <span className="text-primary-muted">Buy</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-bearish">↓</span>
          <span className="text-primary-muted">Sell</span>
        </div>
      </div>
    </div>
  );
}
