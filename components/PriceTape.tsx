'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useCandleStore } from '@/stores/useCandleStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { getThemeColors } from '@/lib/theme-utils';
import type { CandleData } from '@/types';
import type { Position } from '@/models/Position';
import type { Order } from '@/models/Order';

interface PriceTapeProps {
  coin: string;
  position?: Position;
  orders?: Order[];
}

interface PricePoint {
  time: number;
  value: number;
}

const TIMEFRAME_MS = 300000;
const INTERVAL_MS = 500;
const DATA_POINTS = TIMEFRAME_MS / INTERVAL_MS;

function buildPriceData(candles: CandleData[]): PricePoint[] {
  if (candles.length === 0) return [];

  const now = Date.now();
  const sortedCandles = [...candles].sort((a, b) => a.time - b.time);
  const data: PricePoint[] = [];

  let candleIndex = 0;
  let currentPrice = sortedCandles[0]?.close || 0;

  for (let i = 0; i < DATA_POINTS; i++) {
    const timestamp = now - (DATA_POINTS - 1 - i) * INTERVAL_MS;

    while (candleIndex < sortedCandles.length && sortedCandles[candleIndex].time <= timestamp) {
      currentPrice = sortedCandles[candleIndex].close;
      candleIndex++;
    }

    data.push({
      time: timestamp / 1000,
      value: currentPrice,
    });
  }

  return data;
}

export default function PriceTape({ coin, position, orders = [] }: PriceTapeProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const lineSeriesRef = useRef<any>(null);
  const lastUpdateRef = useRef(Date.now());
  const priceDataRef = useRef<PricePoint[]>([]);
  const positionLineRef = useRef<any>(null);
  const orderLinesRef = useRef<any[]>([]);
  const chartReadyRef = useRef(false);

  const interval = '1m';
  const candleKey = `${coin}-${interval}`;
  const candles = useCandleStore((state) => state.candles[candleKey]) || [];

  const getDecimals = useSymbolMetaStore((state) => state.getDecimals);
  const decimals = useMemo(() => getDecimals(coin), [getDecimals, coin]);

  const ordersKey = useMemo(() => {
    if (orders.length === 0) return 'empty';
    return orders.map(o => `${o.oid}-${o.price}`).join('|');
  }, [orders]);

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
          height: chartContainerRef.current.clientHeight,
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
            secondsVisible: true,
            rightOffset: 5,
            fixLeftEdge: true,
            fixRightEdge: true,
            lockVisibleTimeRangeOnResize: true,
          },
          handleScroll: false,
          handleScale: false,
          rightPriceScale: {
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          },
        });

        const lineSeries = chart.addLineSeries({
          color: colors.primary,
          lineWidth: 2,
          lastValueVisible: true,
          priceLineVisible: true,
        });

        chartRef.current = chart;
        lineSeriesRef.current = lineSeries;
        chartReadyRef.current = true;

        resizeHandler = () => {
          if (chartContainerRef.current && chart) {
            chart.applyOptions({
              width: chartContainerRef.current.clientWidth,
              height: chartContainerRef.current.clientHeight,
            });
          }
        };

        window.addEventListener('resize', resizeHandler);
      } catch (error) {
        console.error('[PriceTape] Failed to initialize chart:', error);
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
        lineSeriesRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const { subscribeToCandles, unsubscribeFromCandles } = useCandleStore.getState();

    subscribeToCandles(coin, interval);

    return () => {
      unsubscribeFromCandles(coin, interval);
    };
  }, [coin, interval]);

  useEffect(() => {
    if (!lineSeriesRef.current || candles.length === 0) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (timeSinceLastUpdate < INTERVAL_MS) {
      return;
    }

    const priceData = buildPriceData(candles);
    priceDataRef.current = priceData;

    if (priceData.length > 0) {
      lineSeriesRef.current.setData(priceData);

      const endTime = now / 1000;
      const startTime = (now - TIMEFRAME_MS) / 1000;

      chartRef.current?.timeScale().setVisibleRange({
        from: startTime,
        to: endTime,
      });

      lastUpdateRef.current = now;
    }
  }, [candles]);

  useEffect(() => {
    if (!chartReadyRef.current || !lineSeriesRef.current) return;

    lineSeriesRef.current.applyOptions({
      autoscaleInfoProvider: () => {
        const prices: number[] = [];

        if (priceDataRef.current.length > 0) {
          prices.push(...priceDataRef.current.map(p => p.value));
        }

        if (position?.entryPrice) {
          prices.push(position.entryPrice);
        }

        if (orders.length > 0) {
          prices.push(...orders.map(o => o.price));
        }

        if (prices.length === 0) return null;

        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const margin = 0.08;
        const range = maxPrice - minPrice || maxPrice * 0.01;

        return {
          priceRange: {
            minValue: minPrice - (range * margin),
            maxValue: maxPrice + (range * margin),
          },
        };
      },
    });
  }, [ordersKey, position?.entryPrice, candles]);

  useEffect(() => {
    if (!chartReadyRef.current || !lineSeriesRef.current) return;

    const colors = getThemeColors();

    if (positionLineRef.current) {
      try {
        lineSeriesRef.current.removePriceLine(positionLineRef.current);
      } catch (e) {
      }
      positionLineRef.current = null;
    }

    if (position) {
      const isLong = position.side === 'long';
      const formattedPrice = parseFloat(position.entryPrice.toFixed(decimals.price));

      positionLineRef.current = lineSeriesRef.current.createPriceLine({
        price: formattedPrice,
        color: isLong ? colors.statusBullish : colors.statusBearish,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `ENTRY ${position.side.toUpperCase()}`,
      });
    }

    return () => {
      if (positionLineRef.current && lineSeriesRef.current) {
        try {
          lineSeriesRef.current.removePriceLine(positionLineRef.current);
        } catch (e) {
        }
        positionLineRef.current = null;
      }
    };
  }, [position?.entryPrice, position?.side, decimals.price]);

  useEffect(() => {
    if (!chartReadyRef.current || !lineSeriesRef.current) return;

    const colors = getThemeColors();

    orderLinesRef.current.forEach((line) => {
      try {
        lineSeriesRef.current.removePriceLine(line);
      } catch (e) {
      }
    });
    orderLinesRef.current = [];

    orders.forEach((order) => {
      const isBuy = order.side === 'buy';
      const formattedPrice = parseFloat(order.price.toFixed(decimals.price));

      let lineStyle = 0;
      if (order.orderType === 'stop' || order.orderType === 'tp') {
        lineStyle = 1;
      } else if (order.orderType === 'trigger') {
        lineStyle = 3;
      }

      const priceLine = lineSeriesRef.current.createPriceLine({
        price: formattedPrice,
        color: isBuy ? colors.statusBullish : colors.statusBearish,
        lineWidth: 2,
        lineStyle,
        axisLabelVisible: true,
        title: `${order.side.toUpperCase()} ${order.orderType.toUpperCase()}`,
      });

      orderLinesRef.current.push(priceLine);
    });

    return () => {
      orderLinesRef.current.forEach((line) => {
        if (lineSeriesRef.current) {
          try {
            lineSeriesRef.current.removePriceLine(line);
          } catch (e) {
          }
        }
      });
      orderLinesRef.current = [];
    };
  }, [ordersKey, decimals.price]);

  return (
    <div className="relative w-full h-full min-h-[300px] terminal-border p-1.5">
      <div className="text-[10px] text-primary-muted mb-1.5 uppercase tracking-wider">█ PRICE TAPE</div>
      <div ref={chartContainerRef} className="w-full h-[calc(100%-20px)]" />
    </div>
  );
}
