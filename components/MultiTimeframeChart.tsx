'use client';

import { memo, useEffect } from 'react';
import ScalpingChart from '@/components/ScalpingChart';
import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
import type { TimeInterval } from '@/types';

interface MultiTimeframeChartProps {
  coin: string;
}

const TIMEFRAMES: TimeInterval[] = ['1m', '5m', '15m', '1h'];

function MultiTimeframeChart({ coin }: MultiTimeframeChartProps) {
  const position = usePositionStore((state) => state.positions[coin]);
  const subscribeToPosition = usePositionStore((state) => state.subscribeToPosition);
  const unsubscribeFromPosition = usePositionStore((state) => state.unsubscribeFromPosition);

  const orders = useOrderStore((state) => state.orders[coin]) || [];
  const subscribeToOrders = useOrderStore((state) => state.subscribeToOrders);
  const unsubscribeFromOrders = useOrderStore((state) => state.unsubscribeFromOrders);

  useEffect(() => {
    subscribeToPosition(coin);
    subscribeToOrders(coin);

    return () => {
      unsubscribeFromPosition(coin);
      unsubscribeFromOrders(coin);
    };
  }, [coin, subscribeToPosition, unsubscribeFromPosition, subscribeToOrders, unsubscribeFromOrders]);

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
              position={position}
              orders={orders}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(MultiTimeframeChart);
