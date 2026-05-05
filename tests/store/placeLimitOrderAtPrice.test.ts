import { describe, it, expect, beforeEach } from 'vitest';
import { useTradingStore } from '@/stores/useTradingStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { createFakeService, type FakeService } from '../helpers/fake-service';

const SYMBOL = 'BTC';

const installFakeService = (overrides: Parameters<typeof createFakeService>[0] = {}) => {
  const fake = createFakeService(overrides);
  useTradingStore.setState({ service: fake as any });
  useOrderStore.setState({ orders: {}, optimisticOrders: {} } as any);
  return fake;
};

const setLeverage = (n: number) => {
  useSettingsStore.setState((s: any) => ({
    ...s,
    settings: { ...s.settings, orders: { ...s.settings.orders, leverage: n } },
  }));
};

describe('placeLimitOrderAtPrice — dispatch logic', () => {
  let fake: FakeService;

  beforeEach(() => {
    setLeverage(1);
    fake = installFakeService({ accountValue: 1000 });
  });

  describe('LONG above current price → trigger-market (stop-buy / breakout entry)', () => {
    it('calls placeTriggerMarketOrder, not placeLimitOrder', async () => {
      await useTradingStore.getState().placeLimitOrderAtPrice({
        symbol: SYMBOL,
        price: 110,
        currentPrice: 100,
        isBuy: true,
        percentage: 10,
      });

      expect(fake.placeTriggerMarketOrder).toHaveBeenCalledTimes(1);
      expect(fake.placeLimitOrder).not.toHaveBeenCalled();
    });

    it('passes correct params to placeTriggerMarketOrder', async () => {
      await useTradingStore.getState().placeLimitOrderAtPrice({
        symbol: SYMBOL,
        price: 110,
        currentPrice: 100,
        isBuy: true,
        percentage: 10,
      });

      const [params] = fake.placeTriggerMarketOrder.mock.calls[0];
      expect(params).toMatchObject({
        coin: SYMBOL,
        triggerPrice: '110.00',
        isBuy: true,
      });
    });
  });

  describe('SHORT below current price → trigger-market (stop-sell / breakdown entry)', () => {
    it('calls placeTriggerMarketOrder, not placeLimitOrder', async () => {
      await useTradingStore.getState().placeLimitOrderAtPrice({
        symbol: SYMBOL,
        price: 90,
        currentPrice: 100,
        isBuy: false,
        percentage: 10,
      });

      expect(fake.placeTriggerMarketOrder).toHaveBeenCalledTimes(1);
      expect(fake.placeLimitOrder).not.toHaveBeenCalled();
    });

    it('passes correct params to placeTriggerMarketOrder', async () => {
      await useTradingStore.getState().placeLimitOrderAtPrice({
        symbol: SYMBOL,
        price: 90,
        currentPrice: 100,
        isBuy: false,
        percentage: 10,
      });

      const [params] = fake.placeTriggerMarketOrder.mock.calls[0];
      expect(params).toMatchObject({
        coin: SYMBOL,
        triggerPrice: '90.00',
        isBuy: false,
      });
    });
  });

  describe('LONG below current price → resting limit (pullback entry)', () => {
    it('calls placeLimitOrder, not placeTriggerMarketOrder', async () => {
      await useTradingStore.getState().placeLimitOrderAtPrice({
        symbol: SYMBOL,
        price: 90,
        currentPrice: 100,
        isBuy: true,
        percentage: 10,
      });

      expect(fake.placeLimitOrder).toHaveBeenCalledTimes(1);
      expect(fake.placeTriggerMarketOrder).not.toHaveBeenCalled();
    });
  });

  describe('SHORT above current price → resting limit (rally entry)', () => {
    it('calls placeLimitOrder, not placeTriggerMarketOrder', async () => {
      await useTradingStore.getState().placeLimitOrderAtPrice({
        symbol: SYMBOL,
        price: 110,
        currentPrice: 100,
        isBuy: false,
        percentage: 10,
      });

      expect(fake.placeLimitOrder).toHaveBeenCalledTimes(1);
      expect(fake.placeTriggerMarketOrder).not.toHaveBeenCalled();
    });
  });
});

describe('placeLimitOrderAtPrice — sizing & validation', () => {
  beforeEach(() => setLeverage(1));

  it('rejects orders below $10 minimum notional', async () => {
    installFakeService({ accountValue: 50 });

    await expect(
      useTradingStore.getState().placeLimitOrderAtPrice({
        symbol: SYMBOL,
        price: 100,
        currentPrice: 100,
        isBuy: true,
        percentage: 1, // $0.50 notional
      }),
    ).rejects.toThrow(/minimum/i);
  });

  it('throws when service is not initialized', async () => {
    useTradingStore.setState({ service: null });

    await expect(
      useTradingStore.getState().placeLimitOrderAtPrice({
        symbol: SYMBOL,
        price: 100,
        currentPrice: 100,
        isBuy: true,
        percentage: 10,
      }),
    ).rejects.toThrow(/service/i);
  });
});

describe('placeLimitOrderAtPrice — optimistic order lifecycle', () => {
  beforeEach(() => setLeverage(1));

  it('confirms the optimistic order with the real OID on success', async () => {
    installFakeService({ accountValue: 1000 });

    await useTradingStore.getState().placeLimitOrderAtPrice({
      symbol: SYMBOL,
      price: 110,
      currentPrice: 100,
      isBuy: true,
      percentage: 10,
    });

    const orders = useOrderStore.getState().orders[SYMBOL] || [];
    expect(orders).toHaveLength(1);
    expect(orders[0].oid).toBe('999');
    expect(orders[0].isOptimistic).toBe(false);
    expect(useOrderStore.getState().optimisticOrders[SYMBOL]).toBeUndefined();
  });

  it('rolls back the optimistic order on per-order rejection (status:ok + statuses[0].error)', async () => {
    const fake = installFakeService({
      accountValue: 1000,
      orderResponse: {
        status: 'ok',
        response: { type: 'order', data: { statuses: [{ error: 'rejected by HL' }] } },
      },
    });

    await useTradingStore.getState().placeLimitOrderAtPrice({
      symbol: SYMBOL,
      price: 110,
      currentPrice: 100,
      isBuy: true,
      percentage: 10,
    });

    expect(fake.placeTriggerMarketOrder).toHaveBeenCalled();
    expect(useOrderStore.getState().optimisticOrders[SYMBOL]).toBeUndefined();
    expect(useOrderStore.getState().orders[SYMBOL] || []).toHaveLength(0);
  });

  it('rolls back the optimistic order when the SDK throws', async () => {
    const fake = installFakeService({ accountValue: 1000 });
    fake.placeTriggerMarketOrder.mockRejectedValueOnce(new Error('network blew up'));

    await expect(
      useTradingStore.getState().placeLimitOrderAtPrice({
        symbol: SYMBOL,
        price: 110,
        currentPrice: 100,
        isBuy: true,
        percentage: 10,
      }),
    ).rejects.toThrow(/network blew up/);

    expect(useOrderStore.getState().optimisticOrders[SYMBOL]).toBeUndefined();
  });
});
