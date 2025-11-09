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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler
);

interface MiniPriceChartProps {
  closePrices: number[];
  signalType: 'bullish' | 'bearish';
}

function MiniPriceChart({ closePrices, signalType }: MiniPriceChartProps) {
  const data = useMemo(() => {
    if (closePrices.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = closePrices.map(() => '');
    const lineColor = signalType === 'bullish' ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';

    return {
      labels,
      datasets: [
        {
          data: closePrices,
          borderColor: lineColor,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 0,
          borderWidth: 1.5
        }
      ]
    };
  }, [closePrices, signalType]);

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
