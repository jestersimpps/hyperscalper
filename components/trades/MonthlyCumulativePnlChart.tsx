'use client';

import { memo, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { DailyPnlSummary } from '@/stores/useUserFillsStore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MonthlyCumulativePnlChartProps {
  dailySummaries: DailyPnlSummary[];
}

function MonthlyCumulativePnlChart({ dailySummaries }: MonthlyCumulativePnlChartProps) {
  const chartData = useMemo(() => {
    if (dailySummaries.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const sortedDays = [...dailySummaries].sort((a, b) => a.date.localeCompare(b.date));
    const labels: string[] = [];
    const data: number[] = [0];

    let cumulative = 0;

    const formatDate = (dateString: string): string => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    };

    labels.push(formatDate(sortedDays[0].date));

    sortedDays.forEach((day) => {
      cumulative += day.totalPnl;
      data.push(cumulative);
      labels.push(formatDate(day.date));
    });

    const finalPnl = cumulative;
    const lineColor = finalPnl >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';
    const fillColor = finalPnl >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';

    return {
      labels,
      datasets: [
        {
          label: 'Cumulative P&L',
          data,
          borderColor: lineColor,
          backgroundColor: fillColor,
          fill: true,
          tension: 0.1,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2
        }
      ]
    };
  }, [dailySummaries]);

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#9ca3af',
        bodyColor: '#ffffff',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 8,
        displayColors: false,
        callbacks: {
          label: function(context) {
            const value = context.parsed.y;
            if (value === null) return '';
            return `P&L: ${value >= 0 ? '+' : ''}$${value.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
          drawTicks: false
        },
        ticks: {
          color: '#9ca3af',
          font: {
            family: 'monospace',
            size: 10
          },
          maxRotation: 0
        },
        border: {
          color: '#374151'
        }
      },
      y: {
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
          drawTicks: false
        },
        ticks: {
          color: '#9ca3af',
          font: {
            family: 'monospace',
            size: 10
          },
          callback: function(value) {
            return `$${value}`;
          }
        },
        border: {
          color: '#374151'
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  }), []);

  if (dailySummaries.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full">
      <Line data={chartData} options={options} />
    </div>
  );
}

export default memo(MonthlyCumulativePnlChart);
