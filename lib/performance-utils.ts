import { useEffect, useMemo, useRef } from 'react';

interface SchedulerWithYield {
  yield?: () => Promise<void>;
}

export function yieldToMain(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  const scheduler = (window as unknown as { scheduler?: SchedulerWithYield }).scheduler;
  if (scheduler?.yield) {
    return scheduler.yield();
  }

  return new Promise(resolve => setTimeout(resolve, 0));
}

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
    // eslint-disable-next-line react-hooks/refs -- callbackRef is only read inside the returned closure, not during render
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
    // eslint-disable-next-line react-hooks/refs -- callbackRef is only read inside the returned closure, not during render
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
