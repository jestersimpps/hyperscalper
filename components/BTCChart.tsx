'use client';

import { useEffect, useState, memo } from 'react';
import ScalpingChart from '@/components/ScalpingChart';
import { useCandleStore } from '@/stores/useCandleStore';
import { getCandleTimeWindow } from '@/lib/time-utils';
import { STANDARD_CANDLES } from '@/lib/constants';

function BTCChart() {
  const [currentPrice, setCurrentPrice] = useState(0);
  const candles = useCandleStore((state) => state.candles['BTC-1m']) || [];
  const candleService = useCandleStore((state) => state.service);

  useEffect(() => {
    if (!candleService) return;

    const { startTime, endTime } = getCandleTimeWindow('1m', STANDARD_CANDLES);
    const { fetchCandles, subscribeToCandles } = useCandleStore.getState();

    fetchCandles('BTC', '1m', startTime, endTime);
    subscribeToCandles('BTC', '1m');

    return () => {
      const { unsubscribeFromCandles } = useCandleStore.getState();
      unsubscribeFromCandles('BTC', '1m');
    };
  }, [candleService]);

  return (
    <div className="h-full flex flex-col">
      <div className="text-[10px] text-primary-muted mb-1 uppercase tracking-wider">
        █ BTC/USD {currentPrice > 0 && `$${currentPrice.toFixed(2)}`}
      </div>
      <div className="flex-1 min-h-0">
        <ScalpingChart
          coin="BTC"
          interval="1m"
          candleData={candles}
          isExternalData={true}
          onPriceUpdate={setCurrentPrice}
        />
      </div>
    </div>
  );
}

export default memo(BTCChart);
