'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandleData, TimeInterval } from '@/types';
import { useCandleStore } from '@/stores/useCandleStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getThemeColors } from '@/lib/theme-utils';
import { calculateEMA, calculateMACD } from '@/lib/indicators';
import { getStandardTimeWindow } from '@/lib/time-utils';

interface ScalpingChartProps {
  coin: string;
  interval: TimeInterval;
  onPriceUpdate?: (price: number) => void;
  onChartReady?: (chart: any) => void;
  candleData?: CandleData[];
  isExternalData?: boolean;
  stochasticCandleData?: Record<TimeInterval, CandleData[]>;
}

interface CrossoverMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
}

interface StochasticData {
  k: number;
  d: number;
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
        color: 'var(--status-bullish)',
        shape: 'arrowUp',
        text: 'EMA BUY'
      });
    } else if (prevEma5 >= prevEma13 && currEma5 < currEma13) {
      markers.push({
        time: candles[i].time / 1000,
        position: 'aboveBar',
        color: 'var(--status-bearish)',
        shape: 'arrowDown',
        text: 'EMA SELL'
      });
    }
  }

  return markers;
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

export default function ScalpingChart({ coin, interval, onPriceUpdate, onChartReady, candleData, isExternalData = false, stochasticCandleData }: ScalpingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const ema1SeriesRef = useRef<any>(null);
  const ema2SeriesRef = useRef<any>(null);
  const ema3SeriesRef = useRef<any>(null);
  const macdLineSeriesRef = useRef<any>(null);
  const macdSignalSeriesRef = useRef<any>(null);
  const macdHistogramSeriesRef = useRef<any>(null);
  const stochSeriesRefsRef = useRef<Record<string, { k: any; d: any }>>({});
  const [chartReady, setChartReady] = useState(false);
  const candlesBufferRef = useRef<CandleData[]>([]);
  const lastCandleTimeRef = useRef<number | null>(null);

  const candleKey = `${coin}-${interval}`;
  const storeCandles = useCandleStore((state) => state.candles[candleKey]) || [];
  const storeLoading = useCandleStore((state) => state.loading[candleKey]) || false;

  const candles = isExternalData && candleData ? candleData : storeCandles;
  const isLoading = isExternalData ? false : storeLoading;
  const emaSettings = useSettingsStore((state) => state.settings.indicators.ema);
  const stochasticSettings = useSettingsStore((state) => state.settings.indicators.stochastic);
  const macdSettings = useSettingsStore((state) => state.settings.indicators.macd);

  const enabledTimeframes = Object.entries(stochasticSettings.timeframes)
    .filter(([_, config]) => config.enabled && stochasticSettings.showMultiTimeframe)
    .map(([tf]) => tf as TimeInterval);

  const storeStochCandles = useCandleStore((state) => state.candles);
  const allStochCandles = isExternalData && stochasticCandleData ? stochasticCandleData : storeStochCandles;

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
          height: chartContainerRef.current.clientHeight || 600,
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
            width: 60,
            scaleMargins: {
              top: 0.1,
              bottom: 0.4,
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
            top: 0.85,
            bottom: 0,
          },
        });

        const ema1Series = chart.addLineSeries({
          color: colors.accentBlue,
          lineWidth: 2,
          title: 'EMA 1',
        });

        const ema2Series = chart.addLineSeries({
          color: colors.accentRose,
          lineWidth: 2,
          title: 'EMA 2',
        });

        const ema3Series = chart.addLineSeries({
          color: colors.accentGreen,
          lineWidth: 2,
          title: 'EMA 3',
        });

        // MACD series
        const macdLineSeries = chart.addLineSeries({
          color: colors.accentBlue,
          lineWidth: 2,
          title: 'MACD',
          priceScaleId: 'macd',
        });

        const macdSignalSeries = chart.addLineSeries({
          color: colors.accentRose,
          lineWidth: 2,
          title: 'Signal',
          priceScaleId: 'macd',
        });

        const macdHistogramSeries = chart.addHistogramSeries({
          color: colors.primary,
          priceScaleId: 'macd',
        });

        macdLineSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.55,
            bottom: 0.35,
          },
        });

        macdSignalSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.55,
            bottom: 0.35,
          },
        });

        macdHistogramSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.55,
            bottom: 0.35,
          },
        });

        // Stochastic series
        const timeframeColors: Record<string, { k: string; d: string }> = {
          '1m': { k: colors.accentBlue, d: colors.accentBlue },
          '5m': { k: colors.accentRose, d: colors.accentRose },
          '15m': { k: colors.primary, d: colors.primary },
          '30m': { k: colors.statusBullish, d: colors.statusBullish },
          '1h': { k: colors.accentBlue, d: colors.accentBlue },
          '4h': { k: colors.accentRose, d: colors.accentRose },
        };

        stochSeriesRefsRef.current = {};

        enabledTimeframes.forEach((timeframe) => {
          const kSeries = chart.addLineSeries({
            color: timeframeColors[timeframe].k,
            lineWidth: 2,
            title: `${timeframe} %K`,
            priceScaleId: 'stoch',
          });

          const dSeries = chart.addLineSeries({
            color: timeframeColors[timeframe].d,
            lineWidth: 1,
            lineStyle: 2,
            title: `${timeframe} %D`,
            priceScaleId: 'stoch',
          });

          kSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.75,
              bottom: 0,
            },
          });

          dSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.75,
              bottom: 0,
            },
          });

          stochSeriesRefsRef.current[timeframe] = { k: kSeries, d: dSeries };
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;
        ema1SeriesRef.current = ema1Series;
        ema2SeriesRef.current = ema2Series;
        ema3SeriesRef.current = ema3Series;
        macdLineSeriesRef.current = macdLineSeries;
        macdSignalSeriesRef.current = macdSignalSeries;
        macdHistogramSeriesRef.current = macdHistogramSeries;

        resizeHandler = () => {
          if (chartContainerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
              height: chartContainerRef.current.clientHeight || 600,
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
        ema1SeriesRef.current = null;
        ema2SeriesRef.current = null;
        ema3SeriesRef.current = null;
        macdLineSeriesRef.current = null;
        macdSignalSeriesRef.current = null;
        macdHistogramSeriesRef.current = null;
      }
    };
  }, [enabledTimeframes.join(','), stochasticSettings.showMultiTimeframe]);

  useEffect(() => {
    if (!chartReady || isExternalData) return;

    const { startTime, endTime } = getStandardTimeWindow();
    const { fetchCandles, subscribeToCandles, unsubscribeFromCandles } = useCandleStore.getState();
    fetchCandles(coin, interval, startTime, endTime);
    subscribeToCandles(coin, interval);

    // Fetch stochastic data
    if (stochasticSettings.showMultiTimeframe) {
      enabledTimeframes.forEach(tf => {
        fetchCandles(coin, tf, startTime, endTime);
        subscribeToCandles(coin, tf);
      });
    }

    return () => {
      const { unsubscribeFromCandles } = useCandleStore.getState();
      unsubscribeFromCandles(coin, interval);

      if (stochasticSettings.showMultiTimeframe) {
        enabledTimeframes.forEach(tf => {
          unsubscribeFromCandles(coin, tf);
        });
      }
    };
  }, [coin, interval, chartReady, isExternalData, enabledTimeframes.join(','), stochasticSettings.showMultiTimeframe]);

  useEffect(() => {
    lastCandleTimeRef.current = null;
  }, [interval]);

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
    const ema1 = emaSettings.ema1.enabled ? calculateEMA(closePrices, emaSettings.ema1.period) : [];
    const ema2 = emaSettings.ema2.enabled ? calculateEMA(closePrices, emaSettings.ema2.period) : [];
    const ema3 = emaSettings.ema3.enabled ? calculateEMA(closePrices, emaSettings.ema3.period) : [];

    const macdResult = macdSettings.enabled
      ? calculateMACD(closePrices, macdSettings.fastPeriod, macdSettings.slowPeriod, macdSettings.signalPeriod)
      : { macd: [], signal: [], histogram: [] };

    const lastCandle = candles[candles.length - 1];
    const isNewCandle = lastCandleTimeRef.current !== null && lastCandle.time !== lastCandleTimeRef.current;

    if (isNewCandle || lastCandleTimeRef.current === null) {
      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);

      if (emaSettings.ema1.enabled && ema1.length > 0) {
        const ema1Data = ema1.map((value, i) => ({
          time: (candles[i].time / 1000) as any,
          value,
        }));
        ema1SeriesRef.current.setData(ema1Data);
      } else {
        ema1SeriesRef.current.setData([]);
      }

      if (emaSettings.ema2.enabled && ema2.length > 0) {
        const ema2Data = ema2.map((value, i) => ({
          time: (candles[i].time / 1000) as any,
          value,
        }));
        ema2SeriesRef.current.setData(ema2Data);
      } else {
        ema2SeriesRef.current.setData([]);
      }

      if (emaSettings.ema3.enabled && ema3.length > 0) {
        const ema3Data = ema3.map((value, i) => ({
          time: (candles[i].time / 1000) as any,
          value,
        }));
        ema3SeriesRef.current.setData(ema3Data);
      } else {
        ema3SeriesRef.current.setData([]);
      }

      if (macdSettings.enabled && macdResult.macd.length > 0) {
        const macdLineData = macdResult.macd.map((value, i) => ({
          time: (candles[i].time / 1000) as any,
          value,
        }));
        const macdSignalData = macdResult.signal.map((value, i) => ({
          time: (candles[i].time / 1000) as any,
          value,
        }));
        const macdHistogramData = macdResult.histogram.map((value, i) => ({
          time: (candles[i].time / 1000) as any,
          value,
          color: value >= 0 ? colors.statusBullish + '80' : colors.statusBearish + '80',
        }));
        macdLineSeriesRef.current.setData(macdLineData);
        macdSignalSeriesRef.current.setData(macdSignalData);
        macdHistogramSeriesRef.current.setData(macdHistogramData);
      } else {
        macdLineSeriesRef.current.setData([]);
        macdSignalSeriesRef.current.setData([]);
        macdHistogramSeriesRef.current.setData([]);
      }

      if (emaSettings.ema1.enabled && emaSettings.ema2.enabled && ema1.length > 0 && ema2.length > 0) {
        const markers = detectCrossovers(ema1, ema2, candles);
        candleSeriesRef.current.setMarkers(markers);
      } else {
        candleSeriesRef.current.setMarkers([]);
      }
    } else {
      candleSeriesRef.current.update(candleData[candleData.length - 1]);
      volumeSeriesRef.current.update(volumeData[volumeData.length - 1]);

      if (emaSettings.ema1.enabled && ema1.length > 0) {
        ema1SeriesRef.current.update({
          time: (lastCandle.time / 1000) as any,
          value: ema1[ema1.length - 1],
        });
      }

      if (emaSettings.ema2.enabled && ema2.length > 0) {
        ema2SeriesRef.current.update({
          time: (lastCandle.time / 1000) as any,
          value: ema2[ema2.length - 1],
        });
      }

      if (emaSettings.ema3.enabled && ema3.length > 0) {
        ema3SeriesRef.current.update({
          time: (lastCandle.time / 1000) as any,
          value: ema3[ema3.length - 1],
        });
      }

      if (macdSettings.enabled && macdResult.macd.length > 0) {
        macdLineSeriesRef.current.update({
          time: (lastCandle.time / 1000) as any,
          value: macdResult.macd[macdResult.macd.length - 1],
        });
        macdSignalSeriesRef.current.update({
          time: (lastCandle.time / 1000) as any,
          value: macdResult.signal[macdResult.signal.length - 1],
        });
        macdHistogramSeriesRef.current.update({
          time: (lastCandle.time / 1000) as any,
          value: macdResult.histogram[macdResult.histogram.length - 1],
          color: macdResult.histogram[macdResult.histogram.length - 1] >= 0 ? colors.statusBullish + '80' : colors.statusBearish + '80',
        });
      }
    }

    lastCandleTimeRef.current = lastCandle.time;

    if (onPriceUpdate) {
      onPriceUpdate(lastCandle.close);
    }
  }, [candles, chartReady, onPriceUpdate, emaSettings, macdSettings]);

  // Stochastic data update
  useEffect(() => {
    if (!chartReady || Object.keys(stochSeriesRefsRef.current).length === 0) return;
    if (!stochasticSettings.showMultiTimeframe) return;

    enabledTimeframes.forEach((timeframe) => {
      const stochCandles = isExternalData ? allStochCandles[timeframe] : allStochCandles[`${coin}-${timeframe}`];
      if (!stochCandles || stochCandles.length === 0) return;

      const config = stochasticSettings.timeframes[timeframe];
      if (!config) return;

      const validCandles = stochCandles.filter(c => c && typeof c.high === 'number' && typeof c.low === 'number' && typeof c.close === 'number');
      if (validCandles.length === 0) return;

      const stochData = calculateStochastic(validCandles, config.period, config.smoothK, config.smoothD);

      if (stochData.length > 0 && stochSeriesRefsRef.current[timeframe]) {
        const offset = validCandles.length - stochData.length;

        stochSeriesRefsRef.current[timeframe].k.setData(stochData.map((s, i) => ({
          time: (validCandles[i + offset].time / 1000) as any,
          value: s.k,
        })));

        stochSeriesRefsRef.current[timeframe].d.setData(stochData.map((s, i) => ({
          time: (validCandles[i + offset].time / 1000) as any,
          value: s.d,
        })));
      }
    });
  }, [chartReady, enabledTimeframes.join(','), allStochCandles, stochasticSettings, coin, isExternalData]);

  const timeframeColorVars: Record<string, { k: string; d: string }> = {
    '1m': { k: 'var(--accent-blue)', d: 'var(--accent-blue)' },
    '5m': { k: 'var(--accent-rose)', d: 'var(--accent-rose)' },
    '15m': { k: 'var(--primary)', d: 'var(--primary)' },
    '30m': { k: 'var(--status-bullish)', d: 'var(--status-bullish)' },
    '1h': { k: 'var(--accent-blue)', d: 'var(--accent-blue)' },
    '4h': { k: 'var(--accent-rose)', d: 'var(--accent-rose)' },
  };

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary bg-opacity-90 z-10">
          <div className="text-primary">Loading chart...</div>
        </div>
      )}
      <div ref={chartContainerRef} className="flex-1" />
      <div className="mt-1 flex gap-3 text-xs flex-wrap">
        {emaSettings.ema1.enabled && (
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--accent-blue)' }}></div>
            <span className="text-primary-muted">EMA {emaSettings.ema1.period}</span>
          </div>
        )}
        {emaSettings.ema2.enabled && (
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--accent-rose)' }}></div>
            <span className="text-primary-muted">EMA {emaSettings.ema2.period}</span>
          </div>
        )}
        {emaSettings.ema3.enabled && (
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--accent-green)' }}></div>
            <span className="text-primary-muted">EMA {emaSettings.ema3.period}</span>
          </div>
        )}
        {emaSettings.ema1.enabled && emaSettings.ema2.enabled && (
          <>
            <div className="flex items-center gap-1">
              <span className="text-bullish">↑</span>
              <span className="text-primary-muted">EMA BUY</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-bearish">↓</span>
              <span className="text-primary-muted">EMA SELL</span>
            </div>
          </>
        )}
        {macdSettings.enabled && (
          <>
            <div className="w-px h-4 bg-frame mx-1"></div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--accent-blue)' }}></div>
              <span className="text-primary-muted">MACD ({macdSettings.fastPeriod},{macdSettings.slowPeriod},{macdSettings.signalPeriod})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--accent-rose)' }}></div>
              <span className="text-primary-muted">Signal</span>
            </div>
          </>
        )}
        {stochasticSettings.showMultiTimeframe && enabledTimeframes.length > 0 && (
          <>
            <div className="w-px h-4 bg-frame mx-1"></div>
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
          </>
        )}
      </div>
    </div>
  );
}
