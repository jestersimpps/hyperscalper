import { useEffect, useRef, useState } from 'react';

interface Position {
  size: number;
  pnl: number;
  side: 'long' | 'short';
}

interface PositionAnimationState {
  isNew: boolean;
  pnlChange: 'increase' | 'decrease' | null;
  sizeChange: 'increase' | 'decrease' | null;
  side: 'long' | 'short' | null;
}

export function usePositionAnimations(
  symbols: string[],
  positions: Record<string, Position | null>
): Record<string, PositionAnimationState> {
  const prevPositionsRef = useRef<Record<string, Position | null>>({});
  const [animationStates, setAnimationStates] = useState<Record<string, PositionAnimationState>>({});
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      prevPositionsRef.current = { ...positions };
      return;
    }

    const newAnimationStates: Record<string, PositionAnimationState> = {};

    symbols.forEach(symbol => {
      const currentPosition = positions[symbol];
      const prevPosition = prevPositionsRef.current[symbol];

      if (!currentPosition || currentPosition.size === 0) {
        return;
      }

      const state: PositionAnimationState = {
        isNew: false,
        pnlChange: null,
        sizeChange: null,
        side: currentPosition.side,
      };

      if (!prevPosition || prevPosition.size === 0) {
        state.isNew = true;
      } else {
        if (currentPosition.pnl > prevPosition.pnl) {
          state.pnlChange = 'increase';
        } else if (currentPosition.pnl < prevPosition.pnl) {
          state.pnlChange = 'decrease';
        }

        if (currentPosition.size > prevPosition.size) {
          state.sizeChange = 'increase';
        } else if (currentPosition.size < prevPosition.size) {
          state.sizeChange = 'decrease';
        }
      }

      if (state.isNew || state.pnlChange || state.sizeChange) {
        newAnimationStates[symbol] = state;
      }
    });

    if (Object.keys(newAnimationStates).length > 0) {
      setAnimationStates(newAnimationStates);

      const clearTimers = Object.keys(newAnimationStates).map(symbol => {
        const state = newAnimationStates[symbol];
        const delay = state.isNew ? 1500 : state.sizeChange ? 300 : 500;

        return setTimeout(() => {
          setAnimationStates(prev => {
            const updated = { ...prev };
            delete updated[symbol];
            return updated;
          });
        }, delay);
      });

      prevPositionsRef.current = { ...positions };

      return () => clearTimers.forEach(timer => clearTimeout(timer));
    }

    prevPositionsRef.current = { ...positions };
  }, [symbols, positions]);

  return animationStates;
}
