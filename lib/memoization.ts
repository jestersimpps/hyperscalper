interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 100, ttl: number = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

function hashCandleData(candles: any[]): string {
  if (!candles || candles.length === 0) return 'empty';

  const first = candles[0];
  const last = candles[candles.length - 1];

  return `${candles.length}-${first.time}-${last.time}-${last.close}`;
}

export function createMemoizedFunction<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => TResult,
  keyGenerator: (...args: TArgs) => string,
  cacheSize: number = 50,
  ttl: number = 30000
): (...args: TArgs) => TResult {
  const cache = new LRUCache<TResult>(cacheSize, ttl);

  return (...args: TArgs): TResult => {
    const key = keyGenerator(...args);
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result);

    return result;
  };
}

export function createCandleBasedMemoization<TArgs extends [any[], ...any[]], TResult>(
  fn: (...args: TArgs) => TResult,
  additionalKeyGen?: (...args: Tail<TArgs>) => string,
  cacheSize?: number,
  ttl?: number
): (...args: TArgs) => TResult {
  return createMemoizedFunction(
    fn,
    (...args: TArgs) => {
      const candleHash = hashCandleData(args[0]);
      const additionalKey = additionalKeyGen ? additionalKeyGen(...(args.slice(1) as Tail<TArgs>)) : '';
      return `${candleHash}${additionalKey}`;
    },
    cacheSize,
    ttl
  );
}

type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;

export { hashCandleData };
