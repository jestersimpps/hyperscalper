import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOrderStore } from '@/stores/useOrderStore';

const SYMBOL = 'BTC';

const reset = () =>
  useOrderStore.setState({
    orders: {},
    optimisticOrders: {},
    pendingCancellations: new Set<string>(),
  } as any);

describe('useOrderStore — optimistic order lifecycle', () => {
  beforeEach(reset);

  it('addOptimisticOrder appends to optimisticOrders[coin]', () => {
    useOrderStore.getState().addOptimisticOrder(SYMBOL, {
      tempId: 't1',
      side: 'buy',
      price: 100,
      size: 1,
      orderType: 'trigger',
    });

    const opt = useOrderStore.getState().optimisticOrders[SYMBOL];
    expect(opt).toHaveLength(1);
    expect(opt[0].tempId).toBe('t1');
    expect(opt[0].isOptimistic).toBe(true);
  });

  it('updateOptimisticOrder patches an existing entry by tempId', () => {
    useOrderStore.getState().addOptimisticOrder(SYMBOL, { tempId: 't1', size: 0 });
    useOrderStore.getState().updateOptimisticOrder(SYMBOL, 't1', { size: 5 });

    expect(useOrderStore.getState().optimisticOrders[SYMBOL][0].size).toBe(5);
  });

  it('confirmOptimisticOrder moves the order to orders[coin] with the real OID', () => {
    useOrderStore.getState().addOptimisticOrder(SYMBOL, {
      tempId: 't1',
      side: 'buy',
      price: 100,
      size: 1,
    });

    useOrderStore.getState().confirmOptimisticOrder(SYMBOL, 't1', '12345');

    const orders = useOrderStore.getState().orders[SYMBOL];
    expect(orders).toHaveLength(1);
    expect(orders[0].oid).toBe('12345');
    expect(orders[0].isOptimistic).toBe(false);
    expect(orders[0].tempId).toBeUndefined();
    expect(useOrderStore.getState().optimisticOrders[SYMBOL]).toBeUndefined();
  });

  it('confirmOptimisticOrder is a no-op for unknown tempIds', () => {
    useOrderStore.getState().addOptimisticOrder(SYMBOL, { tempId: 't1' });
    useOrderStore.getState().confirmOptimisticOrder(SYMBOL, 'unknown', '999');

    expect(useOrderStore.getState().optimisticOrders[SYMBOL]).toHaveLength(1);
    expect(useOrderStore.getState().orders[SYMBOL]).toBeUndefined();
  });

  it('rollbackOptimisticOrder removes only the matching tempId', () => {
    useOrderStore.getState().addOptimisticOrder(SYMBOL, { tempId: 't1' });
    useOrderStore.getState().addOptimisticOrder(SYMBOL, { tempId: 't2' });

    useOrderStore.getState().rollbackOptimisticOrder(SYMBOL, 't1');

    const opt = useOrderStore.getState().optimisticOrders[SYMBOL];
    expect(opt).toHaveLength(1);
    expect(opt[0].tempId).toBe('t2');
  });

  it('rollback clears the symbol key entirely when last entry removed', () => {
    useOrderStore.getState().addOptimisticOrder(SYMBOL, { tempId: 't1' });
    useOrderStore.getState().rollbackOptimisticOrder(SYMBOL, 't1');

    expect(useOrderStore.getState().optimisticOrders[SYMBOL]).toBeUndefined();
  });
});

describe('useOrderStore — updateOrdersFromGlobalPoll reconciliation', () => {
  beforeEach(reset);

  it('drops optimistic orders that match a real order on side+price+size (within 0.01)', () => {
    useOrderStore.getState().addOptimisticOrder(SYMBOL, {
      tempId: 't1',
      side: 'buy',
      price: 100,
      size: 1,
      orderType: 'limit',
    });

    useOrderStore.getState().updateOrdersFromGlobalPoll([
      {
        coin: SYMBOL,
        oid: 555,
        side: 'B', // hyperliquid side encoding — the mapper handles this
        limitPx: '100.005',
        sz: '1.005',
        timestamp: Date.now(),
        orderType: 'Limit',
      },
    ]);

    expect(useOrderStore.getState().optimisticOrders[SYMBOL]).toBeUndefined();
    expect(useOrderStore.getState().orders[SYMBOL]).toHaveLength(1);
  });

  it('keeps optimistic orders that have no matching real order', () => {
    useOrderStore.getState().addOptimisticOrder(SYMBOL, {
      tempId: 't1',
      side: 'buy',
      price: 100,
      size: 1,
      orderType: 'limit',
    });

    useOrderStore.getState().updateOrdersFromGlobalPoll([
      {
        coin: SYMBOL,
        oid: 555,
        side: 'A', // sell — does not match
        limitPx: '100',
        sz: '1',
        timestamp: Date.now(),
        orderType: 'Limit',
      },
    ]);

    expect(useOrderStore.getState().optimisticOrders[SYMBOL]).toHaveLength(1);
  });

  it('expires unmatched optimistic orders older than 10s (TTL cleanup)', () => {
    useOrderStore.getState().addOptimisticOrder(SYMBOL, {
      tempId: 't1',
      side: 'buy',
      price: 100,
      size: 1,
      orderType: 'limit',
      timestamp: Date.now() - 11_000, // 11s ago
    });

    // Need at least one entry for SYMBOL in the poll to drive the cleanup branch.
    useOrderStore.getState().updateOrdersFromGlobalPoll([
      {
        coin: SYMBOL,
        oid: 999,
        side: 'A',
        limitPx: '999',
        sz: '999',
        timestamp: Date.now(),
        orderType: 'Limit',
      },
    ]);

    expect(useOrderStore.getState().optimisticOrders[SYMBOL]).toBeUndefined();
  });

  // CAVEAT (worth flagging): if the global poll returns NO orders for SYMBOL
  // (e.g. all orders have just filled and disappeared from the open-orders
  // feed), the cleanup branch is never entered for SYMBOL — the stale
  // optimistic order will sit there indefinitely. Not testable as a bug today
  // because the loop only iterates symbols present in the poll response.
});
