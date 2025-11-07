'use client';

import { memo, useMemo } from 'react';
import type { PositionGroup } from '@/lib/trade-grouping-utils';

interface PnlChartProps {
  groups: PositionGroup[];
}

interface DataPoint {
  time: number;
  cumulativePnl: number;
}

function PnlChart({ groups }: PnlChartProps) {
  const dataPoints = useMemo((): DataPoint[] => {
    if (groups.length === 0) return [];

    const sortedGroups = [...groups].sort((a, b) => a.exitTime - b.exitTime);
    const points: DataPoint[] = [{ time: sortedGroups[0].exitTime, cumulativePnl: 0 }];

    let cumulative = 0;
    sortedGroups.forEach((group) => {
      cumulative += group.totalPnl;
      points.push({ time: group.exitTime, cumulativePnl: cumulative });
    });

    return points;
  }, [groups]);

  const { minPnl, maxPnl, minTime, maxTime } = useMemo(() => {
    if (dataPoints.length === 0) {
      return { minPnl: 0, maxPnl: 0, minTime: 0, maxTime: 0 };
    }

    const pnls = dataPoints.map(d => d.cumulativePnl);
    const times = dataPoints.map(d => d.time);

    return {
      minPnl: Math.min(0, ...pnls),
      maxPnl: Math.max(0, ...pnls),
      minTime: Math.min(...times),
      maxTime: Math.max(...times)
    };
  }, [dataPoints]);

  const finalPnl = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].cumulativePnl : 0;
  const lineColor = finalPnl >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';
  const fillColor = finalPnl >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';

  const width = 800;
  const height = 130;
  const padding = { top: 10, right: 50, bottom: 20, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const mapX = (time: number): number => {
    if (maxTime === minTime) return padding.left + chartWidth / 2;
    return padding.left + ((time - minTime) / (maxTime - minTime)) * chartWidth;
  };

  const mapY = (pnl: number): number => {
    const range = maxPnl - minPnl;
    if (range === 0) return padding.top + chartHeight / 2;
    return padding.top + chartHeight - ((pnl - minPnl) / range) * chartHeight;
  };

  const zeroY = mapY(0);

  const pathData = useMemo(() => {
    if (dataPoints.length === 0) return '';

    const firstPoint = dataPoints[0];
    let path = `M ${mapX(firstPoint.time)} ${mapY(firstPoint.cumulativePnl)}`;

    for (let i = 1; i < dataPoints.length; i++) {
      const point = dataPoints[i];
      path += ` L ${mapX(point.time)} ${mapY(point.cumulativePnl)}`;
    }

    return path;
  }, [dataPoints, minTime, maxTime, minPnl, maxPnl]);

  const fillPath = useMemo(() => {
    if (dataPoints.length === 0) return '';

    const firstPoint = dataPoints[0];
    let path = `M ${mapX(firstPoint.time)} ${zeroY}`;
    path += ` L ${mapX(firstPoint.time)} ${mapY(firstPoint.cumulativePnl)}`;

    for (let i = 1; i < dataPoints.length; i++) {
      const point = dataPoints[i];
      path += ` L ${mapX(point.time)} ${mapY(point.cumulativePnl)}`;
    }

    const lastPoint = dataPoints[dataPoints.length - 1];
    path += ` L ${mapX(lastPoint.time)} ${zeroY}`;
    path += ` Z`;

    return path;
  }, [dataPoints, zeroY, minTime, maxTime, minPnl, maxPnl]);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  if (dataPoints.length === 0) {
    return null;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-[130px]"
      preserveAspectRatio="none"
    >
      {/* Zero line */}
      <line
        x1={padding.left}
        y1={zeroY}
        x2={width - padding.right}
        y2={zeroY}
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.3"
        className="text-primary-muted"
      />

      {/* Fill area */}
      <path
        d={fillPath}
        fill={fillColor}
      />

      {/* Line */}
      <path
        d={pathData}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
      />

      {/* Y-axis labels */}
      <text
        x={padding.left - 10}
        y={mapY(maxPnl)}
        textAnchor="end"
        className="text-[10px] fill-primary-muted font-mono"
      >
        +${Math.abs(maxPnl).toFixed(0)}
      </text>
      <text
        x={padding.left - 10}
        y={zeroY + 4}
        textAnchor="end"
        className="text-[10px] fill-primary-muted font-mono"
      >
        $0
      </text>
      {minPnl < 0 && (
        <text
          x={padding.left - 10}
          y={mapY(minPnl)}
          textAnchor="end"
          className="text-[10px] fill-primary-muted font-mono"
        >
          -${Math.abs(minPnl).toFixed(0)}
        </text>
      )}

      {/* X-axis labels */}
      <text
        x={padding.left}
        y={height - 5}
        textAnchor="start"
        className="text-[10px] fill-primary-muted font-mono"
      >
        {formatTime(minTime)}
      </text>
      <text
        x={width - padding.right}
        y={height - 5}
        textAnchor="end"
        className="text-[10px] fill-primary-muted font-mono"
      >
        {formatTime(maxTime)}
      </text>
    </svg>
  );
}

export default memo(PnlChart);
