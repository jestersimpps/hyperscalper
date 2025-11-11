# Optimistic UI Updates Implementation Plan

## Overview

This document outlines the plan to implement optimistic UI updates for order operations in the hyperscalper trading terminal. This will eliminate the current 0-3 second delay between user actions and visual feedback.

## Current Problem

Currently, when a user places an order:
1. Click action triggers API call
2. Wait for API response (100-500ms)
3. Wait for next global poll cycle (0-3 seconds)
4. Order appears on chart

**Total delay: 100ms - 3.5 seconds**

## Proposed Solution

Implement optimistic UI updates where:
1. Click action triggers API call
2. **Order appears immediately on chart (0ms delay)**
3. Order solidifies when API confirms (visual change)
4. Order removes if API fails (with error toast)

## Scope

### Operations to Optimize
- ✅ Order placement (all types: limit, market, cloud, trigger)
- ✅ Order cancellation
- ✅ Stop loss moves
- ❌ Position closures (excluded for now)

### Visual Design
- **Pending orders**: Dashed lines with 50% opacity
- **Confirmed orders**: Solid lines with full opacity
- **Pending cancellation**: Gray/strikethrough
- **Failed orders**: Remove immediately with error toast

## Implementation Details

### 1. Data Model Changes

**File**: `models/Order.ts`

```typescript
interface Order {
  oid: string;
  coin: string;
  side: OrderSide;
  price: number;
  size: number;
  orderType: OrderType;
  timestamp: number;

  // NEW FIELDS
  isOptimistic?: boolean;           // True for pending orders
  tempId?: string;                  // Temporary ID before API confirms
  isPendingCancellation?: boolean;  // True when cancel is in progress
}
```

### 2. Order Store Enhancement

**File**: `stores/useOrderStore.ts`

**New State:**
```typescript
interface OrderStore {
  orders: Record<string, Order[]>;           // Confirmed orders
  optimisticOrders: Record<string, Order[]>; // Pending orders
  pendingCancellations: Set<string>;         // Order IDs being cancelled
  // ... existing fields
}
```

**New Methods:**

#### `addOptimisticOrder(coin: string, order: Partial<Order>)`
- Generates temporary ID
- Adds order to `optimisticOrders[coin]`
- Order appears immediately on chart

#### `addOptimisticOrders(coin: string, orders: Partial<Order>[])`
- Batch version for cloud orders
- Adds 5 limit + 1 SL + 1 TP simultaneously

#### `confirmOptimisticOrder(coin: string, tempId: string, realOid: string)`
- Moves order from `optimisticOrders` to `orders`
- Updates OID from temp to real
- Triggers visual transition (dashed → solid)

#### `rollbackOptimisticOrder(coin: string, tempId: string)`
- Removes order from `optimisticOrders`
- Shows error toast
- Called when API returns error

#### `markPendingCancellation(coin: string, oid: string)`
- Adds OID to `pendingCancellations` set
- Order becomes grayed/strikethrough

#### `confirmCancellation(coin: string, oid: string)`
- Removes order from `orders`
- Removes OID from `pendingCancellations`

#### `getAllOrders(coin: string): Order[]`
- Merges `orders[coin]` + `optimisticOrders[coin]`
- Returns combined array for UI rendering

### 3. Trading Store Integration

**File**: `stores/useTradingStore.ts`

Modify all order placement methods to follow this pattern:

```typescript
placeLimitOrderAtPrice: async (params) => {
  const tempId = `temp_${Date.now()}_${Math.random()}`;
  const orderStore = useOrderStore.getState();

  // 1. ADD OPTIMISTIC ORDER IMMEDIATELY
  orderStore.addOptimisticOrder(params.symbol, {
    oid: tempId,
    coin: params.symbol,
    side: params.isBuy ? 'buy' : 'sell',
    price: params.price,
    size: calculatedSize,
    orderType: isTrigger ? 'trigger' : 'limit',
    timestamp: Date.now(),
    isOptimistic: true,
    tempId: tempId,
  });

  try {
    // 2. PLACE ACTUAL ORDER
    const response = await service.placeLimitOrder({
      coin: params.symbol,
      isBuy: params.isBuy,
      price: formattedPrice,
      size: formattedSize,
      reduceOnly: false,
    });

    // 3. CONFIRM OPTIMISTIC ORDER
    if (response.status === 'ok') {
      const realOid = response.response.data.statuses[0]?.resting?.oid;
      if (realOid) {
        orderStore.confirmOptimisticOrder(params.symbol, tempId, realOid);
        toast.success('Order placed');
      }
    } else {
      orderStore.rollbackOptimisticOrder(params.symbol, tempId);
      toast.error('Order failed');
    }
  } catch (error) {
    // 4. ROLLBACK ON ERROR
    orderStore.rollbackOptimisticOrder(params.symbol, tempId);
    toast.error(`Order failed: ${error.message}`);
    throw error;
  }
}
```

**Methods to Update:**
1. `placeLimitOrderAtPrice()` - single order
2. `buyCloud()` - 7 orders (5 limit + SL + TP)
3. `sellCloud()` - 7 orders (5 limit + SL + TP)
4. `smLong()` - 3 orders (market + SL + TP)
5. `smShort()` - 3 orders (market + SL + TP)
6. `bigLong()` - 3 orders (market + SL + TP)
7. `bigShort()` - 3 orders (market + SL + TP)
8. `cancelEntryOrders()` - mark orders pending cancellation
9. `cancelExitOrders()` - mark orders pending cancellation
10. `cancelAllOrders()` - mark all orders pending cancellation
11. `moveStopLoss()` - optimistically move stop loss line

### 4. Chart Rendering Updates

**File**: `components/ScalpingChart.tsx`

**Current Code (lines 1342-1383):**
```typescript
useEffect(() => {
  orders.forEach((order) => {
    const orderLine = candleSeriesRef.current.createPriceLine({
      price: displayPrice,
      color: isBuy ? bullishColor : bearishColor,
      lineWidth: 2,
      lineStyle: 1, // Solid
      title: `${side} ${orderType}`
    });
  });
}, [orders]);
```

**Updated Code:**
```typescript
useEffect(() => {
  const orderStore = useOrderStore.getState();
  const allOrders = orderStore.getAllOrders(coin);

  allOrders.forEach((order) => {
    const baseColor = isBuy ? bullishColor : bearishColor;
    const isOptimistic = order.isOptimistic || false;
    const isPending = order.isPendingCancellation || false;

    // Apply visual styles for optimistic/pending states
    const color = isPending
      ? '#808080'  // Gray for pending cancellation
      : isOptimistic
        ? fadeColor(baseColor, 0.5)  // 50% opacity for pending
        : baseColor;

    const lineStyle = isOptimistic ? 2 : 1; // 2 = dashed, 1 = solid

    const title = isOptimistic
      ? `PENDING ${side} ${orderType}`
      : isPending
        ? `CANCELLING ${side} ${orderType}`
        : `${side} ${orderType}`;

    const orderLine = candleSeriesRef.current.createPriceLine({
      price: displayPrice,
      color: color,
      lineWidth: 2,
      lineStyle: lineStyle,
      title: title
    });

    orderLinesRef.current.push(orderLine);
  });
}, [coin, orders, optimisticOrders]);
```

**Helper Function:**
```typescript
function fadeColor(hexColor: string, opacity: number): string {
  // Convert hex to rgba with opacity
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
```

### 5. Symbol View Updates

**File**: `components/symbol/SymbolView.tsx`

**Current:**
```typescript
const orders = useOrderStore(state => state.orders[coin] || []);
```

**Updated:**
```typescript
const orderStore = useOrderStore();
const allOrders = orderStore.getAllOrders(coin);
```

Pass `allOrders` to ScalpingChart instead of just `orders`.

### 6. Global Polling Integration

**File**: `stores/useGlobalPollingStore.ts`

**Modify `updateOrdersFromGlobalPoll()` in Order Store:**

```typescript
updateOrdersFromGlobalPoll: (allOrders) => {
  const orderStore = useOrderStore.getState();

  // Group orders by coin
  const ordersByCoin = {};
  allOrders.forEach(order => {
    if (!ordersByCoin[order.coin]) ordersByCoin[order.coin] = [];
    ordersByCoin[order.coin].push(order);
  });

  // Map to internal format
  const mappedOrders = {};
  Object.keys(ordersByCoin).forEach(coin => {
    mappedOrders[coin] = mapHyperliquidOrders(ordersByCoin[coin]);
  });

  // MERGE with optimistic orders instead of replacing
  const mergedOrders = {};
  Object.keys(mappedOrders).forEach(coin => {
    const realOrders = mappedOrders[coin];
    const optimistic = orderStore.optimisticOrders[coin] || [];

    // Remove optimistic orders that now exist in real orders
    const confirmedOptimistic = optimistic.filter(opt => {
      return !realOrders.some(real =>
        Math.abs(real.price - opt.price) < 0.01 &&
        Math.abs(real.size - opt.size) < 0.01 &&
        real.side === opt.side
      );
    });

    // Auto-cleanup optimistic orders older than 10 seconds
    const recentOptimistic = confirmedOptimistic.filter(opt =>
      Date.now() - opt.timestamp < 10000
    );

    mergedOrders[coin] = realOrders;
    if (recentOptimistic.length > 0) {
      orderStore.optimisticOrders[coin] = recentOptimistic;
    } else {
      delete orderStore.optimisticOrders[coin];
    }
  });

  set({ orders: mergedOrders });
}
```

## Edge Cases & Solutions

### 1. Batch Order Complexity (Cloud Orders)
**Problem**: 7 orders created simultaneously (5 limit + SL + TP)
**Solution**:
- Use `addOptimisticOrders()` to add all 7 at once
- Track as a group with shared `batchId`
- Confirm/rollback entire group together

### 2. Order ID Matching
**Problem**: API returns orders in unpredictable order
**Solution**:
- Match by characteristics (price, size, side) with fuzzy tolerance
- Use price proximity (±0.01) and size proximity (±0.001)
- Fall back to timestamp-based matching

### 3. Race Conditions with Polling
**Problem**: Global poll might arrive before API response
**Solution**:
- Keep optimistic orders for minimum 10 seconds
- Merge polling results with optimistic state
- Don't replace, only add confirmed orders

### 4. Network Timeouts
**Problem**: Unclear if order succeeded or failed
**Solution**:
- Keep optimistic order visible with "verifying..." state
- Wait for next poll cycle (max 3 seconds) to confirm
- Provide manual "refresh" button

### 5. Multi-Window Scenarios
**Problem**: Multiple browser tabs open
**Solution**:
- Optimistic updates only in window that placed order
- Other windows see orders after polling update
- Consider BroadcastChannel API for tab sync (future enhancement)

### 6. Cancellation Race Conditions
**Problem**: User cancels optimistic order before API confirms creation
**Solution**:
- Queue cancellation request
- Execute after creation completes
- Show order as "pending cancellation" during wait

## Testing Checklist

### Manual Testing
- [ ] Place single limit order - appears immediately, solidifies after ~200ms
- [ ] Place cloud order - all 7 orders appear immediately
- [ ] Place market order with SL/TP - all 3 orders appear immediately
- [ ] Cancel order - grays out immediately, removes after confirmation
- [ ] Move stop loss - new position shows immediately
- [ ] API error - order removes with error toast
- [ ] Network timeout - order shows "verifying" state
- [ ] Global poll confirms optimistic order - transitions to solid
- [ ] Rapid order placement - multiple orders don't conflict

### Edge Case Testing
- [ ] Place order, immediately cancel - handles gracefully
- [ ] Place 2 orders at same price - both render correctly
- [ ] API returns different order than requested - rolls back correctly
- [ ] Loss of internet connection - proper error handling
- [ ] Multiple tabs open - no duplicate optimistic orders

## Performance Considerations

### Memory Impact
- Each optimistic order: ~200 bytes
- Max simultaneous optimistic orders: ~50
- Total memory overhead: ~10KB (negligible)

### Rendering Performance
- Chart re-renders when optimistic orders change
- Debounce rapid updates with 50ms delay
- Use React.memo on chart components

### API Queue Impact
- Optimistic updates don't affect queue
- Queue still prevents rate limiting
- UI responsiveness independent of queue state

## Future Enhancements

### Phase 2 (Optional)
1. **Position closures** - Optimistic position size updates
2. **Order modifications** - Edit price/size optimistically
3. **Multi-tab sync** - BroadcastChannel API integration
4. **Undo functionality** - Cancel optimistic action before API call
5. **Animation polish** - Smooth transitions between states
6. **Sound effects** - Audio feedback on order confirmation

## Implementation Timeline

Estimated time: 4-6 hours

1. **Hour 1**: Order model + store methods (1h)
2. **Hour 2**: Trading store integration (1.5h)
3. **Hour 3**: Chart rendering updates (1h)
4. **Hour 4**: Global polling merge logic (1h)
5. **Hour 5**: Testing + bug fixes (1.5h)

## Success Metrics

### Before Optimistic Updates
- Order placement feedback: 100ms - 3.5s delay
- User confusion: "Did my order go through?"
- Multiple clicks due to uncertain state

### After Optimistic Updates
- Order placement feedback: 0ms delay
- Clear visual states: pending → confirmed → failed
- Single-click confidence
- Professional trading terminal feel

## Rollback Plan

If issues arise:
1. Feature flag: `ENABLE_OPTIMISTIC_UPDATES = false`
2. Fall back to `orders` only (ignore `optimisticOrders`)
3. Remove visual distinction code
4. Revert to original polling-based updates

## Conclusion

This implementation will provide instant visual feedback for all order operations while maintaining data integrity through proper error handling and state synchronization with the API. The user experience will improve from "uncertain and slow" to "instant and professional."
