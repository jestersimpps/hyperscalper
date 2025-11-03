'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import type { CandleData, TimeInterval } from '@/types';
import type { Position } from '@/models/Position';
import type { Order } from '@/models/Order';
import { useCandleStore } from '@/stores/useCandleStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useChartSyncStore } from '@/stores/useChartSyncStore';
import { getThemeColors } from '@/lib/theme-utils';
import {
  calculateEMA,
  calculateMACD,
  calculateStochastic,
  calculateEMAMemoized,
  calculateMACDMemoized,
  calculateStochasticMemoized,
  detectPivots,
  detectStochasticPivots,
  detectDivergence,
  calculateTrendlines,
  calculateStochasticTrendlines,
  calculatePivotLines,
  type StochasticData,
  type DivergencePoint,
} from '@/lib/indicators';
import { getStandardTimeWindow } from '@/lib/time-utils';

interface ScalpingChartProps {
  coin: string;
  interval: TimeInterval;
  onPriceUpdate?: (price: number) => void;
  onChartReady?: (chart: any) => void;
  candleData?: CandleData[];
  isExternalData?: boolean;
  macdCandleData?: Record<TimeInterval, CandleData[]>;
  position?: Position | null;
  orders?: Order[];
  syncZoom?: boolean;
}

interface CrossoverMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
}


function detectCrossovers(ema1: number[], ema2: number[], ema3: number[] | null, candles: CandleData[], bullishColor: string, bearishColor: string): any[] {
  const markers: any[] = [];

  if (ema3) {
    // When 3 EMAs are enabled, detect when all 3 align
    for (let i = 1; i < ema1.length && i < ema2.length && i < ema3.length; i++) {
      const prevEma1 = ema1[i - 1];
      const prevEma2 = ema2[i - 1];
      const prevEma3 = ema3[i - 1];
      const currEma1 = ema1[i];
      const currEma2 = ema2[i];
      const currEma3 = ema3[i];

      // Check for bullish alignment: EMA1 > EMA2 > EMA3
      const wasBullish = prevEma1 > prevEma2 && prevEma2 > prevEma3;
      const isBullish = currEma1 > currEma2 && currEma2 > currEma3;

      // Check for bearish alignment: EMA1 < EMA2 < EMA3
      const wasBearish = prevEma1 < prevEma2 && prevEma2 < prevEma3;
      const isBearish = currEma1 < currEma2 && currEma2 < currEma3;

      if (!wasBullish && isBullish) {
        markers.push({
          time: candles[i].time / 1000,
          position: 'belowBar',
          color: bullishColor,
          shape: 'arrowUp',
          text: 'EMA BUY',
          id: `buy-${i}`
        });
      } else if (!wasBearish && isBearish) {
        markers.push({
          time: candles[i].time / 1000,
          position: 'aboveBar',
          color: bearishColor,
          shape: 'arrowDown',
          text: 'EMA SELL',
          id: `sell-${i}`
        });
      }
    }
  } else {
    // When 2 EMAs are enabled, detect crossovers between them
    for (let i = 1; i < ema1.length && i < ema2.length; i++) {
      const prevEma1 = ema1[i - 1];
      const prevEma2 = ema2[i - 1];
      const currEma1 = ema1[i];
      const currEma2 = ema2[i];

      if (prevEma1 <= prevEma2 && currEma1 > currEma2) {
        markers.push({
          time: candles[i].time / 1000,
          position: 'belowBar',
          color: bullishColor,
          shape: 'arrowUp',
          text: 'EMA BUY',
          id: `buy-${i}`
        });
      } else if (prevEma1 >= prevEma2 && currEma1 < currEma2) {
        markers.push({
          time: candles[i].time / 1000,
          position: 'aboveBar',
          color: bearishColor,
          shape: 'arrowDown',
          text: 'EMA SELL',
          id: `sell-${i}`
        });
      }
    }
  }

  return markers;
}


export default function ScalpingChart({ coin, interval, onPriceUpdate, onChartReady, candleData, isExternalData = false, macdCandleData, position, orders, syncZoom = false }: ScalpingChartProps) {
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
  const stochSeriesRefsRef = useRef<Record<string, { d: any }>>({});
  const macdSeriesRefsRef = useRef<Record<string, { line: any; signal: any; histogram: any }>>({});
  const divergencePriceSeriesRef = useRef<any[]>([]);
  const divergenceStochSeriesRef = useRef<any[]>([]);
  const stochReferenceLinesRef = useRef<any[]>([]);
  const supportLineSeriesRef = useRef<any[]>([]);
  const resistanceLineSeriesRef = useRef<any[]>([]);
  const stochSupportLineSeriesRef = useRef<any[]>([]);
  const stochResistanceLineSeriesRef = useRef<any[]>([]);
  const positionLineRef = useRef<any>(null);
  const orderLinesRef = useRef<any[]>([]);
  const cachedTrendlinesRef = useRef<{ supportLine: any[]; resistanceLine: any[] }>({ supportLine: [], resistanceLine: [] });
  const lastTrendlineCalculationRef = useRef<number>(0);
  const cachedStochTrendlinesRef = useRef<{ supportLine: any[]; resistanceLine: any[] }>({ supportLine: [], resistanceLine: [] });
  const lastStochTrendlineCalculationRef = useRef<number>(0);
  const [chartReady, setChartReady] = useState(false);
  const candlesBufferRef = useRef<CandleData[]>([]);
  const lastCandleTimeRef = useRef<number | null>(null);

  const candleKey = `${coin}-${interval}`;
  const storeCandles = useCandleStore((state) => state.candles[candleKey]) || [];
  const storeLoading = useCandleStore((state) => state.loading[candleKey]) || false;
  const getDecimals = useSymbolMetaStore((state) => state.getDecimals);
  const decimals = getDecimals(coin);

  const candles = isExternalData && candleData ? candleData : storeCandles;
  const isLoading = isExternalData ? false : storeLoading;
  const emaSettings = useSettingsStore((state) => state.settings.indicators.ema);
  const stochasticSettings = useSettingsStore((state) => state.settings.indicators.stochastic);
  const macdSettings = useSettingsStore((state) => state.settings.indicators.macd);

  const enabledMacdTimeframes = Object.entries(macdSettings.timeframes || {})
    .filter(([_, config]) => config.enabled && macdSettings.showMultiTimeframe)
    .map(([tf]) => tf as TimeInterval);

  const storeMacdCandles = useCandleStore((state) => state.candles);
  const allMacdCandles = isExternalData && macdCandleData ? macdCandleData : storeMacdCandles;

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
              bottom: 0.45,
            },
          },
        });

        const candleSeries = chart.addCandlestickSeries({
          upColor: colors.statusBullish,
          downColor: colors.statusBearish,
          borderVisible: false,
          wickUpColor: colors.statusBullish,
          wickDownColor: colors.statusBearish,
          priceFormat: {
            type: 'price',
            precision: decimals.price,
            minMove: 1 / Math.pow(10, decimals.price),
          },
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
          lastValueVisible: false,
          priceLineVisible: false,
        });

        const ema2Series = chart.addLineSeries({
          color: colors.accentRose,
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
        });

        const ema3Series = chart.addLineSeries({
          color: colors.accentGreen,
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
        });

        // MACD series
        const macdLineSeries = chart.addLineSeries({
          color: colors.accentBlue,
          lineWidth: 2,
          priceScaleId: 'macd',
          lastValueVisible: false,
          priceLineVisible: false,
        });

        const macdSignalSeries = chart.addLineSeries({
          color: colors.accentRose,
          lineWidth: 2,
          priceScaleId: 'macd',
          lastValueVisible: false,
          priceLineVisible: false,
        });

        const macdHistogramSeries = chart.addHistogramSeries({
          color: colors.primary,
          priceScaleId: 'macd',
          lastValueVisible: false,
          priceLineVisible: false,
        });

        macdLineSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.65,
            bottom: 0.20,
          },
        });

        macdSignalSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.65,
            bottom: 0.20,
          },
        });

        macdHistogramSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.65,
            bottom: 0.20,
          },
        });

        // Stochastic series for variants
        const variantColors: Record<string, string> = {
          fast9: colors.accentBlue,
          fast14: colors.accentRose,
          fast40: colors.accentGreen,
          full60: '#FFA500',
        };

        stochSeriesRefsRef.current = {};

        if (stochasticSettings.showMultiVariant) {
          Object.entries(stochasticSettings.variants).forEach(([variantName, settings]) => {
            if (!settings.enabled) return;

            const dSeries = chart.addLineSeries({
              color: variantColors[variantName],
              lineWidth: 2,
              priceScaleId: 'stoch',
              lastValueVisible: false,
              priceLineVisible: false,
            });

            dSeries.priceScale().applyOptions({
              scaleMargins: {
                top: 0.80,
                bottom: 0.05,
              },
            });

            stochSeriesRefsRef.current[variantName] = { d: dSeries };
          });
        }

        // MACD multi-timeframe series
        const macdTimeframeColors: Record<string, { line: string; signal: string }> = {
          '1m': { line: colors.accentBlue, signal: colors.accentRose },
          '5m': { line: colors.primary, signal: colors.statusBullish },
          '15m': { line: colors.accentGreen, signal: colors.accentRose },
          '1h': { line: colors.accentBlue, signal: colors.accentRose },
        };

        macdSeriesRefsRef.current = {};

        enabledMacdTimeframes.forEach((timeframe) => {
          const lineSeries = chart.addLineSeries({
            color: macdTimeframeColors[timeframe].line,
            lineWidth: 2,
            priceScaleId: 'macd',
            lastValueVisible: false,
            priceLineVisible: false,
          });

          const signalSeries = chart.addLineSeries({
            color: macdTimeframeColors[timeframe].signal,
            lineWidth: 1,
            lineStyle: 2,
            priceScaleId: 'macd',
            lastValueVisible: false,
            priceLineVisible: false,
          });

          const histogramSeries = chart.addHistogramSeries({
            priceScaleId: 'macd',
            lastValueVisible: false,
            priceLineVisible: false,
          });

          lineSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.65,
              bottom: 0.20,
            },
          });

          signalSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.65,
              bottom: 0.20,
            },
          });

          histogramSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.65,
              bottom: 0.20,
            },
          });

          macdSeriesRefsRef.current[timeframe] = { line: lineSeries, signal: signalSeries, histogram: histogramSeries };
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
        stochSeriesRefsRef.current = {};
      }
    };
  }, [enabledMacdTimeframes.join(','), macdSettings.showMultiTimeframe, stochasticSettings.showMultiVariant, Object.entries(stochasticSettings.variants).filter(([_, v]) => v.enabled).map(([k]) => k).join(',')]);

  useEffect(() => {
    if (!syncZoom || !chartRef.current || !chartReady) return;

    const chart = chartRef.current;
    const timeScale = chart.timeScale();
    const { visibleTimeRange, setVisibleTimeRange } = useChartSyncStore.getState();
    let isSyncing = false;

    // Initial alignment: if there's already a synced range, apply it; otherwise, set initial range
    if (visibleTimeRange) {
      try {
        timeScale.setVisibleRange({
          from: visibleTimeRange.from as any,
          to: visibleTimeRange.to as any,
        });
      } catch (e) {
        console.warn('Failed to apply initial synced range:', e);
      }
    } else {
      // Set initial range for other charts to sync to
      timeScale.scrollToRealTime();
      const range = timeScale.getVisibleRange();
      if (range) {
        setVisibleTimeRange({ from: range.from as number, to: range.to as number });
      }
    }

    const handleVisibleRangeChange = () => {
      if (isSyncing) return;

      const range = timeScale.getVisibleRange();
      if (range) {
        isSyncing = true;
        setVisibleTimeRange({ from: range.from as number, to: range.to as number });
        setTimeout(() => { isSyncing = false; }, 100);
      }
    };

    const unsubscribeTimeScale = timeScale.subscribeVisibleTimeRangeChange(handleVisibleRangeChange);

    const unsubscribeStore = useChartSyncStore.subscribe((state) => {
      if (isSyncing || !state.visibleTimeRange) return;

      isSyncing = true;
      try {
        timeScale.setVisibleRange({
          from: state.visibleTimeRange.from as any,
          to: state.visibleTimeRange.to as any,
        });
      } catch (e) {
        console.warn('Failed to sync time range:', e);
      }
      setTimeout(() => { isSyncing = false; }, 100);
    });

    return () => {
      unsubscribeTimeScale();
      unsubscribeStore();
    };
  }, [syncZoom, chartReady]);

  useEffect(() => {
    if (!chartReady || isExternalData) return;

    const { startTime, endTime } = getStandardTimeWindow();
    const { fetchCandles, subscribeToCandles, unsubscribeFromCandles } = useCandleStore.getState();
    fetchCandles(coin, interval, startTime, endTime);
    subscribeToCandles(coin, interval);

    // Fetch MACD data
    if (macdSettings.showMultiTimeframe) {
      enabledMacdTimeframes.forEach(tf => {
        fetchCandles(coin, tf, startTime, endTime);
        subscribeToCandles(coin, tf);
      });
    }

    // Fetch 1m data for stochastics
    if (stochasticSettings.showMultiVariant && interval !== '1m') {
      fetchCandles(coin, '1m', startTime, endTime);
      subscribeToCandles(coin, '1m');
    }

    return () => {
      const { unsubscribeFromCandles } = useCandleStore.getState();
      unsubscribeFromCandles(coin, interval);

      if (macdSettings.showMultiTimeframe) {
        enabledMacdTimeframes.forEach(tf => {
          unsubscribeFromCandles(coin, tf);
        });
      }

      if (stochasticSettings.showMultiVariant && interval !== '1m') {
        unsubscribeFromCandles(coin, '1m');
      }
    };
  }, [coin, interval, chartReady, isExternalData, enabledMacdTimeframes.join(','), macdSettings.showMultiTimeframe, stochasticSettings.showMultiVariant]);

  useEffect(() => {
    lastCandleTimeRef.current = null;
  }, [interval]);

  const closePrices = useMemo(() => candles.map(c => c.close), [candles]);

  const ema1 = useMemo(() =>
    emaSettings.ema1.enabled ? calculateEMAMemoized(closePrices, emaSettings.ema1.period) : [],
    [closePrices, emaSettings.ema1.enabled, emaSettings.ema1.period]
  );

  const ema2 = useMemo(() =>
    emaSettings.ema2.enabled ? calculateEMAMemoized(closePrices, emaSettings.ema2.period) : [],
    [closePrices, emaSettings.ema2.enabled, emaSettings.ema2.period]
  );

  const ema3 = useMemo(() =>
    emaSettings.ema3.enabled ? calculateEMAMemoized(closePrices, emaSettings.ema3.period) : [],
    [closePrices, emaSettings.ema3.enabled, emaSettings.ema3.period]
  );

  const macdResult = useMemo(() => {
    const macdIntervalConfig = macdSettings.timeframes?.[interval];
    return (!macdSettings.showMultiTimeframe && macdIntervalConfig?.enabled)
      ? calculateMACDMemoized(closePrices, macdIntervalConfig.fastPeriod, macdIntervalConfig.slowPeriod, macdIntervalConfig.signalPeriod)
      : { macd: [], signal: [], histogram: [] };
  }, [closePrices, macdSettings.showMultiTimeframe, macdSettings.timeframes, interval]);

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
        const ema3ForDetection = emaSettings.ema3.enabled && ema3.length > 0 ? ema3 : null;
        const markers = detectCrossovers(ema1, ema2, ema3ForDetection, candles, colors.statusBullish, colors.statusBearish);
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
  }, [candles, chartReady, onPriceUpdate, ema1, ema2, ema3, macdResult, emaSettings.ema1.enabled, emaSettings.ema2.enabled, emaSettings.ema3.enabled, macdSettings.enabled]);


  // MACD multi-timeframe data update
  useEffect(() => {
    if (!chartReady || Object.keys(macdSeriesRefsRef.current).length === 0) return;
    if (!macdSettings.showMultiTimeframe) return;

    const colors = getThemeColors();

    enabledMacdTimeframes.forEach((timeframe) => {
      const macdCandles = isExternalData ? allMacdCandles[timeframe] : allMacdCandles[`${coin}-${timeframe}`];
      if (!macdCandles || macdCandles.length === 0) return;

      const config = macdSettings.timeframes?.[timeframe];
      if (!config) return;

      const validCandles = macdCandles.filter(c => c && typeof c.close === 'number');
      if (validCandles.length === 0) return;

      const closePrices = validCandles.map(c => c.close);
      const macdData = calculateMACD(closePrices, config.fastPeriod, config.slowPeriod, config.signalPeriod);

      if (macdData.macd.length > 0 && macdSeriesRefsRef.current[timeframe]) {
        const offset = validCandles.length - macdData.macd.length;

        macdSeriesRefsRef.current[timeframe].line.setData(macdData.macd.map((value, i) => ({
          time: (validCandles[i + offset].time / 1000) as any,
          value,
        })));

        macdSeriesRefsRef.current[timeframe].signal.setData(macdData.signal.map((value, i) => ({
          time: (validCandles[i + offset].time / 1000) as any,
          value,
        })));

        macdSeriesRefsRef.current[timeframe].histogram.setData(macdData.histogram.map((value, i) => ({
          time: (validCandles[i + offset].time / 1000) as any,
          value,
          color: value >= 0 ? colors.statusBullish + '80' : colors.statusBearish + '80',
        })));
      }
    });
  }, [chartReady, enabledMacdTimeframes.join(','), allMacdCandles, macdSettings, coin, isExternalData]);

  // Stochastic multi-variant data update
  useEffect(() => {
    if (!chartReady || Object.keys(stochSeriesRefsRef.current).length === 0) return;
    if (!stochasticSettings.showMultiVariant) return;

    const stochCandles = interval === '1m' ? candles : (isExternalData ? allMacdCandles['1m'] : useCandleStore.getState().candles[`${coin}-1m`]);
    if (!stochCandles || stochCandles.length === 0) return;

    Object.entries(stochasticSettings.variants).forEach(([variantName, config]) => {
      if (!config.enabled || !stochSeriesRefsRef.current[variantName]) return;

      const stochData = calculateStochastic(stochCandles, config.period, config.smoothK, config.smoothD);

      if (stochData.length > 0) {
        const offset = stochCandles.length - stochData.length;

        stochSeriesRefsRef.current[variantName].d.setData(stochData.map((value, i) => ({
          time: (stochCandles[i + offset].time / 1000) as any,
          value: value.d,
        })));
      }
    });
  }, [chartReady, candles, interval, allMacdCandles, stochasticSettings, coin, isExternalData]);

  // Stochastic reference lines (0 and 100)
  useEffect(() => {
    if (!chartReady || Object.keys(stochSeriesRefsRef.current).length === 0) return;
    if (!stochasticSettings.showMultiVariant) return;

    stochReferenceLinesRef.current.forEach((line) => {
      try {
        const firstSeries = Object.values(stochSeriesRefsRef.current)[0]?.d;
        if (firstSeries) {
          firstSeries.removePriceLine(line);
        }
      } catch (e) {}
    });
    stochReferenceLinesRef.current = [];

    const firstSeries = Object.values(stochSeriesRefsRef.current)[0]?.d;
    if (firstSeries) {
      const colors = getThemeColors();

      const line0 = firstSeries.createPriceLine({
        price: 0,
        color: colors.primaryMuted,
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: false,
        title: '',
      });

      const line100 = firstSeries.createPriceLine({
        price: 100,
        color: colors.primaryMuted,
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: false,
        title: '',
      });

      stochReferenceLinesRef.current.push(line0, line100);
    }

    return () => {
      stochReferenceLinesRef.current.forEach((line) => {
        try {
          const firstSeries = Object.values(stochSeriesRefsRef.current)[0]?.d;
          if (firstSeries) {
            firstSeries.removePriceLine(line);
          }
        } catch (e) {}
      });
      stochReferenceLinesRef.current = [];
    };
  }, [chartReady, stochasticSettings.showMultiVariant, Object.entries(stochasticSettings.variants).filter(([_, v]) => v.enabled).map(([k]) => k).join(',')]);

  const divergenceData = useMemo(() => {
    if (!stochasticSettings.showMultiVariant || !stochasticSettings.showDivergence) {
      return { divergences: [], enabled: false };
    }

    const stochCandles = interval === '1m' ? candles : (isExternalData ? allMacdCandles['1m'] : useCandleStore.getState().candles[`${coin}-1m`]);
    if (!stochCandles || stochCandles.length < 50) {
      return { divergences: [], enabled: false };
    }

    const variantToUse = stochasticSettings.divergenceVariant || 'fast14';
    const variantConfig = stochasticSettings.variants[variantToUse];

    if (!variantConfig || !variantConfig.enabled) {
      return { divergences: [], enabled: false };
    }

    const stochData = calculateStochasticMemoized(stochCandles, variantConfig.period, variantConfig.smoothK, variantConfig.smoothD);
    if (stochData.length === 0) {
      return { divergences: [], enabled: false };
    }

    const pricePivots = detectPivots(stochCandles, 3);
    const stochPivots = detectStochasticPivots(stochData, stochCandles, 3);
    const divergences = detectDivergence(pricePivots, stochPivots, stochCandles);

    return { divergences, enabled: true };
  }, [candles.length, interval, allMacdCandles, stochasticSettings.showMultiVariant, stochasticSettings.showDivergence, stochasticSettings.divergenceVariant, coin, isExternalData]);

  useEffect(() => {
    if (!chartReady || !chartRef.current || !divergenceData.enabled) return;

    divergencePriceSeriesRef.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch (e) {}
    });
    divergencePriceSeriesRef.current = [];

    divergenceStochSeriesRef.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch (e) {}
    });
    divergenceStochSeriesRef.current = [];

    const colors = getThemeColors();
    const colorMap = {
      'bullish': colors.statusBullish,
      'bearish': colors.statusBearish,
      'hidden-bullish': colors.accentBlue,
      'hidden-bearish': colors.accentRose,
    };

    divergenceData.divergences.forEach((div) => {
      const priceSeries = chartRef.current?.addLineSeries({
        color: colorMap[div.type],
        lineWidth: 2,
        lineStyle: 2,
        lastValueVisible: false,
        priceLineVisible: false,
      });

      if (priceSeries) {
        priceSeries.setData([
          { time: (div.startTime / 1000) as any, value: div.startPriceValue },
          { time: (div.endTime / 1000) as any, value: div.endPriceValue },
        ]);
        divergencePriceSeriesRef.current.push(priceSeries);
      }

      const stochSeries = chartRef.current?.addLineSeries({
        color: colorMap[div.type],
        lineWidth: 2,
        lineStyle: 2,
        priceScaleId: 'stoch',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      if (stochSeries) {
        stochSeries.setData([
          { time: (div.startTime / 1000) as any, value: div.startStochValue },
          { time: (div.endTime / 1000) as any, value: div.endStochValue },
        ]);
        divergenceStochSeriesRef.current.push(stochSeries);
      }
    });

    return () => {
      divergencePriceSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series);
        } catch (e) {}
      });
      divergencePriceSeriesRef.current = [];

      divergenceStochSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series);
        } catch (e) {}
      });
      divergenceStochSeriesRef.current = [];
    };
  }, [chartReady, divergenceData]);

  const trendlines = useMemo(() => {
    const currentLength = candles.length;

    if (currentLength < 30) {
      cachedTrendlinesRef.current = { supportLine: [], resistanceLine: [] };
      return cachedTrendlinesRef.current;
    }

    if (lastTrendlineCalculationRef.current === currentLength) {
      return cachedTrendlinesRef.current;
    }

    const cacheEmpty = cachedTrendlinesRef.current.supportLine.length === 0 &&
                       cachedTrendlinesRef.current.resistanceLine.length === 0;

    if (!cacheEmpty && currentLength % 10 !== 0) {
      return cachedTrendlinesRef.current;
    }

    const newTrendlines = calculateTrendlines(candles);
    cachedTrendlinesRef.current = newTrendlines;
    lastTrendlineCalculationRef.current = currentLength;
    return newTrendlines;
  }, [candles.length, candles]);

  const stochTrendlines = useMemo(() => {
    if (!stochasticSettings.showMultiVariant) {
      cachedStochTrendlinesRef.current = { supportLine: [], resistanceLine: [] };
      return cachedStochTrendlinesRef.current;
    }

    const stochCandles = interval === '1m' ? candles : (isExternalData ? allMacdCandles['1m'] : useCandleStore.getState().candles[`${coin}-1m`]);
    if (!stochCandles || stochCandles.length < 30) {
      cachedStochTrendlinesRef.current = { supportLine: [], resistanceLine: [] };
      return cachedStochTrendlinesRef.current;
    }

    const currentLength = stochCandles.length;

    if (lastStochTrendlineCalculationRef.current === currentLength) {
      return cachedStochTrendlinesRef.current;
    }

    const enabledVariants = Object.entries(stochasticSettings.variants).filter(([_, v]) => v.enabled);
    if (enabledVariants.length === 0) {
      cachedStochTrendlinesRef.current = { supportLine: [], resistanceLine: [] };
      return cachedStochTrendlinesRef.current;
    }

    const slowestVariant = enabledVariants.reduce((slowest, [name, config]) => {
      return config.period > slowest.config.period ? { name, config } : slowest;
    }, { name: enabledVariants[0][0], config: enabledVariants[0][1] });

    const variantConfig = slowestVariant.config;
    const stochData = calculateStochastic(stochCandles, variantConfig.period, variantConfig.smoothK, variantConfig.smoothD);

    if (stochData.length < 30) {
      cachedStochTrendlinesRef.current = { supportLine: [], resistanceLine: [] };
      return cachedStochTrendlinesRef.current;
    }

    const offset = stochCandles.length - stochData.length;
    const alignedCandles = stochCandles.slice(offset);

    const newStochTrendlines = calculateStochasticTrendlines(stochData, alignedCandles);
    cachedStochTrendlinesRef.current = newStochTrendlines;
    lastStochTrendlineCalculationRef.current = currentLength;
    return newStochTrendlines;
  }, [candles.length, candles, stochasticSettings, interval, allMacdCandles, coin, isExternalData]);

  useEffect(() => {
    if (!chartReady || !chartRef.current || trendlines.supportLine.length === 0) {
      return;
    }

    supportLineSeriesRef.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch (e) {}
    });
    supportLineSeriesRef.current = [];

    resistanceLineSeriesRef.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch (e) {}
    });
    resistanceLineSeriesRef.current = [];

    const colors = getThemeColors();

    trendlines.supportLine.forEach((line) => {
      if (line.points.length >= 2) {
        const supportSeries = chartRef.current!.addLineSeries({
          color: colors.statusBullish,
          lineWidth: 2,
          lineStyle: line.lineStyle,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        supportSeries.setData(line.points);
        supportLineSeriesRef.current.push(supportSeries);
      }
    });

    trendlines.resistanceLine.forEach((line) => {
      if (line.points.length >= 2) {
        const resistanceSeries = chartRef.current!.addLineSeries({
          color: colors.statusBearish,
          lineWidth: 2,
          lineStyle: line.lineStyle,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        resistanceSeries.setData(line.points);
        resistanceLineSeriesRef.current.push(resistanceSeries);
      }
    });

    return () => {
      supportLineSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series);
        } catch (e) {}
      });
      supportLineSeriesRef.current = [];

      resistanceLineSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series);
        } catch (e) {}
      });
      resistanceLineSeriesRef.current = [];
    };
  }, [chartReady, trendlines]);

  useEffect(() => {
    if (!chartReady || !chartRef.current || !stochasticSettings.showMultiVariant) {
      stochSupportLineSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series);
        } catch (e) {}
      });
      stochSupportLineSeriesRef.current = [];

      stochResistanceLineSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series);
        } catch (e) {}
      });
      stochResistanceLineSeriesRef.current = [];
      return;
    }

    if (stochTrendlines.supportLine.length === 0 && stochTrendlines.resistanceLine.length === 0) {
      return;
    }

    stochSupportLineSeriesRef.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch (e) {}
    });
    stochSupportLineSeriesRef.current = [];

    stochResistanceLineSeriesRef.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch (e) {}
    });
    stochResistanceLineSeriesRef.current = [];

    const colors = getThemeColors();

    stochTrendlines.supportLine.forEach((line) => {
      if (line.points.length >= 2) {
        const supportSeries = chartRef.current!.addLineSeries({
          color: colors.statusBullish,
          lineWidth: 2,
          lineStyle: line.lineStyle,
          priceScaleId: 'stoch',
          lastValueVisible: false,
          priceLineVisible: false,
        });
        supportSeries.setData(line.points);
        stochSupportLineSeriesRef.current.push(supportSeries);
      }
    });

    stochTrendlines.resistanceLine.forEach((line) => {
      if (line.points.length >= 2) {
        const resistanceSeries = chartRef.current!.addLineSeries({
          color: colors.statusBearish,
          lineWidth: 2,
          lineStyle: line.lineStyle,
          priceScaleId: 'stoch',
          lastValueVisible: false,
          priceLineVisible: false,
        });
        resistanceSeries.setData(line.points);
        stochResistanceLineSeriesRef.current.push(resistanceSeries);
      }
    });

    return () => {
      stochSupportLineSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series);
        } catch (e) {}
      });
      stochSupportLineSeriesRef.current = [];

      stochResistanceLineSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series);
        } catch (e) {}
      });
      stochResistanceLineSeriesRef.current = [];
    };
  }, [chartReady, stochTrendlines, stochasticSettings.showMultiVariant]);

  // Position price line overlay
  useEffect(() => {
    if (!chartReady || !candleSeriesRef.current) return;

    // Remove existing position line if it exists
    if (positionLineRef.current) {
      candleSeriesRef.current.removePriceLine(positionLineRef.current);
      positionLineRef.current = null;
    }

    // Create new position line if position exists
    if (position) {
      const colors = getThemeColors();
      const isLong = position.side === 'long';
      const isProfitable = position.pnl >= 0;

      positionLineRef.current = candleSeriesRef.current.createPriceLine({
        price: position.entryPrice,
        color: isLong ? colors.statusBullish : colors.statusBearish,
        lineWidth: 2,
        lineStyle: 0, // solid
        axisLabelVisible: true,
        title: `ENTRY ${position.side.toUpperCase()}`,
      });
    }

    // Cleanup on unmount or position change
    return () => {
      if (positionLineRef.current && candleSeriesRef.current) {
        try {
          candleSeriesRef.current.removePriceLine(positionLineRef.current);
        } catch (e) {
          // Ignore errors during cleanup
        }
        positionLineRef.current = null;
      }
    };
  }, [position, chartReady]);

  // Order price lines overlay
  useEffect(() => {
    if (!chartReady || !candleSeriesRef.current) return;

    // Remove existing order lines
    orderLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current.removePriceLine(line);
      } catch (e) {
        // Ignore errors
      }
    });
    orderLinesRef.current = [];

    // Create new order lines if orders exist
    if (orders && orders.length > 0) {
      const colors = getThemeColors();

      orders.forEach((order) => {
        const isBuy = order.side === 'buy';
        const color = isBuy ? colors.statusBullish : colors.statusBearish;

        // Determine line style based on order type
        let lineStyle = 1; // dotted for regular limit orders
        let opacity = 1;

        if (order.orderType === 'stop') {
          lineStyle = 3; // large dashed for stop loss
          opacity = 0.9;
        } else if (order.orderType === 'tp') {
          lineStyle = 1; // dotted for take profit
          opacity = 0.8;
        } else if (order.orderType === 'trigger') {
          lineStyle = 3; // large dashed for trigger orders
          opacity = 0.9;
        }

        const orderLine = candleSeriesRef.current.createPriceLine({
          price: order.price,
          color,
          lineWidth: 2,
          lineStyle,
          axisLabelVisible: true,
          title: `${order.side.toUpperCase()} ${order.orderType.toUpperCase()}`,
        });

        orderLinesRef.current.push(orderLine);
      });
    }

    // Cleanup on unmount or orders change
    return () => {
      orderLinesRef.current.forEach((line) => {
        if (candleSeriesRef.current) {
          try {
            candleSeriesRef.current.removePriceLine(line);
          } catch (e) {
            // Ignore errors during cleanup
          }
        }
      });
      orderLinesRef.current = [];
    };
  }, [orders, chartReady]);

  const variantColorVars: Record<string, string> = {
    fast9: 'var(--accent-blue)',
    fast14: 'var(--accent-rose)',
    fast40: 'var(--accent-green)',
    full60: '#FFA500',
  };

  const variantLabels: Record<string, string> = {
    fast9: 'F9',
    fast14: 'F14',
    fast40: 'F40',
    full60: 'FL60',
  };

  return (
    <div className="relative flex flex-col h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary bg-opacity-90 z-10">
          <div className="text-primary">Loading chart...</div>
        </div>
      )}
      <div ref={chartContainerRef} className="flex-1 min-h-0" />
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
        {stochasticSettings.showMultiVariant && Object.entries(stochasticSettings.variants).some(([_, v]) => v.enabled) && (
          <>
            <div className="w-px h-4 bg-frame mx-1"></div>
            {Object.entries(stochasticSettings.variants)
              .filter(([_, config]) => config.enabled)
              .map(([variantName]) => (
                <div key={variantName} className="flex items-center gap-1">
                  <div className="w-6 h-0.5" style={{ backgroundColor: variantColorVars[variantName] }}></div>
                  <span className="text-primary-muted">STOCH {variantLabels[variantName]}</span>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
