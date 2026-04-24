import { useEffect, useMemo, useRef } from 'react';

type AnyFn = (...args: never[]) => unknown;

interface Debounced<T extends AnyFn> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

function createDebounced<T extends AnyFn>(func: T, wait: number): Debounced<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  }) as Debounced<T>;

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

interface Throttled<T extends AnyFn> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

function createThrottled<T extends AnyFn>(func: T, limit: number): Throttled<T> {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let trailingTimeout: ReturnType<typeof setTimeout> | null = null;

  const throttled = ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;

      trailingTimeout = setTimeout(() => {
        inThrottle = false;
        trailingTimeout = null;
        if (lastArgs) {
          const args = lastArgs;
          lastArgs = null;
          throttled(...args);
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  }) as Throttled<T>;

  throttled.cancel = () => {
    if (trailingTimeout) {
      clearTimeout(trailingTimeout);
      trailingTimeout = null;
    }
    inThrottle = false;
    lastArgs = null;
  };

  return throttled;
}

export function useThrottledCallback<T extends AnyFn>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttled = useMemo(
    () => createThrottled((...args: Parameters<T>) => {
      callbackRef.current(...args);
    }, delay),
    [delay]
  );

  useEffect(() => {
    return () => {
      throttled.cancel();
    };
  }, [throttled]);

  return throttled;
}

export function useDebouncedCallback<T extends AnyFn>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debounced = useMemo(
    () => createDebounced((...args: Parameters<T>) => {
      callbackRef.current(...args);
    }, delay),
    [delay]
  );

  useEffect(() => {
    return () => {
      debounced.cancel();
    };
  }, [debounced]);

  return debounced;
}
