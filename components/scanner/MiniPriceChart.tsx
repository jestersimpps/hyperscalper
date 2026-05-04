'use client';

import { memo, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getInvertedSignalType } from '@/lib/inverted-utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler
);

interface MiniPriceChartProps {
  closePrices: number[];
  signalType?: 'bullish' | 'bearish';
  invertedMode?: boolean;
}

function MiniPriceChart({ closePrices, signalType, invertedMode = false }: MiniPriceChartProps) {
  const data = useMemo(() => {
    if (closePrices.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = closePrices.map(() => '');

    // Invert price data if in inverted mode
    let displayPrices = closePrices;
    if (invertedMode) {
      const referencePrice = closePrices[0];
      displayPrices = closePrices.map(price => 2 * referencePrice - price);
    }

    const startPrice = displayPrices[0];
    const endPrice = displayPrices[displayPrices.length - 1];
    const isPriceUp = endPrice > startPrice;

    const displaySignalType = signalType ? getInvertedSignalType(signalType, invertedMode) : undefined;

    const lineColor = displaySignalType
      ? (displaySignalType === 'bullish' ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)')
      : (isPriceUp ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)');

    const fillColor = displaySignalType
      ? (displaySignalType === 'bullish' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)')
      : (isPriceUp ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)');

    return {
      labels,
      datasets: [
        {
          data: displayPrices,
          borderColor: lineColor,
          backgroundColor: fillColor,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 0,
          borderWidth: 1.5
        }
      ]
    };
  }, [closePrices, signalType, invertedMode]);

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    animations: {
      colors: false,
      x: false,
      y: false,
    },
    transitions: {
      active: { animation: { duration: 0 } },
      resize: { animation: { duration: 0 } },
      show: { animations: { x: { from: 0 }, y: { from: 0 } } },
      hide: { animations: { x: { to: 0 }, y: { to: 0 } } },
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false
      }
    },
    scales: {
      x: {
        display: false
      },
      y: {
        display: false
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  }), []);

  if (closePrices.length === 0) {
    return <MiniPriceChartSkeleton />;
  }

  return (
    <div className="w-full h-full">
      <Line data={data} options={options} />
    </div>
  );
}

const SKELETON_POINTS = [
  [0, 62], [8, 55], [16, 60], [24, 48], [32, 52],
  [40, 40], [48, 45], [56, 35], [64, 42], [72, 30],
  [80, 38], [88, 28], [96, 33], [100, 25]
] as const;

const SKELETON_LINE = SKELETON_POINTS.map(([x, y]) => `${x},${y}`).join(' ');
const SKELETON_AREA = `0,70 ${SKELETON_LINE} 100,70`;

function MiniPriceChartSkeleton() {
  return (
    <div className="w-full h-full relative overflow-hidden">
      <svg
        viewBox="0 0 100 70"
        preserveAspectRatio="none"
        className="w-full h-full animate-pulse"
      >
        <polygon points={SKELETON_AREA} fill="currentColor" className="text-primary/10" />
        <polyline
          points={SKELETON_LINE}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="text-primary/30"
        />
      </svg>
      <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
    </div>
  );
}

export default memo(MiniPriceChart);
