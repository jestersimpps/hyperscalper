import { vi } from 'vitest';
import type { SymbolMetadata } from '@/lib/services/metadata-cache.service';

export interface RecordedOrderCall {
  method: string;
  args: unknown[];
}

export interface FakeServiceOptions {
  accountValue?: number;
  metadata?: Partial<SymbolMetadata>;
  orderResponse?: any;
  mids?: Record<string, string>;
}

export const DEFAULT_METADATA: SymbolMetadata = {
  coinIndex: 42,
  sizeDecimals: 3,
  timestamp: Date.now(),
};

export const DEFAULT_ORDER_RESPONSE = {
  status: 'ok',
  response: {
    type: 'order',
    data: {
      statuses: [{ resting: { oid: 999 } }],
    },
  },
};

export function createFakeService(opts: FakeServiceOptions = {}) {
  const metadata: SymbolMetadata = { ...DEFAULT_METADATA, ...(opts.metadata || {}) };
  const accountValue = opts.accountValue ?? 1000;
  const orderResponse = opts.orderResponse ?? DEFAULT_ORDER_RESPONSE;
  // Default mid that matches the existing dispatch tests' currentPrice=100
  const mids: Record<string, string> = opts.mids ?? { BTC: '100', ETH: '100' };
  const calls: RecordedOrderCall[] = [];

  const record = (method: string, ...args: unknown[]) => {
    calls.push({ method, args });
  };

  const fake = {
    calls,
    metadata,

    getAccountBalanceCached: vi.fn(async () => ({
      withdrawable: String(accountValue),
      marginUsed: '0',
      accountValue: String(accountValue),
    })),
    getAllMids: vi.fn(async () => mids),
    getMetadataCache: vi.fn(async (_coin: string) => metadata),
    setLeverage: vi.fn(async (..._args: unknown[]) => null),
    invalidateAccountCache: vi.fn(),

    formatPriceCached: vi.fn((price: number) => price.toFixed(2)),
    formatSizeCached: vi.fn((size: number) => size.toFixed(metadata.sizeDecimals)),
    ensureMinNotional: vi.fn((size: number, _price: number) => ({
      size: size.toFixed(metadata.sizeDecimals),
      wasBumped: false,
    })),

    placeLimitOrder: vi.fn(async (...args: unknown[]) => {
      record('placeLimitOrder', ...args);
      return orderResponse;
    }),
    placeTriggerMarketOrder: vi.fn(async (...args: unknown[]) => {
      record('placeTriggerMarketOrder', ...args);
      return orderResponse;
    }),
    placeStopLoss: vi.fn(async (...args: unknown[]) => {
      record('placeStopLoss', ...args);
      return orderResponse;
    }),
    placeTakeProfit: vi.fn(async (...args: unknown[]) => {
      record('placeTakeProfit', ...args);
      return orderResponse;
    }),
  };

  return fake;
}

export type FakeService = ReturnType<typeof createFakeService>;
