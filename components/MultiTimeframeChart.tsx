'use client';

import { memo } from 'react';
import ScalpingChart from '@/components/ScalpingChart';
import type { TimeInterval } from '@/types';

interface MultiTimeframeChartProps {
  coin: string;
}

const TIMEFRAMES: TimeInterval[] = ['1m', '5m', '15m', '1h'];

function MultiTimeframeChart({ coin }: MultiTimeframeChartProps) {
  return (
    <div className="h-full w-full grid grid-cols-2 gap-2" style={{ gridTemplateRows: '1fr 1fr' }}>
      {TIMEFRAMES.map((interval) => (
        <div key={interval} className="terminal-border p-1.5 flex flex-col min-h-0">
          <div className="text-[10px] text-primary-muted mb-1 uppercase tracking-wider">
            █ {interval.toUpperCase()} CHART
          </div>
          <div className="flex-1 min-h-0">
            <ScalpingChart
              coin={coin}
              interval={interval}
              syncZoom={false}
              simplifiedView={true}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(MultiTimeframeChart);
