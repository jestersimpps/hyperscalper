'use client';

import { useEffect, useRef, memo } from 'react';
import type { Trade } from '@/types';
import { getThemeColors } from '@/lib/theme-utils';

interface TradeVolumeTimelineProps {
  coin: string;
  trades: Trade[];
}

interface BucketData {
  time: number;
  buyVolume: number;
  sellVolume: number;
  netVolume: number;
}

function aggregateTradesIntoBuckets(trades: Trade[], intervalMs: number = 5000): BucketData[] {
  if (trades.length === 0) return [];

  const buckets = new Map<number, { buyVolume: number; sellVolume: number }>();

  trades.forEach(trade => {
    const bucketTime = Math.floor(trade.time / intervalMs) * intervalMs;

    if (!buckets.has(bucketTime)) {
      buckets.set(bucketTime, { buyVolume: 0, sellVolume: 0 });
    }

    const bucket = buckets.get(bucketTime)!;
    if (trade.side === 'buy') {
      bucket.buyVolume += trade.size;
    } else {
      bucket.sellVolume += trade.size;
    }
  });

  const sortedBuckets = Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, volumes]) => ({
      time,
      buyVolume: volumes.buyVolume,
      sellVolume: volumes.sellVolume,
      netVolume: volumes.buyVolume - volumes.sellVolume,
    }));

  return sortedBuckets;
}

function calculateCumulativeVolume(buckets: BucketData[]): Array<{ time: number; value: number }> {
  let cumulative = 0;
  return buckets.map(bucket => {
    cumulative += bucket.netVolume;
    return {
      time: bucket.time / 1000, // Convert to seconds for lightweight-charts
      value: cumulative,
    };
  });
}

function TradeVolumeTimeline({ coin, trades }: TradeVolumeTimelineProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const lineSeriesRef = useRef<any>(null);
  const baselineSeriesRef = useRef<any>(null);

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
          },
          rightPriceScale: {
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          },
        });

        // Use baseline series for color change at zero
        const baselineSeries = chart.addBaselineSeries({
          baseValue: { type: 'price', price: 0 },
          topLineColor: colors.statusBullish,
          topFillColor1: colors.statusBullish + '40',
          topFillColor2: colors.statusBullish + '10',
          bottomLineColor: colors.statusBearish,
          bottomFillColor1: colors.statusBearish + '40',
          bottomFillColor2: colors.statusBearish + '10',
          lineWidth: 2,
        });

        chartRef.current = chart;
        baselineSeriesRef.current = baselineSeries;

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
        baselineSeriesRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!baselineSeriesRef.current || trades.length === 0) return;

    const buckets = aggregateTradesIntoBuckets(trades, 1000);
    const cumulativeData = calculateCumulativeVolume(buckets);

    if (cumulativeData.length > 0) {
      baselineSeriesRef.current.setData(cumulativeData);
      chartRef.current?.timeScale().fitContent();
    }
  }, [trades]);

  return (
    <div className="w-full h-full flex flex-col">
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}

export default memo(TradeVolumeTimeline);
