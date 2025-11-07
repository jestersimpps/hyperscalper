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
  const colorPalette = [
    { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgb(59, 130, 246)' },     // blue
    { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgb(168, 85, 247)' },     // purple
    { bg: 'rgba(249, 115, 22, 0.8)', border: 'rgb(249, 115, 22)' },     // orange
    { bg: 'rgba(20, 184, 166, 0.8)', border: 'rgb(20, 184, 166)' },     // teal
    { bg: 'rgba(236, 72, 153, 0.8)', border: 'rgb(236, 72, 153)' },     // pink
    { bg: 'rgba(234, 179, 8, 0.8)', border: 'rgb(234, 179, 8)' },       // yellow
    { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgb(34, 197, 94)' },       // green
    { bg: 'rgba(239, 68, 68, 0.8)', border: 'rgb(239, 68, 68)' },       // red
    { bg: 'rgba(99, 102, 241, 0.8)', border: 'rgb(99, 102, 241)' },     // indigo
    { bg: 'rgba(251, 146, 60, 0.8)', border: 'rgb(251, 146, 60)' },     // orange-light
  ];

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
    const colors = sortedSymbols.map((_, index) =>
      colorPalette[index % colorPalette.length].bg
    );
    const borderColors = sortedSymbols.map((_, index) =>
      colorPalette[index % colorPalette.length].border
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
