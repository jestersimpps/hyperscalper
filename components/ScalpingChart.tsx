'use client';

import { useEffect, useRef, useState } from 'react';
import type { CandleData, TimeInterval } from '@/types';
import type { Position } from '@/models/Position';
import type { Order } from '@/models/Order';
import { useCandleStore } from '@/stores/useCandleStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { getThemeColors } from '@/lib/theme-utils';
import { calculateEMA, calculateMACD, calculateStochastic, type StochasticData } from '@/lib/indicators';
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


export default function ScalpingChart({ coin, interval, onPriceUpdate, onChartReady, candleData, isExternalData = false, macdCandleData, position, orders }: ScalpingChartProps) {
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
  const positionLineRef = useRef<any>(null);
  const orderLinesRef = useRef<any[]>([]);
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
                top: 0.65,
                bottom: 0.25,
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
              top: 0.55,
              bottom: 0.35,
            },
          });

          signalSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.55,
              bottom: 0.35,
            },
          });

          histogramSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.55,
              bottom: 0.35,
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

    const macdIntervalConfig = macdSettings.timeframes?.[interval];
    const macdResult = (!macdSettings.showMultiTimeframe && macdIntervalConfig?.enabled)
      ? calculateMACD(closePrices, macdIntervalConfig.fastPeriod, macdIntervalConfig.slowPeriod, macdIntervalConfig.signalPeriod)
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
  }, [candles, chartReady, onPriceUpdate, emaSettings, macdSettings]);


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
        lineStyle: 2, // dashed
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
        let lineStyle = 0; // solid for regular limit orders
        let opacity = 1;

        if (order.orderType === 'stop') {
          lineStyle = 1; // dotted for stop loss
          opacity = 0.8;
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
