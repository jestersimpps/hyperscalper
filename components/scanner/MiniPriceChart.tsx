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
    return null;
  }

  return (
    <div className="w-full h-full">
      <Line data={data} options={options} />
    </div>
  );
}

export default memo(MiniPriceChart);
