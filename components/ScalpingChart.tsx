'use client';

import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { CandleData, TimeInterval } from '@/types';
import type { Position } from '@/models/Position';
import type { Order } from '@/models/Order';
import { useCandleStore } from '@/stores/useCandleStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useChartSyncStore } from '@/stores/useChartSyncStore';
import { useOrderbookStore } from '@/stores/useOrderbookStore';
import { useTradesStore } from '@/stores/useTradesStore';
import { useScannerStore } from '@/stores/useScannerStore';
import { INTERVAL_TO_MS } from '@/lib/time-utils';
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
  calculateForecastFan,
  computeOrderbookImbalance,
  computeTradeFlow,
  computeScannerBias,
  tuneForecastFromCandles,
  type StochasticData,
  type DivergencePoint,
  type ReversalMarker,
  type ForecastTuningResult,
} from '@/lib/indicators';
import { getCandleTimeWindow } from '@/lib/time-utils';
import { DEFAULT_CANDLE_COUNT } from '@/lib/constants';
import { invertCandles } from '@/lib/candle-utils';
import { calculateBreakevenPrice } from '@/lib/breakeven-utils';
import {
  projectEMAAlongPath,
  projectRSIAlongPath,
  projectStochAlongPath,
  projectMACDAlongPath,
} from '@/lib/projections';

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
  referenceMode?: boolean;
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


export default function ScalpingChart({ coin, interval, onPriceUpdate, onChartReady, onChartClick, candleData, isExternalData = false, macdCandleData, position, orders, syncZoom = false, simplifiedView: simplifiedViewProp = false, hideStochastic: hideStochasticProp = false, referenceMode = false }: ScalpingChartProps) {
  const simplifiedView = simplifiedViewProp || referenceMode;
  const hideStochastic = hideStochasticProp || referenceMode;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const ema1SeriesRef = useRef<any>(null);
  const ema2SeriesRef = useRef<any>(null);
  const ema3SeriesRef = useRef<any>(null);
  const stochSeriesRefsRef = useRef<Record<string, { k?: any; d: any }>>({});
  const macdSeriesRefsRef = useRef<Record<string, { line: any; signal: any; histogram: any }>>({});
  const forecastSeriesRef = useRef<{ median: any; markers: any[] } | null>(null);
  const projectionSeriesRef = useRef<{
    ema1: any;
    ema2: any;
    ema3: any;
    rsi: any;
    stoch: Record<string, any>;
    macd: any;
    support: any;
    resistance: any;
  } | null>(null);
  const smoothedDeltasRef = useRef<number[] | null>(null);
  const stochReferenceLinesRef = useRef<any[]>([]);
  const supportLineSeriesRef = useRef<any[]>([]);
  const resistanceLineSeriesRef = useRef<any[]>([]);
  const positionLineRef = useRef<any>(null);
  const breakevenBandSeriesRef = useRef<any>(null);
  const orderLinesRef = useRef<Map<string, { line: any; sig: string }>>(new Map());
  const cachedTrendlinesRef = useRef<{ supportLine: any[]; resistanceLine: any[] }>({ supportLine: [], resistanceLine: [] });
  const lastTrendlineCalculationRef = useRef<number>(0);
  const lastSeriesKeyRef = useRef<string>('');
  const [chartReady, setChartReady] = useState(false);
  const [divergencePoints, setDivergencePoints] = useState<DivergencePoint[]>([]);
  const candlesBufferRef = useRef<CandleData[]>([]);

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
              top: referenceMode ? 0.08 : 0.1,
              bottom: referenceMode ? 0.08 : (hideStochastic ? 0.15 : 0.45),
            },
            minimumWidth: syncZoom ? 80 : 0,
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

        const forecastMedianSeries = chart.addLineSeries({
          color: 'transparent',
          lineWidth: 1,
          lineStyle: 0,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          autoscaleInfoProvider: () => null,
        });

        const forecastArrowMarkerSeries = Array.from({ length: 5 }, () =>
          chart.addLineSeries({
            color: 'transparent',
            lineWidth: 1,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
            autoscaleInfoProvider: () => null,
          }),
        );

        const makeProjection = (color: string) =>
          chart.addLineSeries({
            color,
            lineWidth: 2,
            lineStyle: 1,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
            autoscaleInfoProvider: () => null,
          });

        const projectionColor = colors.primaryMuted;
        const projectionEma1Series = makeProjection(projectionColor);
        const projectionEma2Series = makeProjection(projectionColor);
        const projectionEma3Series = makeProjection(projectionColor);
        const projectionRsiSeries = makeProjection(projectionColor);
        const projectionStochSeriesByVariant: Record<string, any> = {
          ultraFast: makeProjection(projectionColor),
          fast: makeProjection(projectionColor),
          medium: makeProjection(projectionColor),
          slow: makeProjection(projectionColor),
        };
        const projectionMacdSeries = makeProjection(projectionColor);
        const projectionSupportSeries = makeProjection(projectionColor);
        const projectionResistanceSeries = makeProjection(projectionColor);

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
        forecastSeriesRef.current = { median: forecastMedianSeries, markers: forecastArrowMarkerSeries };
        projectionSeriesRef.current = {
          ema1: projectionEma1Series,
          ema2: projectionEma2Series,
          ema3: projectionEma3Series,
          rsi: projectionRsiSeries,
          stoch: projectionStochSeriesByVariant,
          macd: projectionMacdSeries,
          support: projectionSupportSeries,
          resistance: projectionResistanceSeries,
        };
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
        console.error('[chart-init]', error);
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
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        pendingUpdateRef.current = false;
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
        forecastSeriesRef.current = null;
        projectionSeriesRef.current = null;
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
            top: referenceMode ? 0.08 : 0.1,
            bottom: referenceMode ? 0.08 : 0.15,
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
  }, [hideStochastic, chartReady, simplifiedView, referenceMode]);

  useEffect(() => {
    if (!syncZoom || !chartRef.current || !chartReady) return;

    const chart = chartRef.current;
    const timeScale = chart.timeScale();
    const { visibleLogicalRange, setVisibleLogicalRange } = useChartSyncStore.getState();
    let isSyncing = false;

    if (visibleLogicalRange) {
      try {
        timeScale.setVisibleLogicalRange(visibleLogicalRange);
      } catch (e) {
      }
    } else {
      timeScale.scrollToRealTime();
      const range = timeScale.getVisibleLogicalRange();
      if (range) {
        setVisibleLogicalRange({ from: range.from as number, to: range.to as number });
      }
    }

    const handleVisibleLogicalRangeChange = () => {
      if (isSyncing) return;

      const range = timeScale.getVisibleLogicalRange();
      if (range) {
        isSyncing = true;
        setVisibleLogicalRange({ from: range.from as number, to: range.to as number });
        setTimeout(() => { isSyncing = false; }, 100);
      }
    };

    const unsubscribeTimeScale = timeScale.subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

    const unsubscribeStore = useChartSyncStore.subscribe((state) => {
      if (isSyncing || !state.visibleLogicalRange) return;

      isSyncing = true;
      try {
        timeScale.setVisibleLogicalRange(state.visibleLogicalRange);
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

  const lastFitKeyRef = useRef<string>('');
  useEffect(() => {
    if (!chartReady || !chartRef.current || displayCandles.length === 0) return;
    const key = `${coin}-${interval}`;
    if (lastFitKeyRef.current === key) return;
    lastFitKeyRef.current = key;
    try {
      chartRef.current.timeScale().fitContent();
      candleSeriesRef.current?.priceScale().applyOptions({ autoScale: true });
    } catch (e) {}
  }, [coin, interval, chartReady, displayCandles.length]);

  const showForecast = !!chartSettings?.showForecast && !referenceMode;

  useEffect(() => {
    if (!showForecast) return;

    const { subscribeToOrderbook, unsubscribeFromOrderbook } = useOrderbookStore.getState();
    const { subscribeToTrades, unsubscribeFromTrades } = useTradesStore.getState();
    subscribeToOrderbook(coin, 4);
    subscribeToTrades(coin);
    const isBtc = coin === 'BTC';
    if (!isBtc) subscribeToOrderbook('BTC', 4);

    return () => {
      unsubscribeFromOrderbook(coin);
      unsubscribeFromTrades(coin);
      if (!isBtc) unsubscribeFromOrderbook('BTC');
    };
  }, [coin, showForecast]);

  const forecastTuningRef = useRef<ForecastTuningResult | null>(null);
  const tunedForKeyRef = useRef<string | null>(null);

  const hasEnoughCandlesForTune = displayCandles.length >= 150;
  useEffect(() => {
    if (!showForecast) {
      forecastTuningRef.current = null;
      tunedForKeyRef.current = null;
      return;
    }
    if (!hasEnoughCandlesForTune) return;
    const key = `${coin}-${interval}`;
    if (tunedForKeyRef.current === key) return;
    forecastTuningRef.current = tuneForecastFromCandles(displayCandles, 5, 100);
    tunedForKeyRef.current = key;
  }, [coin, interval, showForecast, hasEnoughCandlesForTune, displayCandles]);

  const orderbookSnapshot = useOrderbookStore((state) => state.books[coin]);
  const btcOrderbookSnapshot = useOrderbookStore((state) => state.books['BTC']);
  const recentTrades = useTradesStore((state) => state.trades[coin]);
  const scannerResult = useScannerStore((state) =>
    state.results.find((r) => r.symbol === coin)
  );

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

  const forecastFan = useMemo(() => {
    if (!showForecast || displayCandles.length < 5) return [];
    const intervalMs = INTERVAL_TO_MS[interval];
    if (!intervalMs) return [];

    const bestBid = orderbookSnapshot?.bestBid ?? null;
    const bestAsk = orderbookSnapshot?.bestAsk ?? null;
    const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : undefined;

    const obImb = computeOrderbookImbalance(
      orderbookSnapshot?.bids ?? [],
      orderbookSnapshot?.asks ?? [],
      10,
      mid,
    );
    const isBtc = coin === 'BTC';
    const btcMid = !isBtc && btcOrderbookSnapshot?.bestBid != null && btcOrderbookSnapshot?.bestAsk != null
      ? (btcOrderbookSnapshot.bestBid + btcOrderbookSnapshot.bestAsk) / 2
      : undefined;
    const btcObImb = isBtc ? 0 : computeOrderbookImbalance(
      btcOrderbookSnapshot?.bids ?? [],
      btcOrderbookSnapshot?.asks ?? [],
      10,
      btcMid,
    );
    const flow = computeTradeFlow(recentTrades ?? []);
    const scannerBias = computeScannerBias(
      scannerResult?.divergences as DivergencePoint[] | undefined,
      scannerResult?.emaAlignments,
    );
    const stoch = calculateStochasticMemoized(displayCandles, 14, 3, 3);
    const lastK = stoch.length > 0 ? stoch[stoch.length - 1].k : 50;
    const stochZ = (lastK - 50) / 50;

    const tuned = forecastTuningRef.current;
    return calculateForecastFan(displayCandles, {
      horizon: 10,
      intervalMs,
      volMode: tuned?.volMode,
      maxTiltSigmaFraction: tuned?.tiltCap,
      weights: tuned
        ? { obImb: 0.30, flowImb: 0.30, scannerBias: tuned.scannerWeight, stochZ: tuned.stochWeight, btcObImb: isBtc ? 0 : 0.15 }
        : (isBtc ? { btcObImb: 0 } : undefined),
      biases: {
        obImb,
        flowImb: flow.imbalance,
        scannerBias,
        stochZ,
        toxicity: flow.toxicity,
        btcObImb,
      },
    });
  }, [
    showForecast,
    displayCandles,
    interval,
    coin,
    orderbookSnapshot?.bids,
    orderbookSnapshot?.asks,
    orderbookSnapshot?.bestBid,
    orderbookSnapshot?.bestAsk,
    btcOrderbookSnapshot?.bids,
    btcOrderbookSnapshot?.asks,
    btcOrderbookSnapshot?.bestBid,
    btcOrderbookSnapshot?.bestAsk,
    recentTrades,
    scannerResult?.divergences,
    scannerResult?.emaAlignments,
  ]);

  const rafRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef(false);

  const updateChartWithRAF = useCallback((updateFn: () => void) => {
    if (pendingUpdateRef.current) return;

    pendingUpdateRef.current = true;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      pendingUpdateRef.current = false;
      if (!chartRef.current) return;
      updateFn();
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
    const newBarTime = (lastCandle.time / 1000) as number;
    const existingSeriesData = candleSeriesRef.current.data();
    const seriesLastTime = existingSeriesData.length > 0
      ? (existingSeriesData[existingSeriesData.length - 1].time as number)
      : null;
    const seriesKey = `${coin}-${interval}`;
    const keyChanged = lastSeriesKeyRef.current !== seriesKey;
    if (keyChanged) lastSeriesKeyRef.current = seriesKey;
    const canUpdateInPlace = !keyChanged && seriesLastTime !== null && newBarTime >= seriesLastTime;

    if (!canUpdateInPlace) {
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

        const showSignals = chartSettings?.showSignalMarkers !== false;
        const allMarkers = showSignals
          ? (crossoverMarkers.length > 0
              ? [...pivotMarkers, ...divergenceMarkers, ...crossoverMarkers, ...macdReversalMarkers, ...rsiReversalMarkers]
              : [...pivotMarkers, ...divergenceMarkers, ...macdReversalMarkers, ...rsiReversalMarkers])
          : [];

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
      } else {
        ema1SeriesRef.current?.setData([]);
      }

      if (emaSettings.ema2.enabled && ema2.length > 0) {
        ema2SeriesRef.current.update({
          time: (lastCandle.time / 1000) as any,
          value: ema2[ema2.length - 1],
        });
      } else {
        ema2SeriesRef.current?.setData([]);
      }

      if (emaSettings.ema3.enabled && ema3.length > 0) {
        ema3SeriesRef.current.update({
          time: (lastCandle.time / 1000) as any,
          value: ema3[ema3.length - 1],
        });
      } else {
        ema3SeriesRef.current?.setData([]);
      }

    }

    if (onPriceUpdate) {
      onPriceUpdate(lastCandle.close);
    }
  }, [displayCandles, chartReady, onPriceUpdate, ema1, ema2, ema3, macdResult, rsi, emaSettings.ema1.enabled, emaSettings.ema2.enabled, emaSettings.ema3.enabled, stochasticSettings.showMultiVariant, stochasticSettings.showDivergence, stochasticSettings.variants, interval, allMacdCandles, coin, isExternalData, chartSettings]);

  useEffect(() => {
    if (!chartReady || !forecastSeriesRef.current) return;
    const ref = forecastSeriesRef.current;

    if (!showForecast || forecastFan.length === 0 || displayCandles.length === 0) {
      ref.median.setData([]);
      ref.markers.forEach((s) => {
        s.setData([]);
        s.setMarkers([]);
      });
      return;
    }

    updateChartWithRAF(() => {
      const ref2 = forecastSeriesRef.current;
      if (!ref2) return;
      const colors = getThemeColors();
      const lastCandle = displayCandles[displayCandles.length - 1];

      const intervalSec = Math.max(1, INTERVAL_TO_MS[interval] / 1000);
      const lookback = Math.min(50, displayCandles.length);
      const recent = displayCandles.slice(-lookback);
      const volPerSec = recent
        .map((c) => (c.volume ?? 0) / intervalSec)
        .filter((v) => Number.isFinite(v) && v > 0)
        .sort((a, b) => a - b);
      const currentVps = (lastCandle.volume ?? 0) / intervalSec;
      let strength = 0.2;
      if (volPerSec.length >= 5 && currentVps > 0) {
        const idx = volPerSec.findIndex((v) => v >= currentVps);
        strength = idx === -1 ? 1 : idx / volPerSec.length;
      }
      strength = Math.max(0.05, Math.min(1, strength));

      const baseHorizon = forecastFan.length;
      const maxExtension = baseHorizon;
      const extraBars = Math.round(strength * maxExtension);

      const median: { time: any; value: number }[] = [
        { time: (lastCandle.time / 1000) as any, value: lastCandle.close },
      ];
      for (const p of forecastFan) {
        median.push({ time: (p.time / 1000) as any, value: p.median });
      }

      let tipTimeMs = forecastFan[baseHorizon - 1].time;
      let tipMedian = forecastFan[baseHorizon - 1].median;
      if (extraBars > 0 && baseHorizon >= 2) {
        const stepRatio = forecastFan[baseHorizon - 1].median / forecastFan[baseHorizon - 2].median;
        const stepMs = forecastFan[baseHorizon - 1].time - forecastFan[baseHorizon - 2].time;
        for (let i = 1; i <= extraBars; i++) {
          tipTimeMs += stepMs;
          tipMedian *= stepRatio;
          median.push({ time: (tipTimeMs / 1000) as any, value: tipMedian });
        }
      }
      ref2.median.setData(median);

      const tip = { time: tipTimeMs, median: tipMedian };

      const goingUp = tip.median >= lastCandle.close;
      const arrowColor = goingUp ? colors.statusBullish : colors.statusBearish;
      const tipTime = (tip.time / 1000) as any;


      ref2.markers.forEach((s, i) => {
        if (i === 0) {
          s.setData([{ time: tipTime, value: tip.median }]);
          s.setMarkers([
            {
              time: tipTime,
              position: goingUp ? 'aboveBar' : 'belowBar',
              shape: goingUp ? 'arrowUp' : 'arrowDown',
              color: arrowColor,
            },
          ]);
        } else {
          s.setData([]);
          s.setMarkers([]);
        }
      });
    });
  }, [chartReady, showForecast, forecastFan, displayCandles, interval, updateChartWithRAF]);


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
      const stochMarkers = (chartSettings?.showSignalMarkers !== false && chartSettings?.showPivotMarkers)
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

  const trendlineCacheKeyRef = useRef<string>('');
  const trendlines = useMemo(() => {
    const currentLength = displayCandles.length;
    const cacheKey = `${coin}-${interval}`;

    if (trendlineCacheKeyRef.current !== cacheKey) {
      trendlineCacheKeyRef.current = cacheKey;
      cachedTrendlinesRef.current = { supportLine: [], resistanceLine: [] };
      lastTrendlineCalculationRef.current = 0;
    }

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
  }, [displayCandles.length, displayCandles, coin, interval]);

  useEffect(() => {
    console.log('[projections] effect fired', { chartReady, hasRef: !!projectionSeriesRef.current, showForecast, candles: displayCandles.length });
    if (!chartReady || !projectionSeriesRef.current) return;
    const ref = projectionSeriesRef.current;
    const clearAll = () => {
      ref.ema1.setData([]);
      ref.ema2.setData([]);
      ref.ema3.setData([]);
      ref.rsi.setData([]);
      Object.values(ref.stoch).forEach((s) => s.setData([]));
      ref.macd.setData([]);
      ref.support.setData([]);
      ref.resistance.setData([]);
    };

    if (!showForecast || displayCandles.length === 0) {
      clearAll();
      smoothedDeltasRef.current = null;
      return;
    }

    const intervalMs = INTERVAL_TO_MS[interval];
    if (!intervalMs) {
      clearAll();
      return;
    }

    const run = () => {
      const ref2 = projectionSeriesRef.current;
      if (!ref2) return;
      const horizon = forecastFan.length;
      if (horizon === 0) {
        clearAll();
        return;
      }
      const lastCandle = displayCandles[displayCandles.length - 1];
      const startTimeMs = lastCandle.time;
      const liveMedians = forecastFan.map((p) => p.median);
      const liveAnchor = lastCandle.close;
      const liveDeltas = liveMedians.map((m) => m / liveAnchor - 1);
      const SMOOTH_ALPHA = 0.05;
      const prev = smoothedDeltasRef.current;
      const smoothedDeltas =
        prev && prev.length === liveDeltas.length
          ? liveDeltas.map((d, k) => SMOOTH_ALPHA * d + (1 - SMOOTH_ALPHA) * prev[k])
          : liveDeltas.slice();
      smoothedDeltasRef.current = smoothedDeltas;
      const baseDelta = smoothedDeltas[0];
      const forecastCloses = smoothedDeltas.map((d) => liveAnchor * (1 + d - baseDelta));
      type Pt = { time: number; value: number };
      const SPLINE_SMOOTH_ALPHA = 0.45;
      const smoothPts = (pts: Pt[]): Pt[] => {
        if (pts.length < 2) return pts;
        const out: Pt[] = [{ ...pts[0] }];
        for (let i = 1; i < pts.length; i++) {
          const prev = out[i - 1].value;
          out.push({ time: pts[i].time, value: SPLINE_SMOOTH_ALPHA * pts[i].value + (1 - SPLINE_SMOOTH_ALPHA) * prev });
        }
        for (let i = pts.length - 2; i >= 0; i--) {
          const next = out[i + 1].value;
          out[i] = { time: out[i].time, value: SPLINE_SMOOTH_ALPHA * out[i].value + (1 - SPLINE_SMOOTH_ALPHA) * next };
        }
        return out;
      };
      const toSeriesData = (pts: Pt[]) =>
        smoothPts(pts).map((p) => ({ time: (p.time / 1000) as any, value: p.value }));
      const prepend = (pts: Pt[]) => [
        { time: (startTimeMs / 1000) as any, value: lastCandle.close },
        ...toSeriesData(pts),
      ];

      const debug: Record<string, number> = {};
      const setWithLog = (name: string, series: any, data: any[]) => {
        debug[name] = data.length;
        series.setData(data);
      };

      const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
      const sCurveFromClose = (endValue: number | null | undefined) => {
        if (endValue == null || !Number.isFinite(endValue) || horizon <= 0) return [];
        const out: any[] = [{ time: (startTimeMs / 1000) as any, value: lastCandle.close }];
        for (let k = 1; k <= horizon; k++) {
          const t = k / horizon;
          const v = lastCandle.close + (endValue - lastCandle.close) * easeInOut(t);
          out.push({ time: ((startTimeMs + intervalMs * k) / 1000) as any, value: v });
        }
        return out;
      };
      const emaEndpoint = (emaArr: number[], period: number) => {
        const pts = projectEMAAlongPath(emaArr, period, forecastCloses, startTimeMs, intervalMs);
        return pts[pts.length - 1]?.value;
      };

      setWithLog('ema1', ref2.ema1,
        emaSettings.ema1.enabled && ema1.length >= 1
          ? sCurveFromClose(emaEndpoint(ema1, emaSettings.ema1.period))
          : []);
      setWithLog('ema2', ref2.ema2,
        emaSettings.ema2.enabled && ema2.length >= 1
          ? sCurveFromClose(emaEndpoint(ema2, emaSettings.ema2.period))
          : []);
      setWithLog('ema3', ref2.ema3,
        emaSettings.ema3.enabled && ema3.length >= 1
          ? sCurveFromClose(emaEndpoint(ema3, emaSettings.ema3.period))
          : []);

      setWithLog('rsi', ref2.rsi, closePrices.length >= 15
        ? prepend(projectRSIAlongPath(closePrices, forecastCloses, startTimeMs, intervalMs))
        : []);

      const variantNames = ['ultraFast', 'fast', 'medium', 'slow'] as const;
      let totalStochPts = 0;
      for (const variantName of variantNames) {
        const series = ref2.stoch[variantName];
        if (!series) continue;
        const variantConfig = stochasticSettings.variants?.[variantName];
        if (!variantConfig?.enabled || displayCandles.length < variantConfig.period) {
          series.setData([]);
          continue;
        }
        const data = prepend(projectStochAlongPath(
          displayCandles,
          forecastCloses,
          startTimeMs,
          intervalMs,
          variantConfig.period,
          variantConfig.smoothK,
        ));
        series.setData(data);
        totalStochPts += data.length;
      }
      debug.stoch = totalStochPts;

      const macdInterval = macdSettings.timeframes?.[interval as keyof typeof macdSettings.timeframes];
      setWithLog('macd', ref2.macd, macdInterval?.enabled && closePrices.length >= macdInterval.slowPeriod
        ? prepend(projectMACDAlongPath(
            closePrices,
            forecastCloses,
            startTimeMs,
            intervalMs,
            macdInterval.fastPeriod,
            macdInterval.slowPeriod,
          ))
        : []);

      ref2.support.setData([]);
      ref2.resistance.setData([]);
      debug.support = 0;
      debug.resistance = 0;
      console.log('[projections]', debug, {
        forecastLen: forecastFan.length,
        emaEnabled: [emaSettings.ema1.enabled, emaSettings.ema2.enabled, emaSettings.ema3.enabled],
        macdEnabled: macdInterval?.enabled,
        closesLen: closePrices.length,
        candlesLen: displayCandles.length,
        stochVariantsEnabled: Object.entries(stochasticSettings.variants ?? {}).filter(([, v]: any) => v?.enabled).map(([k]) => k),
      });
    };
    const raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [chartReady, showForecast, forecastFan, displayCandles, interval, ema1, ema2, ema3, trendlines, closePrices, emaSettings, macdSettings, stochasticSettings, updateChartWithRAF]);

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

  // Order price lines overlay (diffed against existing lines)
  useLayoutEffect(() => {
    if (!chartReady || !candleSeriesRef.current) return;

    const colors = getThemeColors();

    const fadeColor = (hexColor: string, opacity: number): string => {
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    const computeLineOptions = (order: Order) => {
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

      return {
        opts: { price: displayPrice, color, lineWidth: 2 as const, lineStyle, axisLabelVisible: true, title },
        sig: `${displayPrice}|${color}|${lineStyle}|${title}`,
      };
    };

    const seenIds = new Set<string>();

    if (orders && orders.length > 0) {
      orders.forEach((order) => {
        const id = order.tempId || order.oid;
        if (!id) return;
        seenIds.add(id);

        const { opts, sig } = computeLineOptions(order);
        const existing = orderLinesRef.current.get(id);

        if (existing) {
          if (existing.sig !== sig) {
            try {
              existing.line.applyOptions(opts);
              existing.sig = sig;
            } catch (e) {
              // ignore
            }
          }
        } else {
          try {
            const line = candleSeriesRef.current.createPriceLine(opts);
            orderLinesRef.current.set(id, { line, sig });
          } catch (e) {
            return;
          }
        }
      });
    }

    // Remove lines whose order is no longer present
    orderLinesRef.current.forEach((entry, id) => {
      if (!seenIds.has(id)) {
        try {
          candleSeriesRef.current.removePriceLine(entry.line);
        } catch (e) {
          // ignore
        }
        orderLinesRef.current.delete(id);
      }
    });

  }, [orders, chartReady, chartSettings?.invertedMode]);

  useEffect(() => {
    return () => {
      const series = candleSeriesRef.current;
      if (series) {
        orderLinesRef.current.forEach((entry) => {
          try {
            series.removePriceLine(entry.line);
          } catch (e) {
            // ignore
          }
        });
      }
      orderLinesRef.current.clear();
    };
  }, []);

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
          <div className="text-primary text-sm">
            Loading chart<span className="loading-ellipsis" />
          </div>
        </div>
      )}
      <div className="relative flex-1 min-h-0">
        <div ref={chartContainerRef} className="absolute inset-0" />
      </div>
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
