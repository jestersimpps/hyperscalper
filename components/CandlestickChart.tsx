'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandleData, TimeInterval } from '@/types';
import { useWebSocketService } from '@/lib/websocket';

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
        color: '#44baba',
        shape: 'arrowUp',
        text: 'Buy'
      });
    } else if (prevEma5 >= prevEma13 && currEma5 < currEma13) {
      markers.push({
        time: candles[i].time / 1000,
        position: 'aboveBar',
        color: '#ef5350',
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
  const [isLoading, setIsLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const candlesBufferRef = useRef<CandleData[]>([]);
  const markersRef = useRef<CrossoverMarker[]>([]);
  const lastEmaRef = useRef<{ ema5: number; ema13: number } | null>(null);
  const lastCandleTimeRef = useRef<number | null>(null);

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
          height: 350,
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
              bottom: 0.2,
            },
          },
        });

        const candleSeries = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });

        const volumeSeries = chart.addHistogramSeries({
          color: '#26a69a',
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
          color: '#3274aa',
          lineWidth: 2,
          title: '5 EMA',
        });

        const ema13Series = chart.addLineSeries({
          color: '#c2968d',
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

    const fetchCandles = async () => {
      setIsLoading(true);
      try {
        const endTime = Date.now();
        const startTime = endTime - (24 * 60 * 60 * 1000);

        const response = await fetch(
          `/api/candles?coin=${coin}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`
        );
        const candles: CandleData[] = await response.json();

        candlesBufferRef.current = candles;

        if (candleSeriesRef.current && volumeSeriesRef.current && ema5SeriesRef.current && ema13SeriesRef.current) {
          const candleData = candles.map(c => ({
            time: (c.time / 1000) as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));

          const volumeData = candles.map(c => ({
            time: (c.time / 1000) as any,
            value: c.volume,
            color: c.close >= c.open ? '#26a69a80' : '#ef535080',
          }));

          const closePrices = candles.map(c => c.close);
          const ema5 = calculateEMA(closePrices, 5);
          const ema13 = calculateEMA(closePrices, 13);
          const markers = detectCrossovers(ema5, ema13, candles);

          markersRef.current = markers;
          if (ema5.length > 0 && ema13.length > 0) {
            lastEmaRef.current = {
              ema5: ema5[ema5.length - 1],
              ema13: ema13[ema13.length - 1]
            };
          }

          if (candles.length > 0) {
            lastCandleTimeRef.current = candles[candles.length - 1].time;
          }

          const ema5Data = ema5.map((value, i) => ({
            time: (candles[i].time / 1000) as any,
            value,
          }));

          const ema13Data = ema13.map((value, i) => ({
            time: (candles[i].time / 1000) as any,
            value,
          }));

          candleSeriesRef.current.setData(candleData);
          volumeSeriesRef.current.setData(volumeData);
          ema5SeriesRef.current.setData(ema5Data);
          ema13SeriesRef.current.setData(ema13Data);
          candleSeriesRef.current.setMarkers(markers);
        }
      } catch (error) {
        console.error('Error fetching candles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCandles();
  }, [coin, interval, chartReady]);

  useEffect(() => {
    if (!chartReady) return;

    const { service: wsService, trackSubscription } = useWebSocketService('hyperliquid', false);
    const untrackSubscription = trackSubscription();

    const subscriptionId = wsService.subscribeToCandles(
      { coin, interval },
      (candle) => {
        const isNewCandle = lastCandleTimeRef.current !== null && candle.time !== lastCandleTimeRef.current;

        if (isNewCandle) {
          candlesBufferRef.current = [...candlesBufferRef.current.slice(-200), candle];
        } else {
          const buffer = [...candlesBufferRef.current];
          if (buffer.length > 0) {
            buffer[buffer.length - 1] = candle;
          } else {
            buffer.push(candle);
          }
          candlesBufferRef.current = buffer;
        }

        lastCandleTimeRef.current = candle.time;

        if (candleSeriesRef.current && volumeSeriesRef.current && ema5SeriesRef.current && ema13SeriesRef.current) {
          const candleData = {
            time: (candle.time / 1000) as any,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          };

          const volumeData = {
            time: (candle.time / 1000) as any,
            value: candle.volume,
            color: candle.close >= candle.open ? '#26a69a80' : '#ef535080',
          };

          candleSeriesRef.current.update(candleData);
          volumeSeriesRef.current.update(volumeData);

          const closePrices = candlesBufferRef.current.map(c => c.close);
          const ema5 = calculateEMA(closePrices, 5);
          const ema13 = calculateEMA(closePrices, 13);

          if (ema5.length > 0 && ema13.length > 0) {
            const currentEma5 = ema5[ema5.length - 1];
            const currentEma13 = ema13[ema13.length - 1];

            ema5SeriesRef.current.update({
              time: (candle.time / 1000) as any,
              value: currentEma5,
            });
            ema13SeriesRef.current.update({
              time: (candle.time / 1000) as any,
              value: currentEma13,
            });

            if (isNewCandle && lastEmaRef.current) {
              const prevEma5 = lastEmaRef.current.ema5;
              const prevEma13 = lastEmaRef.current.ema13;

              if (prevEma5 <= prevEma13 && currentEma5 > currentEma13) {
                markersRef.current.push({
                  time: candle.time / 1000,
                  position: 'belowBar',
                  color: '#44baba',
                  shape: 'arrowUp',
                  text: 'Buy'
                });
                candleSeriesRef.current.setMarkers([...markersRef.current]);
              } else if (prevEma5 >= prevEma13 && currentEma5 < currentEma13) {
                markersRef.current.push({
                  time: candle.time / 1000,
                  position: 'aboveBar',
                  color: '#ef5350',
                  shape: 'arrowDown',
                  text: 'Sell'
                });
                candleSeriesRef.current.setMarkers([...markersRef.current]);
              }
            }

            if (isNewCandle) {
              lastEmaRef.current = {
                ema5: currentEma5,
                ema13: currentEma13
              };
            }
          }

          if (onPriceUpdate) {
            onPriceUpdate(candle.close);
          }
        }
      }
    );

    return () => {
      wsService.unsubscribe(subscriptionId);
      untrackSubscription();
    };
  }, [coin, interval, onPriceUpdate, chartReady]);

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
          <span className="text-[#537270]">5 EMA</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5 bg-[#c2968d]"></div>
          <span className="text-[#537270]">13 EMA</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[#44baba]">↑</span>
          <span className="text-[#537270]">Buy</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[#ef5350]">↓</span>
          <span className="text-[#537270]">Sell</span>
        </div>
      </div>
    </div>
  );
}
