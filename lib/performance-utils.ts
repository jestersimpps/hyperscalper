import { useEffect, useRef, useCallback } from 'react';

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  let lastArgs: Parameters<T> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          executedFunction(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);
  const throttledRef = useRef<ReturnType<typeof throttle> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  if (!throttledRef.current) {
    throttledRef.current = throttle((...args: Parameters<T>) => {
      callbackRef.current(...args);
    }, delay);
  }

  return throttledRef.current;
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);
  const debouncedRef = useRef<ReturnType<typeof debounce> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  if (!debouncedRef.current) {
    debouncedRef.current = debounce((...args: Parameters<T>) => {
      callbackRef.current(...args);
    }, delay);
  }

  return debouncedRef.current;
}

export function useRAFThrottle(callback: () => void, deps: React.DependencyList) {
  const rafIdRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      callbackRef.current();
      rafIdRef.current = null;
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, deps);
}

export function batchUpdates<T>(
  updateFn: (batch: T[]) => void,
  delay: number = 16
): (item: T) => void {
  let batch: T[] = [];
  let timeoutId: NodeJS.Timeout | null = null;

  return (item: T) => {
    batch.push(item);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      updateFn([...batch]);
      batch = [];
      timeoutId = null;
    }, delay);
  };
}
