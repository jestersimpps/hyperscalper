'use client';

import { memo, useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import type { PositionGroup } from '@/lib/trade-grouping-utils';

ChartJS.register(ArcElement, Tooltip, Legend);

interface SymbolPnlDonutProps {
  groups: PositionGroup[];
}

function SymbolPnlDonut({ groups }: SymbolPnlDonutProps) {
  const chartData = useMemo(() => {
    const symbolPnl: Record<string, number> = {};

    groups.forEach((group) => {
      if (!symbolPnl[group.coin]) {
        symbolPnl[group.coin] = 0;
      }
      symbolPnl[group.coin] += group.totalPnl;
    });

    const sortedSymbols = Object.entries(symbolPnl)
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));

    const labels = sortedSymbols.map(([symbol]) => symbol);
    const data = sortedSymbols.map(([, pnl]) => Math.abs(pnl));
    const colors = sortedSymbols.map(([, pnl]) =>
      pnl >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)'
    );
    const borderColors = sortedSymbols.map(([, pnl]) =>
      pnl >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
    );

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: borderColors,
          borderWidth: 2
        }
      ]
    };
  }, [groups]);

  const options: ChartOptions<'doughnut'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#9ca3af',
          font: {
            family: 'monospace',
            size: 11
          },
          padding: 10,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#9ca3af',
        bodyColor: '#ffffff',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 8,
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed;
            const dataset = context.dataset.data;
            const total = dataset.reduce((sum: number, val) => sum + (val as number), 0);
            const percentage = ((value / total) * 100).toFixed(1);

            const symbolPnl: Record<string, number> = {};
            groups.forEach((group) => {
              if (!symbolPnl[group.coin]) {
                symbolPnl[group.coin] = 0;
              }
              symbolPnl[group.coin] += group.totalPnl;
            });

            const actualPnl = symbolPnl[label];
            return `${label}: ${actualPnl >= 0 ? '+' : ''}$${actualPnl.toFixed(2)} (${percentage}%)`;
          }
        }
      }
    }
  }), [groups]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full">
      <Doughnut data={chartData} options={options} />
    </div>
  );
}

export default memo(SymbolPnlDonut);
