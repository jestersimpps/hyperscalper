import { useState, useEffect, useRef } from 'react';
import type { CandleData, TimeInterval } from '@/types';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { getStandardTimeWindow } from '@/lib/time-utils';

interface UseLocalCandleSubscriptionOptions {
  coin: string;
  interval: TimeInterval;
  enabled?: boolean;
}

interface UseLocalCandleSubscriptionReturn {
  candles: CandleData[];
  isLoading: boolean;
  error: string | null;
}

const formatPrice = (value: number, decimals: number): string => {
  return parseFloat(value.toFixed(decimals)).toString();
};

const formatCandle = (
  candle: Omit<CandleData, 'openFormatted' | 'highFormatted' | 'lowFormatted' | 'closeFormatted' | 'volumeFormatted'>,
  coin: string
): CandleData => {
  const decimals = useSymbolMetaStore.getState().getDecimals(coin);
  return {
    ...candle,
    openFormatted: formatPrice(candle.open, decimals.price),
    highFormatted: formatPrice(candle.high, decimals.price),
    lowFormatted: formatPrice(candle.low, decimals.price),
    closeFormatted: formatPrice(candle.close, decimals.price),
    volumeFormatted: candle.volume.toFixed(decimals.size),
  };
};

export function useLocalCandleSubscription({
  coin,
  interval,
  enabled = true,
}: UseLocalCandleSubscriptionOptions): UseLocalCandleSubscriptionReturn {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const serviceRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) {
      setCandles([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const init = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { startTime, endTime } = getStandardTimeWindow();
        const response = await fetch(
          `/api/candles?coin=${coin}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch candles: ${response.statusText}`);
        }

        const data = await response.json();
        const formattedData = data.map((candle: CandleData) => formatCandle(candle, coin));

        if (isMounted) {
          setCandles(formattedData);
          setIsLoading(false);
        }

        const { useWebSocketService } = await import('@/lib/websocket/websocket-singleton');
        const { service } = useWebSocketService('hyperliquid');

        if (!isMounted) return;

        serviceRef.current = service;

        const subscriptionId = service.subscribeToCandles({ coin, interval }, (candle: any) => {
          if (!isMounted) return;

          const formattedCandle = formatCandle(candle, coin);

          setCandles((prev) => {
            if (prev.length === 0) return prev;

            const lastCandle = prev[prev.length - 1];

            if (candle.time === lastCandle.time) {
              const updated = [...prev];
              updated[updated.length - 1] = formattedCandle;
              return updated;
            } else if (candle.time > lastCandle.time) {
              return [...prev, formattedCandle];
            }

            return prev;
          });
        });

        subscriptionIdRef.current = subscriptionId;
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      if (subscriptionIdRef.current && serviceRef.current) {
        serviceRef.current.unsubscribe(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
    };
  }, [coin, interval, enabled]);

  return { candles, isLoading, error };
}
