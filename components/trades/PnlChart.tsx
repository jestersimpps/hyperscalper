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
import type { PositionGroup } from '@/lib/trade-grouping-utils';

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

interface PnlChartProps {
  groups: PositionGroup[];
}

function PnlChart({ groups }: PnlChartProps) {
  const chartData = useMemo(() => {
    if (groups.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const sortedGroups = [...groups].sort((a, b) => a.exitTime - b.exitTime);
    const labels: string[] = [];
    const data: number[] = [0];

    let cumulative = 0;

    const formatTime = (timestamp: number): string => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    };

    labels.push(formatTime(sortedGroups[0].exitTime));

    sortedGroups.forEach((group) => {
      cumulative += group.totalPnl;
      data.push(cumulative);
      labels.push(formatTime(group.exitTime));
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
  }, [groups]);

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

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full">
      <Line data={chartData} options={options} />
    </div>
  );
}

export default memo(PnlChart);
