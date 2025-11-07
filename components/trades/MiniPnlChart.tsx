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

interface MiniPnlChartProps {
  chartData: Array<{ time: number; cumulativePnl: number }>;
}

function MiniPnlChart({ chartData }: MiniPnlChartProps) {
  const data = useMemo(() => {
    if (chartData.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = chartData.map(() => '');
    const values = chartData.map(point => point.cumulativePnl);

    const finalPnl = values[values.length - 1];
    const lineColor = finalPnl >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';
    const fillColor = finalPnl >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';

    return {
      labels,
      datasets: [
        {
          data: values,
          borderColor: lineColor,
          backgroundColor: fillColor,
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 0,
          borderWidth: 1.5
        }
      ]
    };
  }, [chartData]);

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

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full">
      <Line data={data} options={options} />
    </div>
  );
}

export default memo(MiniPnlChart);
