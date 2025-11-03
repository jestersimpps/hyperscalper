'use client';

import { useEffect, useRef, useMemo, useState, memo } from 'react';
import { useCandleStore } from '@/stores/useCandleStore';
import { useOrderBookStore } from '@/stores/useOrderBookStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { getThemeColors } from '@/lib/theme-utils';
import type { CandleData } from '@/types';
import type { Position } from '@/models/Position';
import type { Order } from '@/models/Order';
import type { OrderBookZone, OrderBookZones } from '@/models/OrderBookZone';
import type { OrderBookLevel } from '@/lib/websocket/exchange-websocket.interface';

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

const ZONE_LEVELS = 12;
const ZONE_UPDATE_THRESHOLD = 0.15;
const ZONE_OPACITY_MIN = 0.08;
const ZONE_OPACITY_MAX = 0.35;
const ZONE_LINE_WIDTH = 20;

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

function calculateZones(
  levels: OrderBookLevel[],
  side: 'bid' | 'ask',
  count: number = ZONE_LEVELS
): OrderBookZone[] {
  if (!levels || levels.length === 0) return [];

  const topLevels = levels.slice(0, count);
  const maxVolume = Math.max(...topLevels.map(l => l.total));

  return topLevels.map(level => ({
    price: level.price,
    volume: level.total,
    intensity: maxVolume > 0 ? level.total / maxVolume : 0,
    side,
  }));
}

function shouldUpdateZones(
  currentZones: OrderBookZone[],
  newZones: OrderBookZone[]
): boolean {
  if (currentZones.length !== newZones.length) return true;

  for (let i = 0; i < currentZones.length; i++) {
    const current = currentZones[i];
    const newZone = newZones[i];

    if (Math.abs(current.price - newZone.price) > 0.0001) {
      return true;
    }

    const volumeChange = Math.abs(current.volume - newZone.volume) / (current.volume || 1);
    if (volumeChange > ZONE_UPDATE_THRESHOLD) {
      return true;
    }
  }

  return false;
}

function PriceTape({ coin, position, orders = [] }: PriceTapeProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const lineSeriesRef = useRef<any>(null);
  const lastUpdateRef = useRef(Date.now());
  const priceDataRef = useRef<PricePoint[]>([]);
  const positionLineRef = useRef<any>(null);
  const orderLinesRef = useRef<any[]>([]);
  const chartReadyRef = useRef(false);
  const bidZoneLinesRef = useRef<any[]>([]);
  const askZoneLinesRef = useRef<any[]>([]);
  const currentZonesRef = useRef<OrderBookZones | null>(null);

  const [selectedPrecision, setSelectedPrecision] = useState<2 | 3 | 4 | 5 | null>(null);

  const interval = '1m';
  const candleKey = `${coin}-${interval}`;
  const candles = useCandleStore((state) => state.candles[candleKey]) || [];
  const orderBookKey = `${coin}${selectedPrecision ? `_${selectedPrecision}` : ''}`;
  const orderBook = useOrderBookStore((state) => state.orderBooks[orderBookKey]);

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
    bidZoneLinesRef.current.forEach((line) => {
      if (lineSeriesRef.current) {
        try {
          lineSeriesRef.current.removePriceLine(line);
        } catch (e) {}
      }
    });
    bidZoneLinesRef.current = [];

    askZoneLinesRef.current.forEach((line) => {
      if (lineSeriesRef.current) {
        try {
          lineSeriesRef.current.removePriceLine(line);
        } catch (e) {}
      }
    });
    askZoneLinesRef.current = [];
    currentZonesRef.current = null;
  }, [selectedPrecision]);

  useEffect(() => {
    const { subscribeToOrderBook, unsubscribeFromOrderBook } = useOrderBookStore.getState();

    subscribeToOrderBook(coin, selectedPrecision);

    return () => {
      unsubscribeFromOrderBook(coin, selectedPrecision);
    };
  }, [coin, selectedPrecision]);

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
    if (!chartReadyRef.current || !lineSeriesRef.current || !orderBook) return;

    const colors = getThemeColors();

    const newBidZones = calculateZones(orderBook.bids, 'bid', ZONE_LEVELS);
    const newAskZones = calculateZones(orderBook.asks, 'ask', ZONE_LEVELS);

    if (newBidZones.length === 0 || newAskZones.length === 0) {
      return;
    }

    const currentZones = currentZonesRef.current;

    const shouldUpdateBids = !currentZones || shouldUpdateZones(currentZones.bids, newBidZones);
    const shouldUpdateAsks = !currentZones || shouldUpdateZones(currentZones.asks, newAskZones);

    if (!shouldUpdateBids && !shouldUpdateAsks) return;

    bidZoneLinesRef.current.forEach((line) => {
      try {
        lineSeriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    bidZoneLinesRef.current = [];

    askZoneLinesRef.current.forEach((line) => {
      try {
        lineSeriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    askZoneLinesRef.current = [];

    newBidZones.forEach((zone) => {
      const opacity = ZONE_OPACITY_MIN + (zone.intensity * (ZONE_OPACITY_MAX - ZONE_OPACITY_MIN));
      const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
      const color = `${colors.statusBullish}${alpha}`;

      const formattedPrice = parseFloat(zone.price.toFixed(decimals.price));

      const priceLine = lineSeriesRef.current.createPriceLine({
        price: formattedPrice,
        color: color,
        lineWidth: ZONE_LINE_WIDTH,
        lineStyle: 0,
        axisLabelVisible: false,
        title: '',
      });

      bidZoneLinesRef.current.push(priceLine);
    });

    newAskZones.forEach((zone) => {
      const opacity = ZONE_OPACITY_MIN + (zone.intensity * (ZONE_OPACITY_MAX - ZONE_OPACITY_MIN));
      const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
      const color = `${colors.statusBearish}${alpha}`;

      const formattedPrice = parseFloat(zone.price.toFixed(decimals.price));

      const priceLine = lineSeriesRef.current.createPriceLine({
        price: formattedPrice,
        color: color,
        lineWidth: ZONE_LINE_WIDTH,
        lineStyle: 0,
        axisLabelVisible: false,
        title: '',
      });

      askZoneLinesRef.current.push(priceLine);
    });

    currentZonesRef.current = {
      bids: newBidZones,
      asks: newAskZones,
      timestamp: Date.now(),
    };
  }, [coin, orderBook, decimals.price]);

  useEffect(() => {
    return () => {
      bidZoneLinesRef.current.forEach((line) => {
        if (lineSeriesRef.current) {
          try {
            lineSeriesRef.current.removePriceLine(line);
          } catch (e) {}
        }
      });
      bidZoneLinesRef.current = [];

      askZoneLinesRef.current.forEach((line) => {
        if (lineSeriesRef.current) {
          try {
            lineSeriesRef.current.removePriceLine(line);
          } catch (e) {}
        }
      });
      askZoneLinesRef.current = [];
      currentZonesRef.current = null;
    };
  }, [coin]);

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

        if (currentZonesRef.current) {
          prices.push(...currentZonesRef.current.bids.map(z => z.price));
          prices.push(...currentZonesRef.current.asks.map(z => z.price));
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
  }, [coin, ordersKey, position?.entryPrice, candles]);

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
        lineStyle: 0,
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
  }, [coin, position?.entryPrice, position?.side, decimals.price]);

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

      let lineStyle = 1;
      if (order.orderType === 'stop') {
        lineStyle = 3;
      } else if (order.orderType === 'tp') {
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
  }, [coin, ordersKey, decimals.price]);

  const precisionOptions: Array<{ value: 2 | 3 | 4 | 5 | null; label: string }> = [
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 5, label: '5' },
    { value: null, label: 'FULL' },
  ];

  return (
    <div className="relative w-full h-full min-h-[300px] terminal-border p-1.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] text-primary-muted uppercase tracking-wider">█ PRICE TAPE</div>
        <div className="flex gap-1">
          {precisionOptions.map((option) => (
            <button
              key={option.label}
              onClick={() => setSelectedPrecision(option.value)}
              className={`
                px-1.5 py-0.5 text-[9px] font-mono rounded
                transition-colors
                ${selectedPrecision === option.value
                  ? 'bg-primary/20 border border-primary text-primary'
                  : 'border border-primary-muted text-primary-muted hover:border-primary hover:text-primary'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full h-[calc(100%-28px)]" />
    </div>
  );
}

export default memo(PriceTape);
