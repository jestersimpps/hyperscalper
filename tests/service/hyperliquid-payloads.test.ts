import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';
import type { SymbolMetadata } from '@/lib/services/metadata-cache.service';

// A throwaway-but-valid private key (well-known test key from viem fixtures).
const TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cfFFb92266';

const METADATA: SymbolMetadata = {
  coinIndex: 5,
  tickSize: 0.01,
  sizeDecimals: 3,
  timestamp: Date.now(),
};

const installFakeWalletClient = (svc: HyperliquidService) => {
  const order = vi.fn(async () => ({
    status: 'ok',
    response: { type: 'order', data: { statuses: [{ resting: { oid: 1 } }] } },
  }));
  (svc as any).walletClient = { order };
  return order;
};

describe('HyperliquidService — wire payloads', () => {
  let svc: HyperliquidService;
  let order: ReturnType<typeof installFakeWalletClient>;

  beforeEach(() => {
    svc = new HyperliquidService(TEST_KEY, WALLET, true);
    order = installFakeWalletClient(svc);
  });

  describe('placeLimitOrder', () => {
    it('builds a Gtc limit order with the right asset index, side, price, size', async () => {
      await svc.placeLimitOrder(
        { coin: 'ETH', isBuy: true, price: '3500.00', size: '0.100', reduceOnly: false },
        METADATA,
      );

      expect(order).toHaveBeenCalledTimes(1);
      const payload = order.mock.calls[0][0];
      expect(payload).toEqual({
        orders: [
          {
            a: 5,
            b: true,
            p: '3500.00',
            s: '0.100',
            r: false,
            t: { limit: { tif: 'Gtc' } },
          },
        ],
        grouping: 'na',
      });
    });

    it('respects reduceOnly=true', async () => {
      await svc.placeLimitOrder(
        { coin: 'ETH', isBuy: false, price: '3500.00', size: '0.100', reduceOnly: true },
        METADATA,
      );
      expect(order.mock.calls[0][0].orders[0].r).toBe(true);
    });
  });

  describe('placeTriggerMarketOrder (the one used for stop-entries)', () => {
    it('caps LONG triggers 10% above triggerPx and tags as sl (stop-entry)', async () => {
      await svc.placeTriggerMarketOrder(
        { coin: 'ETH', triggerPrice: '100.00', size: '1.000', isBuy: true },
        METADATA,
      );

      const o = order.mock.calls[0][0].orders[0];
      expect(o.t).toEqual({
        trigger: { triggerPx: '100.00', isMarket: true, tpsl: 'sl' },
      });
      expect(o.p).toBe('110.00');
      expect(o.b).toBe(true);
      expect(o.r).toBe(false);
    });

    it('caps SHORT triggers 10% below triggerPx and tags as sl (stop-entry)', async () => {
      await svc.placeTriggerMarketOrder(
        { coin: 'ETH', triggerPrice: '100.00', size: '1.000', isBuy: false },
        METADATA,
      );

      const o = order.mock.calls[0][0].orders[0];
      expect(o.t).toEqual({
        trigger: { triggerPx: '100.00', isMarket: true, tpsl: 'sl' },
      });
      // 90 has 2 int digits → 5 sig figs → 3 decimals (and szDecimals=3 allows 3)
      expect(o.p).toBe('90.000');
      expect(o.b).toBe(false);
    });
  });

  describe('placeStopLoss', () => {
    it('builds a reduce-only sl trigger order', async () => {
      await svc.placeStopLoss(
        { coin: 'ETH', triggerPrice: '95.00', size: '1.000', isBuy: false },
        METADATA,
      );

      const payload = order.mock.calls[0][0];
      expect(payload.orders[0]).toEqual({
        a: 5,
        b: false,
        p: '95.000',
        s: '1.000',
        r: true, // reduce-only
        t: { trigger: { triggerPx: '95.000', isMarket: true, tpsl: 'sl' } },
      });
    });
  });

  describe('placeTakeProfit', () => {
    it('builds a reduce-only tp trigger order', async () => {
      await svc.placeTakeProfit(
        { coin: 'ETH', triggerPrice: '110.00', size: '1.000', isBuy: false },
        METADATA,
      );

      expect(order.mock.calls[0][0].orders[0]).toEqual({
        a: 5,
        b: false,
        p: '110.00',
        s: '1.000',
        r: true,
        t: { trigger: { triggerPx: '110.00', isMarket: true, tpsl: 'tp' } },
      });
    });
  });

  describe('placeMarketBuy / placeMarketSell', () => {
    it('placeMarketBuy uses Ioc limit at the supplied price', async () => {
      await svc.placeMarketBuy('ETH', '0.100', '3550.00', METADATA);
      expect(order.mock.calls[0][0].orders[0]).toEqual({
        a: 5,
        b: true,
        p: '3550.00',
        s: '0.100',
        r: false,
        t: { limit: { tif: 'Ioc' } },
      });
    });

    it('placeMarketSell uses Ioc limit at the supplied price', async () => {
      await svc.placeMarketSell('ETH', '0.100', '3450.00', METADATA);
      expect(order.mock.calls[0][0].orders[0]).toEqual({
        a: 5,
        b: false,
        p: '3450.00',
        s: '0.100',
        r: false,
        t: { limit: { tif: 'Ioc' } },
      });
    });
  });

  describe('placeBatchLimitOrders', () => {
    it('packs multiple orders into a single order call', async () => {
      await svc.placeBatchLimitOrders(
        [
          { coin: 'ETH', isBuy: true, price: '3500.00', size: '0.100' },
          { coin: 'ETH', isBuy: true, price: '3490.00', size: '0.100' },
        ],
        METADATA,
      );

      expect(order).toHaveBeenCalledTimes(1);
      expect(order.mock.calls[0][0].orders).toHaveLength(2);
    });

    it('throws on empty array', async () => {
      await expect(svc.placeBatchLimitOrders([], METADATA)).rejects.toThrow(/no orders/i);
    });
  });
});
