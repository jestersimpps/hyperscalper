import { useEffect, useRef, useState } from 'react';

interface AnimationState {
  priceDirection: 'up' | 'down' | null;
  volumeDirection: 'up' | 'down' | null;
}

export function usePriceVolumeAnimation(symbol: string, closePrices: number[] | undefined, currentVolume: number | undefined) {
  const [animationState, setAnimationState] = useState<AnimationState>({
    priceDirection: null,
    volumeDirection: null,
  });

  const prevTrendRef = useRef<'up' | 'down' | null>(null);
  const prevVolumeRef = useRef<number | undefined>(undefined);
  const priceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastPriceAnimationTimeRef = useRef<number>(0);
  const lastVolumeAnimationTimeRef = useRef<number>(0);

  useEffect(() => {
    if (closePrices && closePrices.length >= 5) {
      const last5Prices = closePrices.slice(-5);
      const firstPrice = last5Prices[0];
      const lastPrice = last5Prices[last5Prices.length - 1];

      const currentTrend = lastPrice > firstPrice ? 'up' : 'down';

      if (prevTrendRef.current !== null && prevTrendRef.current !== currentTrend) {
        const now = Date.now();
        const timeSinceLastAnimation = now - lastPriceAnimationTimeRef.current;

        if (timeSinceLastAnimation >= 500) {
          setAnimationState(prev => ({ ...prev, priceDirection: currentTrend }));
          lastPriceAnimationTimeRef.current = now;

          if (priceTimeoutRef.current) {
            clearTimeout(priceTimeoutRef.current);
          }

          priceTimeoutRef.current = setTimeout(() => {
            setAnimationState(prev => ({ ...prev, priceDirection: null }));
          }, 1000);
        }
      }

      prevTrendRef.current = currentTrend;
    }

    return () => {
      if (priceTimeoutRef.current) {
        clearTimeout(priceTimeoutRef.current);
      }
    };
  }, [closePrices]);

  useEffect(() => {
    if (currentVolume !== undefined && prevVolumeRef.current !== undefined && currentVolume !== prevVolumeRef.current) {
      const now = Date.now();
      const timeSinceLastAnimation = now - lastVolumeAnimationTimeRef.current;

      if (timeSinceLastAnimation >= 500) {
        const direction = currentVolume > prevVolumeRef.current ? 'up' : 'down';
        setAnimationState(prev => ({ ...prev, volumeDirection: direction }));
        lastVolumeAnimationTimeRef.current = now;

        if (volumeTimeoutRef.current) {
          clearTimeout(volumeTimeoutRef.current);
        }

        volumeTimeoutRef.current = setTimeout(() => {
          setAnimationState(prev => ({ ...prev, volumeDirection: null }));
        }, 1000);
      }
    }
    prevVolumeRef.current = currentVolume;

    return () => {
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
      }
    };
  }, [currentVolume]);

  return animationState;
}
