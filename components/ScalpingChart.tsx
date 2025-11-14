'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { CandleData, TimeInterval } from '@/types';
import type { Position } from '@/models/Position';
import type { Order } from '@/models/Order';
import { useCandleStore } from '@/stores/useCandleStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useChartSyncStore } from '@/stores/useChartSyncStore';
import { getThemeColors } from '@/lib/theme-utils';
import { useDebouncedCallback, useThrottledCallback } from '@/lib/performance-utils';
import ChartLegend from '@/components/ChartLegend';
import {
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateStochastic,
  calculateEMAMemoized,
  calculateMACDMemoized,
  calculateStochasticMemoized,
  detectPivots,
  detectStochasticPivots,
  detectDivergence,
  detectMacdReversals,
  detectRsiReversals,
  calculateTrendlines,
  calculatePivotLines,
  type StochasticData,
  type DivergencePoint,
  type ReversalMarker,
} from '@/lib/indicators';
import { getCandleTimeWindow } from '@/lib/time-utils';
import { DEFAULT_CANDLE_COUNT } from '@/lib/constants';
import { invertCandles } from '@/lib/candle-utils';
import { calculateBreakevenPrice } from '@/lib/breakeven-utils';

interface ScalpingChartProps {
  coin: string;
  interval: TimeInterval;
  onPriceUpdate?: (price: number) => void;
  onChartReady?: (chart: any) => void;
  onChartClick?: (data: { time: number; price: number }) => void;
  candleData?: CandleData[];
  isExternalData?: boolean;
  macdCandleData?: Record<TimeInterval, CandleData[]>;
  position?: Position | null;
  orders?: Order[];
  syncZoom?: boolean;
  simplifiedView?: boolean;
  hideStochastic?: boolean;
}

interface CrossoverMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
}

const SIGNAL_COLORS = {
  ema: '#00D9FF',
  macd: '#FF6B35',
  rsi: '#FFD700',
  divergence: '#9D4EDD',
  hiddenDivergence: '#00FF7F',
  pivot: '#888888',
};


function detectCrossovers(ema1: number[], ema2: number[], ema3: number[] | null, candles: CandleData[]): any[] {
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
          color: SIGNAL_COLORS.ema,
          shape: 'circle',
          text: '',
          id: `buy-${i}`
        });
      } else if (!wasBearish && isBearish) {
        markers.push({
          time: candles[i].time / 1000,
          position: 'aboveBar',
          color: SIGNAL_COLORS.ema,
          shape: 'circle',
          text: '',
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
          color: SIGNAL_COLORS.ema,
          shape: 'circle',
          text: '',
          id: `buy-${i}`
        });
      } else if (prevEma1 >= prevEma2 && currEma1 < currEma2) {
        markers.push({
          time: candles[i].time / 1000,
          position: 'aboveBar',
          color: SIGNAL_COLORS.ema,
          shape: 'circle',
          text: '',
          id: `sell-${i}`
        });
      }
    }
  }

  return markers;
}

function createPivotMarkers(candles: CandleData[]): any[] {
  const pivots = detectPivots(candles, 2);
  const markers: any[] = [];

  pivots.forEach((pivot) => {
    markers.push({
      time: pivot.time / 1000,
      position: pivot.type === 'high' ? 'aboveBar' : 'belowBar',
      color: SIGNAL_COLORS.pivot,
      shape: 'circle',
      text: '',
      id: `pivot-${pivot.type}-${pivot.index}`
    });
  });

  return markers;
}

function createStochasticPivotMarkers(stochData: StochasticData[], candles: CandleData[]): any[] {
  const pivots = detectStochasticPivots(stochData, candles, 3);
  const markers: any[] = [];

  pivots.forEach((pivot) => {
    markers.push({
      time: pivot.time / 1000,
      position: pivot.type === 'high' ? 'aboveBar' : 'belowBar',
      color: SIGNAL_COLORS.pivot,
      shape: 'circle',
      text: '',
      id: `stoch-pivot-${pivot.type}-${pivot.index}`
    });
  });

  return markers;
}

function createDivergenceMarkers(divergences: DivergencePoint[]): any[] {
  const markers: any[] = [];

  divergences.forEach((div) => {
    let color = '';
    let position: 'aboveBar' | 'belowBar' = 'aboveBar';

    switch (div.type) {
      case 'bullish':
        color = SIGNAL_COLORS.divergence;
        position = 'belowBar';
        break;
      case 'bearish':
        color = SIGNAL_COLORS.divergence;
        position = 'aboveBar';
        break;
      case 'hidden-bullish':
        color = SIGNAL_COLORS.hiddenDivergence;
        position = 'belowBar';
        break;
      case 'hidden-bearish':
        color = SIGNAL_COLORS.hiddenDivergence;
        position = 'aboveBar';
        break;
    }

    markers.push({
      time: div.endTime / 1000,
      position: position,
      color: color,
      shape: 'circle',
      text: '',
      id: `div-${div.type}-${div.endTime}`
    });
  });

  return markers;
}


export default function ScalpingChart({ coin, interval, onPriceUpdate, onChartReady, onChartClick, candleData, isExternalData = false, macdCandleData, position, orders, syncZoom = false, simplifiedView = false, hideStochastic = false }: ScalpingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const ema1SeriesRef = useRef<any>(null);
  const ema2SeriesRef = useRef<any>(null);
  const ema3SeriesRef = useRef<any>(null);
  const stochSeriesRefsRef = useRef<Record<string, { k?: any; d: any }>>({});
  const macdSeriesRefsRef = useRef<Record<string, { line: any; signal: any; histogram: any }>>({});
  const stochReferenceLinesRef = useRef<any[]>([]);
  const supportLineSeriesRef = useRef<any[]>([]);
  const resistanceLineSeriesRef = useRef<any[]>([]);
  const positionLineRef = useRef<any>(null);
  const breakevenBandSeriesRef = useRef<any>(null);
  const orderLinesRef = useRef<any[]>([]);
  const cachedTrendlinesRef = useRef<{ supportLine: any[]; resistanceLine: any[] }>({ supportLine: [], resistanceLine: [] });
  const lastTrendlineCalculationRef = useRef<number>(0);
  const [chartReady, setChartReady] = useState(false);
  const [divergencePoints, setDivergencePoints] = useState<DivergencePoint[]>([]);
  const candlesBufferRef = useRef<CandleData[]>([]);
  const lastCandleTimeRef = useRef<number | null>(null);

  const candleKey = `${coin}-${interval}`;
  const storeCandles = useCandleStore((state) => state.candles[candleKey]) || [];
  const storeLoading = useCandleStore((state) => state.loading[candleKey]) || false;
  const candleService = useCandleStore((state) => state.service);
  const getDecimals = useSymbolMetaStore((state) => state.getDecimals);
  const decimals = getDecimals(coin);

  const candles = isExternalData && candleData ? candleData : storeCandles;
  const isLoading = isExternalData ? false : storeLoading;
  const emaSettings = useSettingsStore((state) => state.settings.indicators.ema);
  const stochasticSettings = useSettingsStore((state) => state.settings.indicators.stochastic);
  const macdSettings = useSettingsStore((state) => state.settings.indicators.macd);
  const chartSettings = useSettingsStore((state) => state.settings.chart);

  const displayCandles = useMemo(
    () => invertCandles(candles, chartSettings?.invertedMode ?? false),
    [candles, chartSettings?.invertedMode]
  );

  const enabledMacdTimeframes = Object.entries(macdSettings.timeframes || {})
    .filter(([_, config]) => config.enabled && !simplifiedView && macdSettings.showMultiTimeframe)
    .map(([tf]) => tf as TimeInterval);

  const storeMacdCandles = useCandleStore((state) => state.candles);
  const allMacdCandles = isExternalData && macdCandleData ? macdCandleData : storeMacdCandles;

  useEffect(() => {
    let mounted = true;
    let resizeHandler: (() => void) | null = null;
    let containerClickHandler: ((event: MouseEvent) => void) | null = null;
    let canvasElements: HTMLCanvasElement[] = [];

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
            vertLines: { color: colors.primary + '20' },
            horzLines: { color: colors.primary + '20' },
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
              bottom: hideStochastic ? 0.15 : 0.45,
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
          color: colors.statusBullish,
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
        });


        // Stochastic series for variants
        const variantColors: Record<string, string> = {
          ultraFast: '#FF10FF',
          fast: '#00D9FF',
          medium: '#FF8C00',
          slow: '#00FF7F',
        };

        stochSeriesRefsRef.current = {};

        if (!hideStochastic) {
          if (simplifiedView) {
            const kSeries = chart.addLineSeries({
              color: colors.statusBullish,
              lineWidth: 1,
              priceScaleId: 'stoch',
              lastValueVisible: false,
              priceLineVisible: false,
              lineStyle: 2,
            });

            const dSeries = chart.addLineSeries({
              color: colors.accentRose,
              lineWidth: 1,
              priceScaleId: 'stoch',
              lastValueVisible: false,
              priceLineVisible: false,
            });

            kSeries.priceScale().applyOptions({
              scaleMargins: {
                top: 0.70,
                bottom: 0.05,
              },
            });

            dSeries.priceScale().applyOptions({
              scaleMargins: {
                top: 0.70,
                bottom: 0.05,
              },
            });

            stochSeriesRefsRef.current['simple'] = { k: kSeries, d: dSeries };
          } else if (stochasticSettings.showMultiVariant) {
            Object.entries(stochasticSettings.variants).forEach(([variantName, settings]) => {
              if (!settings.enabled) return;

              const dSeries = chart.addLineSeries({
                color: variantColors[variantName],
                lineWidth: 1,
                priceScaleId: 'stoch',
                lastValueVisible: false,
                priceLineVisible: false,
              });

              dSeries.priceScale().applyOptions({
                scaleMargins: {
                  top: 0.70,
                  bottom: 0.05,
                },
              });

              stochSeriesRefsRef.current[variantName] = { d: dSeries };
            });
          }
        }

        // MACD multi-timeframe series
        const macdTimeframeColors: Record<string, { line: string; signal: string }> = {
          '1m': { line: colors.accentBlue, signal: colors.accentRose },
          '5m': { line: colors.primary, signal: colors.statusBullish },
          '15m': { line: colors.statusBullish, signal: colors.accentRose },
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
              top: 0.50,
              bottom: 0.35,
            },
          });

          signalSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.50,
              bottom: 0.35,
            },
          });

          histogramSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.50,
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

        resizeHandler = () => {
          if (chartContainerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
              height: chartContainerRef.current.clientHeight || 600,
            });
          }
        };

        window.addEventListener('resize', resizeHandler);

        if (onChartClick && chartContainerRef.current) {
          const canvases = chartContainerRef.current.querySelectorAll('canvas');

          if (canvases.length > 0) {
            containerClickHandler = (event: MouseEvent) => {
              const target = event.currentTarget as HTMLCanvasElement;
              if (!target || !candleSeriesRef.current) return;

              const rect = target.getBoundingClientRect();
              const x = event.clientX - rect.left;
              const y = event.clientY - rect.top;

              const price = candleSeriesRef.current.coordinateToPrice(y);
              const time = chart.timeScale().coordinateToTime(x);

              if (price !== null && price !== undefined) {
                let timestamp: number;
                if (!time) {
                  timestamp = Date.now();
                } else if (typeof time === 'number') {
                  timestamp = time * 1000;
                } else {
                  timestamp = Date.now();
                }

                onChartClick({
                  time: timestamp,
                  price: price
                });
              }
            };

            if (containerClickHandler) {
              canvases.forEach((canvas) => {
                canvas.addEventListener('click', containerClickHandler!);
                canvasElements.push(canvas);
              });
            }
          }
        }

        if (mounted) {
          setChartReady(true);
          if (onChartReady) {
            onChartReady(chart);
          }
        }
      } catch (error) {
      }
    };

    initChart();

    return () => {
      mounted = false;
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      if (containerClickHandler) {
        canvasElements.forEach((canvas) => {
          canvas.removeEventListener('click', containerClickHandler!);
        });
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
        ema1SeriesRef.current = null;
        ema2SeriesRef.current = null;
        ema3SeriesRef.current = null;
        stochSeriesRefsRef.current = {};
      }
    };
  }, [simplifiedView, macdSettings.showMultiTimeframe, stochasticSettings.showMultiVariant, enabledMacdTimeframes.join(','), Object.entries(stochasticSettings.variants).filter(([_, v]) => v.enabled).map(([k]) => k).join(',')]);

  // Handle stochastic visibility toggle
  useEffect(() => {
    if (!chartReady || !chartRef.current) return;

    const chart = chartRef.current;
    const colors = getThemeColors();

    if (hideStochastic) {
      // Remove all stochastic series and reference lines
      Object.values(stochSeriesRefsRef.current).forEach((series) => {
        try {
          if (series.k) chart.removeSeries(series.k);
          if (series.d) chart.removeSeries(series.d);
        } catch (e) {}
      });

      // Clear reference lines
      stochReferenceLinesRef.current.forEach((line) => {
        try {
          const firstSeries = Object.values(stochSeriesRefsRef.current)[0];
          if (firstSeries?.d) {
            firstSeries.d.removePriceLine(line);
          }
        } catch (e) {}
      });
      stochReferenceLinesRef.current = [];

      // Clear series refs
      stochSeriesRefsRef.current = {};

      // Update chart scale margins - expand to use full height minus volume
      chart.applyOptions({
        rightPriceScale: {
          scaleMargins: {
            top: 0.1,
            bottom: 0.15,
          },
        },
      });
    } else {
      // Recreate stochastic series when toggled back on
      if (Object.keys(stochSeriesRefsRef.current).length === 0) {
        if (simplifiedView) {
          const kSeries = chart.addLineSeries({
            color: colors.statusBullish,
            lineWidth: 1,
            priceScaleId: 'stoch',
            lastValueVisible: false,
            priceLineVisible: false,
            lineStyle: 2,
          });

          const dSeries = chart.addLineSeries({
            color: colors.accentRose,
            lineWidth: 1,
            priceScaleId: 'stoch',
            lastValueVisible: false,
            priceLineVisible: false,
          });

          kSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.70,
              bottom: 0.05,
            },
          });

          dSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.70,
              bottom: 0.05,
            },
          });

          stochSeriesRefsRef.current['simple'] = { k: kSeries, d: dSeries };

          // Add reference lines
          const line20 = dSeries.createPriceLine({
            price: 20,
            color: colors.statusBearish + '60',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
            title: '',
          });

          const line80 = dSeries.createPriceLine({
            price: 80,
            color: colors.statusBullish + '60',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
            title: '',
          });

          stochReferenceLinesRef.current.push(line20, line80);
        }

        // Update chart scale margins
        chart.applyOptions({
          rightPriceScale: {
            scaleMargins: {
              top: 0.1,
              bottom: 0.45,
            },
          },
        });
      }
    }
  }, [hideStochastic, chartReady, simplifiedView]);

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
      }
      setTimeout(() => { isSyncing = false; }, 100);
    });

    return () => {
      unsubscribeTimeScale();
      unsubscribeStore();
    };
  }, [syncZoom, chartReady]);

  useEffect(() => {
    if (!chartReady || isExternalData || !candleService) return;

    const { startTime, endTime } = getCandleTimeWindow(interval, DEFAULT_CANDLE_COUNT);
    const { fetchCandles, subscribeToCandles, unsubscribeFromCandles } = useCandleStore.getState();
    fetchCandles(coin, interval, startTime, endTime);
    subscribeToCandles(coin, interval);

    // Fetch MACD data (skip in simplified view)
    if (!simplifiedView && macdSettings.showMultiTimeframe) {
      enabledMacdTimeframes.forEach(tf => {
        const { startTime: tfStart, endTime: tfEnd } = getCandleTimeWindow(tf, DEFAULT_CANDLE_COUNT);
        fetchCandles(coin, tf, tfStart, tfEnd);
        subscribeToCandles(coin, tf);
      });
    }

    // Fetch 1m data for stochastics (skip in simplified view - use chart's own data)
    if (!simplifiedView && stochasticSettings.showMultiVariant && interval !== '1m') {
      const { startTime: stochStart, endTime: stochEnd } = getCandleTimeWindow('1m', DEFAULT_CANDLE_COUNT);
      fetchCandles(coin, '1m', stochStart, stochEnd);
      subscribeToCandles(coin, '1m');
    }

    return () => {
      const { unsubscribeFromCandles } = useCandleStore.getState();
      unsubscribeFromCandles(coin, interval);

      if (!simplifiedView && macdSettings.showMultiTimeframe) {
        enabledMacdTimeframes.forEach(tf => {
          unsubscribeFromCandles(coin, tf);
        });
      }

      if (!simplifiedView && stochasticSettings.showMultiVariant && interval !== '1m') {
        unsubscribeFromCandles(coin, '1m');
      }
    };
  }, [coin, interval, chartReady, isExternalData, candleService, simplifiedView, enabledMacdTimeframes.join(','), macdSettings.showMultiTimeframe, stochasticSettings.showMultiVariant]);

  useEffect(() => {
    lastCandleTimeRef.current = null;
  }, [interval]);

  const closePrices = useMemo(() => displayCandles.map(c => c.close), [displayCandles]);

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
    const macdIntervalConfig = macdSettings.timeframes?.[interval as keyof typeof macdSettings.timeframes];
    return ((!macdSettings.showMultiTimeframe || simplifiedView) && macdIntervalConfig?.enabled)
      ? calculateMACDMemoized(closePrices, macdIntervalConfig.fastPeriod, macdIntervalConfig.slowPeriod, macdIntervalConfig.signalPeriod)
      : { macd: [], signal: [], histogram: [] };
  }, [closePrices, macdSettings.showMultiTimeframe, macdSettings.timeframes, interval, simplifiedView]);

  const rsi = useMemo(() => {
    return calculateRSI(closePrices, 14);
  }, [closePrices]);

  const simpleStochastic = useMemo(() => {
    if (!simplifiedView) return null;
    return calculateStochasticMemoized(displayCandles, 14, 3, 3);
  }, [displayCandles, simplifiedView]);

  const pivotMarkers = useMemo(() => {
    return chartSettings?.showPivotMarkers ? createPivotMarkers(displayCandles) : [];
  }, [displayCandles, chartSettings?.showPivotMarkers]);

  const divergenceMarkers = useMemo(() => {
    return stochasticSettings.showDivergence && divergencePoints.length > 0
      ? createDivergenceMarkers(divergencePoints)
      : [];
  }, [divergencePoints, stochasticSettings.showDivergence]);

  const macdReversalMarkers = useMemo(() => {
    return macdResult.macd.length > 0
      ? detectMacdReversals(macdResult, displayCandles).map(r => ({
          time: r.time / 1000,
          position: r.position,
          color: SIGNAL_COLORS.macd,
          shape: 'circle' as const,
          text: '',
        }))
      : [];
  }, [macdResult, displayCandles]);

  const rsiReversalMarkers = useMemo(() => {
    return rsi.length > 0
      ? detectRsiReversals(rsi, displayCandles, 30, 70).map(r => ({
          time: r.time / 1000,
          position: r.position,
          color: SIGNAL_COLORS.rsi,
          shape: 'circle' as const,
          text: '',
        }))
      : [];
  }, [rsi, displayCandles]);

  const crossoverMarkers = useMemo(() => {
    if (emaSettings.ema1.enabled && emaSettings.ema2.enabled && ema1.length > 0 && ema2.length > 0) {
      const ema3ForDetection = emaSettings.ema3.enabled && ema3.length > 0 ? ema3 : null;
      return detectCrossovers(ema1, ema2, ema3ForDetection, displayCandles);
    }
    return [];
  }, [emaSettings.ema1.enabled, emaSettings.ema2.enabled, emaSettings.ema3.enabled, ema1, ema2, ema3, displayCandles]);

  const rafRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef(false);

  const updateChartWithRAF = useCallback((updateFn: () => void) => {
    if (pendingUpdateRef.current) return;

    pendingUpdateRef.current = true;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      updateFn();
      pendingUpdateRef.current = false;
      rafRef.current = null;
    });
  }, []);

  const detectDivergencesDebounced = useDebouncedCallback(() => {
    if (!simplifiedView && stochasticSettings.showMultiVariant && stochasticSettings.showDivergence && displayCandles.length >= 50) {
      const stochCandles = interval === '1m' ? candles : (isExternalData ? allMacdCandles['1m'] : useCandleStore.getState().candles[`${coin}-1m`]);
      const displayStochCandles = invertCandles(stochCandles, chartSettings?.invertedMode ?? false);

      if (displayStochCandles && displayStochCandles.length >= 50) {
        let currentDivergences: DivergencePoint[] = [];

        Object.entries(stochasticSettings.variants).forEach(([variantName, variantConfig]) => {
          if (!variantConfig.enabled) return;

          const stochData = calculateStochasticMemoized(displayStochCandles, variantConfig.period, variantConfig.smoothK, variantConfig.smoothD);
          if (stochData.length === 0) return;

          const offset = displayStochCandles.length - stochData.length;
          const alignedCandles = displayStochCandles.slice(offset);

          const pricePivots = detectPivots(alignedCandles, 3);
          const stochPivots = detectStochasticPivots(stochData, alignedCandles, 3);
          const divergences = detectDivergence(pricePivots, stochPivots, alignedCandles);

          currentDivergences.push(...divergences);
        });

        setDivergencePoints(currentDivergences);
      }
    }
  }, 1000);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    detectDivergencesDebounced();
  }, [displayCandles, simplifiedView, stochasticSettings.showMultiVariant, stochasticSettings.showDivergence, stochasticSettings.variants, interval, candles, isExternalData, allMacdCandles, coin, chartSettings]);

  useEffect(() => {
    if (!chartReady || !candleSeriesRef.current || displayCandles.length === 0) return;

    candlesBufferRef.current = displayCandles;

    const candleData = displayCandles.map(c => ({
      time: (c.time / 1000) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const colors = getThemeColors();
    const volumeData = displayCandles.map(c => ({
      time: (c.time / 1000) as any,
      value: c.volume,
      color: c.close >= c.open ? colors.statusBullish + '80' : colors.statusBearish + '80',
    }));

    const lastCandle = displayCandles[displayCandles.length - 1];
    const isNewCandle = lastCandleTimeRef.current !== null && lastCandle.time !== lastCandleTimeRef.current;

    if (isNewCandle || lastCandleTimeRef.current === null) {
      updateChartWithRAF(() => {
        candleSeriesRef.current?.setData(candleData);
        volumeSeriesRef.current?.setData(volumeData);

        if (emaSettings.ema1.enabled && ema1.length > 0) {
          const ema1Data = ema1.map((value, i) => ({
            time: (displayCandles[i].time / 1000) as any,
            value,
          }));
          ema1SeriesRef.current?.setData(ema1Data);
        } else {
          ema1SeriesRef.current?.setData([]);
        }

        if (emaSettings.ema2.enabled && ema2.length > 0) {
          const ema2Data = ema2.map((value, i) => ({
            time: (displayCandles[i].time / 1000) as any,
            value,
          }));
          ema2SeriesRef.current?.setData(ema2Data);
        } else {
          ema2SeriesRef.current?.setData([]);
        }

        if (emaSettings.ema3.enabled && ema3.length > 0) {
          const ema3Data = ema3.map((value, i) => ({
            time: (displayCandles[i].time / 1000) as any,
            value,
          }));
          ema3SeriesRef.current?.setData(ema3Data);
        } else {
          ema3SeriesRef.current?.setData([]);
        }

        const allMarkers = crossoverMarkers.length > 0
          ? [...pivotMarkers, ...divergenceMarkers, ...crossoverMarkers, ...macdReversalMarkers, ...rsiReversalMarkers]
          : [...pivotMarkers, ...divergenceMarkers, ...macdReversalMarkers, ...rsiReversalMarkers];

        candleSeriesRef.current?.setMarkers(allMarkers.sort((a, b) => a.time - b.time));
      });
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

    }

    lastCandleTimeRef.current = lastCandle.time;

    if (onPriceUpdate) {
      onPriceUpdate(lastCandle.close);
    }
  }, [displayCandles, chartReady, onPriceUpdate, ema1, ema2, ema3, macdResult, rsi, emaSettings.ema1.enabled, emaSettings.ema2.enabled, emaSettings.ema3.enabled, stochasticSettings.showMultiVariant, stochasticSettings.showDivergence, stochasticSettings.variants, interval, allMacdCandles, coin, isExternalData, chartSettings]);


  // MACD multi-timeframe data update
  useEffect(() => {
    if (!chartReady || Object.keys(macdSeriesRefsRef.current).length === 0) return;
    if (simplifiedView || !macdSettings.showMultiTimeframe) return;

    const colors = getThemeColors();

    enabledMacdTimeframes.forEach((timeframe) => {
      const macdCandles = isExternalData ? allMacdCandles[timeframe] : allMacdCandles[`${coin}-${timeframe}` as TimeInterval];
      if (!macdCandles || macdCandles.length === 0) return;

      const config = macdSettings.timeframes?.[timeframe as keyof typeof macdSettings.timeframes];
      if (!config) return;

      const validCandles = macdCandles.filter(c => c && typeof c.close === 'number');
      if (validCandles.length === 0) return;

      const displayMacdCandles = invertCandles(validCandles, chartSettings?.invertedMode ?? false);
      const closePrices = displayMacdCandles.map(c => c.close);
      const macdData = calculateMACD(closePrices, config.fastPeriod, config.slowPeriod, config.signalPeriod);

      if (macdData.macd.length > 0 && macdSeriesRefsRef.current[timeframe]) {
        const offset = displayMacdCandles.length - macdData.macd.length;

        macdSeriesRefsRef.current[timeframe].line.setData(macdData.macd.map((value, i) => ({
          time: (displayMacdCandles[i + offset].time / 1000) as any,
          value,
        })));

        macdSeriesRefsRef.current[timeframe].signal.setData(macdData.signal.map((value, i) => ({
          time: (displayMacdCandles[i + offset].time / 1000) as any,
          value,
        })));

        macdSeriesRefsRef.current[timeframe].histogram.setData(macdData.histogram.map((value, i) => ({
          time: (displayMacdCandles[i + offset].time / 1000) as any,
          value,
          color: value >= 0 ? colors.statusBullish + '80' : colors.statusBearish + '80',
        })));
      }
    });
  }, [chartReady, enabledMacdTimeframes.join(','), allMacdCandles, macdSettings, coin, isExternalData]);

  // Stochastic data update (simple for simplified view, multi-variant otherwise)
  useEffect(() => {
    if (!chartReady || Object.keys(stochSeriesRefsRef.current).length === 0 || hideStochastic) return;

    // Simple stochastic for simplified view
    if (simplifiedView && simpleStochastic && simpleStochastic.length > 0 && stochSeriesRefsRef.current['simple']) {
      const offset = displayCandles.length - simpleStochastic.length;

      stochSeriesRefsRef.current['simple'].k.setData(simpleStochastic.map((value, i) => ({
        time: (displayCandles[i + offset].time / 1000) as any,
        value: value.k,
      })));

      stochSeriesRefsRef.current['simple'].d.setData(simpleStochastic.map((value, i) => ({
        time: (displayCandles[i + offset].time / 1000) as any,
        value: value.d,
      })));
      return;
    }

    // Multi-variant stochastic for normal view
    if (!stochasticSettings.showMultiVariant) return;

    const stochCandles = interval === '1m' ? candles : (isExternalData ? allMacdCandles['1m'] : useCandleStore.getState().candles[`${coin}-1m`]);
    if (!stochCandles || stochCandles.length === 0) return;

    const displayStochCandles = invertCandles(stochCandles, chartSettings?.invertedMode ?? false);

    const colors = getThemeColors();
    const enabledVariants = Object.entries(stochasticSettings.variants).filter(([_, config]) => config.enabled);
    let slowestVariant: [string, { config: any; stochData: any; offset: number }] | null = null;

    Object.entries(stochasticSettings.variants).forEach(([variantName, config]) => {
      if (!config.enabled || !stochSeriesRefsRef.current[variantName]) return;

      const stochData = calculateStochastic(displayStochCandles, config.period, config.smoothK, config.smoothD);

      if (stochData.length > 0) {
        const offset = displayStochCandles.length - stochData.length;

        stochSeriesRefsRef.current[variantName].d.setData(stochData.map((value, i) => ({
          time: (displayStochCandles[i + offset].time / 1000) as any,
          value: value.d,
        })));

        if (!slowestVariant || config.period > slowestVariant[1].config.period) {
          slowestVariant = [variantName, { config, stochData, offset }];
        }
      }
    });

    if (slowestVariant) {
      const variantName = slowestVariant[0];
      const { stochData, offset } = slowestVariant[1];
      const stochMarkers = chartSettings?.showPivotMarkers
        ? createStochasticPivotMarkers(stochData, displayStochCandles.slice(offset))
        : [];
      stochSeriesRefsRef.current[variantName].d.setMarkers(stochMarkers);
    }
  }, [chartReady, displayCandles, interval, allMacdCandles, stochasticSettings, chartSettings, coin, isExternalData, simplifiedView, simpleStochastic]);

  // Simple stochastic reference lines (20 and 80)
  useEffect(() => {
    if (!chartReady || !simplifiedView || !stochSeriesRefsRef.current['simple'] || hideStochastic) return;

    stochReferenceLinesRef.current.forEach((line) => {
      try {
        if (stochSeriesRefsRef.current['simple']?.d) {
          stochSeriesRefsRef.current['simple'].d.removePriceLine(line);
        }
      } catch (e) {}
    });
    stochReferenceLinesRef.current = [];

    const dSeries = stochSeriesRefsRef.current['simple']?.d;
    if (dSeries) {
      const colors = getThemeColors();

      const line20 = dSeries.createPriceLine({
        price: 20,
        color: colors.statusBearish + '60',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: '',
      });

      const line80 = dSeries.createPriceLine({
        price: 80,
        color: colors.statusBullish + '60',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: '',
      });

      stochReferenceLinesRef.current.push(line20, line80);
    }

    return () => {
      stochReferenceLinesRef.current.forEach((line) => {
        try {
          if (stochSeriesRefsRef.current['simple']?.d) {
            stochSeriesRefsRef.current['simple'].d.removePriceLine(line);
          }
        } catch (e) {}
      });
      stochReferenceLinesRef.current = [];
    };
  }, [chartReady, simplifiedView]);

  // Multi-variant stochastic reference lines (0 and 100)
  useEffect(() => {
    if (!chartReady || Object.keys(stochSeriesRefsRef.current).length === 0 || hideStochastic) return;
    if (simplifiedView || !stochasticSettings.showMultiVariant) return;

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
        color: colors.borderFrame,
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: false,
        title: '',
      });

      const line100 = firstSeries.createPriceLine({
        price: 100,
        color: colors.borderFrame,
        lineWidth: 1,
        lineStyle: 0,
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

  const trendlines = useMemo(() => {
    const currentLength = displayCandles.length;

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

    const newTrendlines = calculateTrendlines(displayCandles);
    cachedTrendlinesRef.current = newTrendlines;
    lastTrendlineCalculationRef.current = currentLength;
    return newTrendlines;
  }, [displayCandles.length, displayCandles]);

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

      let displayPrice = position.entryPrice;
      let displaySide = position.side;
      if (chartSettings?.invertedMode && displayCandles.length > 0) {
        const referencePrice = candles[0]?.close || displayCandles[0]?.close;
        displayPrice = 2 * referencePrice - position.entryPrice;
        displaySide = isLong ? 'short' : 'long';
      }

      positionLineRef.current = candleSeriesRef.current.createPriceLine({
        price: displayPrice,
        color: isLong ? colors.statusBullish : colors.statusBearish,
        lineWidth: 2,
        lineStyle: 0, // solid
        axisLabelVisible: true,
        title: `ENTRY ${displaySide.toUpperCase()}`,
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
  }, [position, chartReady, chartSettings?.invertedMode, displayCandles.length, candles]);

  // Breakeven band overlay
  useEffect(() => {
    if (!chartReady || !chartRef.current || !position) return;

    // Remove existing breakeven band if it exists
    if (breakevenBandSeriesRef.current) {
      try {
        chartRef.current.removeSeries(breakevenBandSeriesRef.current);
      } catch (e) {
        // Ignore errors
      }
      breakevenBandSeriesRef.current = null;
    }

    // Create breakeven band if position exists and we have candles to display
    if (position && displayCandles.length > 0) {
      const breakevenPrice = calculateBreakevenPrice(
        position.entryPrice,
        position.side,
        position.size
      );

      let displayEntryPrice = position.entryPrice;
      let displayBreakevenPrice = breakevenPrice;

      if (chartSettings?.invertedMode && candles.length > 0) {
        const referencePrice = candles[0]?.close || displayCandles[0]?.close;
        displayEntryPrice = 2 * referencePrice - position.entryPrice;
        displayBreakevenPrice = 2 * referencePrice - breakevenPrice;
      }

      // Create baseline series with entry as baseline and breakeven as data
      const breakevenBandSeries = chartRef.current.addBaselineSeries({
        baseValue: { type: 'price', price: displayEntryPrice },
        topFillColor1: 'rgba(255, 255, 0, 0.15)',
        topFillColor2: 'rgba(255, 255, 0, 0.05)',
        bottomFillColor1: 'rgba(255, 255, 0, 0.15)',
        bottomFillColor2: 'rgba(255, 255, 0, 0.05)',
        lineColor: 'rgba(255, 255, 0, 0)',
        lineWidth: 0,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        priceFormat: {
          type: 'price',
          precision: decimals.price,
          minMove: 1 / Math.pow(10, decimals.price),
        },
      });

      // Set data points at breakeven price spanning all candles
      const breakevenData = displayCandles.map((candle) => ({
        time: (candle.time / 1000) as any,
        value: displayBreakevenPrice,
      }));

      breakevenBandSeries.setData(breakevenData);
      breakevenBandSeriesRef.current = breakevenBandSeries;
    }

    // Cleanup on unmount or position change
    return () => {
      if (breakevenBandSeriesRef.current && chartRef.current) {
        try {
          chartRef.current.removeSeries(breakevenBandSeriesRef.current);
        } catch (e) {
          // Ignore errors during cleanup
        }
        breakevenBandSeriesRef.current = null;
      }
    };
  }, [position, chartReady, chartSettings?.invertedMode, displayCandles, candles, decimals.price]);

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

      const fadeColor = (hexColor: string, opacity: number): string => {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      };

      orders.forEach((order) => {
        const isBuy = order.side === 'buy';
        const baseColor = isBuy ? colors.statusBullish : colors.statusBearish;
        const isOptimistic = order.isOptimistic || false;
        const isPending = order.isPendingCancellation || false;

        const color = isPending
          ? '#808080'
          : isOptimistic
            ? fadeColor(baseColor, 0.5)
            : baseColor;

        const lineStyle = isOptimistic ? 2 : 1;

        let displayPrice = order.price;
        let displaySide = order.side;
        if (chartSettings?.invertedMode && displayCandles.length > 0) {
          const referencePrice = candles[0]?.close || displayCandles[0]?.close;
          displayPrice = 2 * referencePrice - order.price;
          displaySide = isBuy ? 'sell' : 'buy';
        }

        const title = isOptimistic
          ? `PENDING ${displaySide.toUpperCase()} ${order.orderType.toUpperCase()}`
          : isPending
            ? `CANCELLING ${displaySide.toUpperCase()} ${order.orderType.toUpperCase()}`
            : `${displaySide.toUpperCase()} ${order.orderType.toUpperCase()}`;

        const orderLine = candleSeriesRef.current.createPriceLine({
          price: displayPrice,
          color,
          lineWidth: 2,
          lineStyle,
          axisLabelVisible: true,
          title,
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
  }, [orders, chartReady, chartSettings?.invertedMode, displayCandles.length, candles]);

  const variantColorVars: Record<string, string> = {
    ultraFast: '#FF10FF',
    fast: '#00D9FF',
    medium: '#FF8C00',
    slow: '#00FF7F',
  };

  const variantLabels: Record<string, string> = {
    ultraFast: 'UF',
    fast: 'F',
    medium: 'M',
    slow: 'S',
  };

  return (
    <div className="relative flex flex-col h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary bg-opacity-90 z-10">
          <div className="text-primary">Loading chart...</div>
        </div>
      )}
      <div ref={chartContainerRef} className="flex-1 min-h-0" />
      <div className="mt-1 flex gap-3 text-[9px] items-center">
        <ChartLegend className="flex-shrink-0" />
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
            <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--status-bullish)' }}></div>
            <span className="text-primary-muted">EMA {emaSettings.ema3.period}</span>
          </div>
        )}
        {macdResult.macd.length > 0 && (
          <>
            <div className="w-px h-4 bg-frame mx-1"></div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--accent-blue)' }}></div>
              <span className="text-primary-muted">MACD</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--accent-rose)' }}></div>
              <span className="text-primary-muted">Signal</span>
            </div>
          </>
        )}
        {simplifiedView && simpleStochastic && (
          <>
            <div className="w-px h-4 bg-frame mx-1"></div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-accent-green"></div>
              <span className="text-primary-muted">Stoch K</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-accent-purple"></div>
              <span className="text-primary-muted">Stoch D</span>
            </div>
          </>
        )}
        {!simplifiedView && stochasticSettings.showMultiVariant && Object.entries(stochasticSettings.variants).some(([_, v]) => v.enabled) && (
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
