import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiRequestError } from '@nktkas/hyperliquid';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';
import type { SymbolMetadata } from '@/lib/services/metadata-cache.service';

const TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cfFFb92266';

const METADATA: SymbolMetadata = {
  coinIndex: 0,
  sizeDecimals: 5,
  timestamp: Date.now(),
};

// HL's openOrders endpoint shape (as consumed by cancelAllOrders).
const fakeOrder = (oid: number) => ({ oid, coin: 'BTC', side: 'A', limitPx: '80000', sz: '0.001' });

describe('submitBulkCancel — recovers per-status info from ApiRequestError', () => {
  let svc: HyperliquidService;

  beforeEach(() => {
    svc = new HyperliquidService(TEST_KEY, WALLET, true);
    (svc as any).publicClient = {
      frontendOpenOrders: vi.fn(async () => [fakeOrder(100), fakeOrder(200), fakeOrder(300)]),
    };
  });

  it('returns BulkCancelResult with mixed statuses when HL partially fails (SDK throws)', async () => {
    // SDK throws ApiRequestError when ANY order in the batch has an error,
    // but the response object on the error carries the per-order status array.
    const mixedResponse = {
      status: 'ok',
      response: {
        type: 'cancel',
        data: {
          statuses: ['success', { error: 'Order was already cancelled' }, 'success'],
        },
      },
    };
    (svc as any).walletClient = {
      cancel: vi.fn(async () => {
        throw new ApiRequestError(mixedResponse as any);
      }),
    };

    const result = await svc.cancelAllOrders('BTC', METADATA);

    expect(result.attemptedOids).toEqual(['100', '200', '300']);
    expect(result.response.response.data.statuses).toEqual([
      'success',
      { error: 'Order was already cancelled' },
      'success',
    ]);
  });

  it('returns BulkCancelResult on full success without throwing', async () => {
    const okResponse = {
      status: 'ok',
      response: { type: 'cancel', data: { statuses: ['success', 'success', 'success'] } },
    };
    (svc as any).walletClient = { cancel: vi.fn(async () => okResponse) };

    const result = await svc.cancelAllOrders('BTC', METADATA);

    expect(result.attemptedOids).toEqual(['100', '200', '300']);
    expect(result.response.response.data.statuses).toEqual(['success', 'success', 'success']);
  });

  it('rethrows non-ApiRequestError errors (network, etc) — caller catch block handles those', async () => {
    (svc as any).walletClient = {
      cancel: vi.fn(async () => {
        throw new Error('network blew up');
      }),
    };

    await expect(svc.cancelAllOrders('BTC', METADATA)).rejects.toThrow('network blew up');
  });

  it('rethrows ApiRequestError with status="err" (top-level error, no per-order data)', async () => {
    // Top-level errors like rate-limit (status: 'err') don't carry per-order
    // statuses — let those propagate so the catch block does the safe thing.
    const errResponse = { status: 'err', response: 'rate limited' };
    (svc as any).walletClient = {
      cancel: vi.fn(async () => {
        throw new ApiRequestError(errResponse as any);
      }),
    };

    await expect(svc.cancelAllOrders('BTC', METADATA)).rejects.toThrow();
  });
});
