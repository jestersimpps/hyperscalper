import { create } from 'zustand';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';

const ORDER_COUNT = 5;
const TAKE_PROFIT_PERCENT = 2;

interface CloudOrderParams {
  symbol: string;
  currentPrice: number;
  priceInterval: number;
  percentage: number;
}

interface MarketOrderParams {
  symbol: string;
  currentPrice: number;
  priceInterval: number;
  percentage: number;
}

interface ClosePositionParams {
  symbol: string;
  percentage: 25 | 50 | 75 | 100;
}

interface MoveStopLossParams {
  coin: string;
  percentage: 0 | 25 | 50 | 75;
}

interface TradingStore {
  service: HyperliquidService | null;
  isExecuting: Record<string, boolean>;
  errors: Record<string, string | null>;

  setService: (service: HyperliquidService) => void;
  buyCloud: (params: CloudOrderParams) => Promise<void>;
  sellCloud: (params: CloudOrderParams) => Promise<void>;
  smLong: (params: MarketOrderParams) => Promise<void>;
  smShort: (params: MarketOrderParams) => Promise<void>;
  bigLong: (params: MarketOrderParams) => Promise<void>;
  bigShort: (params: MarketOrderParams) => Promise<void>;
  closePosition: (params: ClosePositionParams) => Promise<void>;
  moveStopLoss: (params: MoveStopLossParams) => Promise<void>;
  cancelEntryOrders: (symbol: string) => Promise<void>;
  cancelAllOrders: (symbol: string) => Promise<void>;
}

export const useTradingStore = create<TradingStore>((set, get) => ({
  service: null,
  isExecuting: {},
  errors: {},

  setService: (service: HyperliquidService) => {
    set({ service });
  },

  buyCloud: async (params: CloudOrderParams) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const { symbol, currentPrice, priceInterval, percentage } = params;

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`buyCloud_${symbol}`]: true },
      errors: { ...state.errors, [`buyCloud_${symbol}`]: null },
    }));

    try {
      const priceLevels: number[] = [];
      for (let i = 1; i <= ORDER_COUNT; i++) {
        const level = currentPrice - (2 * priceInterval * i / ORDER_COUNT);
        priceLevels.push(level);
      }

      const accountBalance = await service.getAccountBalance();
      const accountValue = parseFloat(accountBalance.accountValue);
      const cloudSize = (accountValue * percentage) / 100;

      const orderParams = [];
      for (const level of priceLevels) {
        const formattedPrice = await service.formatPrice(level, symbol);
        const coinSize = cloudSize / level;
        const formattedSize = await service.formatSize(coinSize, symbol);

        orderParams.push({
          coin: symbol,
          isBuy: true,
          price: formattedPrice,
          size: formattedSize,
          reduceOnly: false,
        });
      }

      await service.placeBatchLimitOrders(orderParams);

      const totalCoinSize = orderParams.reduce((sum, order) => sum + parseFloat(order.size), 0);
      const formattedTotalSize = await service.formatSize(totalCoinSize, symbol);

      const stopLossPrice = currentPrice - (8 * priceInterval);
      const formattedStopLoss = await service.formatPrice(stopLossPrice, symbol);

      const takeProfitPrice = currentPrice * (1 + TAKE_PROFIT_PERCENT / 100);
      const formattedTakeProfit = await service.formatPrice(takeProfitPrice, symbol);

      await service.placeStopLoss({
        coin: symbol,
        triggerPrice: formattedStopLoss,
        size: formattedTotalSize,
        isBuy: false,
      });

      await service.placeTakeProfit({
        coin: symbol,
        triggerPrice: formattedTakeProfit,
        size: formattedTotalSize,
        isBuy: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set((state) => ({
        errors: { ...state.errors, [`buyCloud_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`buyCloud_${symbol}`]: false },
      }));
    }
  },

  sellCloud: async (params: CloudOrderParams) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const { symbol, currentPrice, priceInterval, percentage } = params;

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`sellCloud_${symbol}`]: true },
      errors: { ...state.errors, [`sellCloud_${symbol}`]: null },
    }));

    try {
      const priceLevels: number[] = [];
      for (let i = 1; i <= ORDER_COUNT; i++) {
        const level = currentPrice + (2 * priceInterval * i / ORDER_COUNT);
        priceLevels.push(level);
      }

      const accountBalance = await service.getAccountBalance();
      const accountValue = parseFloat(accountBalance.accountValue);
      const cloudSize = (accountValue * percentage) / 100;

      const orderParams = [];
      for (const level of priceLevels) {
        const formattedPrice = await service.formatPrice(level, symbol);
        const coinSize = cloudSize / level;
        const formattedSize = await service.formatSize(coinSize, symbol);

        orderParams.push({
          coin: symbol,
          isBuy: false,
          price: formattedPrice,
          size: formattedSize,
          reduceOnly: false,
        });
      }

      await service.placeBatchLimitOrders(orderParams);

      const totalCoinSize = orderParams.reduce((sum, order) => sum + parseFloat(order.size), 0);
      const formattedTotalSize = await service.formatSize(totalCoinSize, symbol);

      const stopLossPrice = currentPrice + (8 * priceInterval);
      const formattedStopLoss = await service.formatPrice(stopLossPrice, symbol);

      const takeProfitPrice = currentPrice * (1 - TAKE_PROFIT_PERCENT / 100);
      const formattedTakeProfit = await service.formatPrice(takeProfitPrice, symbol);

      await service.placeStopLoss({
        coin: symbol,
        triggerPrice: formattedStopLoss,
        size: formattedTotalSize,
        isBuy: true,
      });

      await service.placeTakeProfit({
        coin: symbol,
        triggerPrice: formattedTakeProfit,
        size: formattedTotalSize,
        isBuy: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set((state) => ({
        errors: { ...state.errors, [`sellCloud_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`sellCloud_${symbol}`]: false },
      }));
    }
  },

  smLong: async (params: MarketOrderParams) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const { symbol, currentPrice, priceInterval, percentage } = params;

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`smLong_${symbol}`]: true },
      errors: { ...state.errors, [`smLong_${symbol}`]: null },
    }));

    try {
      const accountBalance = await service.getAccountBalance();
      const accountValue = parseFloat(accountBalance.accountValue);
      const positionSize = (accountValue * percentage) / 100;

      const coinSize = positionSize / currentPrice;
      const formattedSize = await service.formatSize(coinSize, symbol);

      await service.placeMarketBuy(symbol, formattedSize);

      const stopLossPrice = currentPrice - (8 * priceInterval);
      const formattedStopLoss = await service.formatPrice(stopLossPrice, symbol);

      const takeProfitPrice = currentPrice * (1 + TAKE_PROFIT_PERCENT / 100);
      const formattedTakeProfit = await service.formatPrice(takeProfitPrice, symbol);

      await service.placeStopLoss({
        coin: symbol,
        triggerPrice: formattedStopLoss,
        size: formattedSize,
        isBuy: false,
      });

      await service.placeTakeProfit({
        coin: symbol,
        triggerPrice: formattedTakeProfit,
        size: formattedSize,
        isBuy: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set((state) => ({
        errors: { ...state.errors, [`smLong_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`smLong_${symbol}`]: false },
      }));
    }
  },

  smShort: async (params: MarketOrderParams) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const { symbol, currentPrice, priceInterval, percentage } = params;

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`smShort_${symbol}`]: true },
      errors: { ...state.errors, [`smShort_${symbol}`]: null },
    }));

    try {
      const accountBalance = await service.getAccountBalance();
      const accountValue = parseFloat(accountBalance.accountValue);
      const positionSize = (accountValue * percentage) / 100;

      const coinSize = positionSize / currentPrice;
      const formattedSize = await service.formatSize(coinSize, symbol);

      await service.placeMarketSell(symbol, formattedSize);

      const stopLossPrice = currentPrice + (8 * priceInterval);
      const formattedStopLoss = await service.formatPrice(stopLossPrice, symbol);

      const takeProfitPrice = currentPrice * (1 - TAKE_PROFIT_PERCENT / 100);
      const formattedTakeProfit = await service.formatPrice(takeProfitPrice, symbol);

      await service.placeStopLoss({
        coin: symbol,
        triggerPrice: formattedStopLoss,
        size: formattedSize,
        isBuy: true,
      });

      await service.placeTakeProfit({
        coin: symbol,
        triggerPrice: formattedTakeProfit,
        size: formattedSize,
        isBuy: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set((state) => ({
        errors: { ...state.errors, [`smShort_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`smShort_${symbol}`]: false },
      }));
    }
  },

  bigLong: async (params: MarketOrderParams) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const { symbol, currentPrice, priceInterval, percentage } = params;

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`bigLong_${symbol}`]: true },
      errors: { ...state.errors, [`bigLong_${symbol}`]: null },
    }));

    try {
      const accountBalance = await service.getAccountBalance();
      const accountValue = parseFloat(accountBalance.accountValue);
      const positionSize = (accountValue * percentage) / 100;

      const coinSize = positionSize / currentPrice;
      const formattedSize = await service.formatSize(coinSize, symbol);

      await service.placeMarketBuy(symbol, formattedSize);

      const stopLossPrice = currentPrice - (8 * priceInterval);
      const formattedStopLoss = await service.formatPrice(stopLossPrice, symbol);

      const takeProfitPrice = currentPrice * (1 + TAKE_PROFIT_PERCENT / 100);
      const formattedTakeProfit = await service.formatPrice(takeProfitPrice, symbol);

      await service.placeStopLoss({
        coin: symbol,
        triggerPrice: formattedStopLoss,
        size: formattedSize,
        isBuy: false,
      });

      await service.placeTakeProfit({
        coin: symbol,
        triggerPrice: formattedTakeProfit,
        size: formattedSize,
        isBuy: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set((state) => ({
        errors: { ...state.errors, [`bigLong_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`bigLong_${symbol}`]: false },
      }));
    }
  },

  bigShort: async (params: MarketOrderParams) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const { symbol, currentPrice, priceInterval, percentage } = params;

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`bigShort_${symbol}`]: true },
      errors: { ...state.errors, [`bigShort_${symbol}`]: null },
    }));

    try {
      const accountBalance = await service.getAccountBalance();
      const accountValue = parseFloat(accountBalance.accountValue);
      const positionSize = (accountValue * percentage) / 100;

      const coinSize = positionSize / currentPrice;
      const formattedSize = await service.formatSize(coinSize, symbol);

      await service.placeMarketSell(symbol, formattedSize);

      const stopLossPrice = currentPrice + (8 * priceInterval);
      const formattedStopLoss = await service.formatPrice(stopLossPrice, symbol);

      const takeProfitPrice = currentPrice * (1 - TAKE_PROFIT_PERCENT / 100);
      const formattedTakeProfit = await service.formatPrice(takeProfitPrice, symbol);

      await service.placeStopLoss({
        coin: symbol,
        triggerPrice: formattedStopLoss,
        size: formattedSize,
        isBuy: true,
      });

      await service.placeTakeProfit({
        coin: symbol,
        triggerPrice: formattedTakeProfit,
        size: formattedSize,
        isBuy: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set((state) => ({
        errors: { ...state.errors, [`bigShort_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`bigShort_${symbol}`]: false },
      }));
    }
  },

  closePosition: async (params: ClosePositionParams) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const { symbol, percentage } = params;

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`closePosition_${symbol}`]: true },
      errors: { ...state.errors, [`closePosition_${symbol}`]: null },
    }));

    try {
      const positions = await service.getOpenPositions();
      const position = positions.find(p => p.position.coin === symbol);

      if (!position) {
        throw new Error(`No open position for ${symbol}`);
      }

      const fullSize = Math.abs(parseFloat(position.position.szi));
      const sizeToClose = percentage === 100 ? undefined : ((fullSize * percentage) / 100).toString();

      await service.closePosition({
        coin: symbol,
        size: sizeToClose,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set((state) => ({
        errors: { ...state.errors, [`closePosition_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`closePosition_${symbol}`]: false },
      }));
    }
  },

  moveStopLoss: async (params: MoveStopLossParams) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const { coin, percentage } = params;

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`moveStopLoss_${coin}`]: true },
      errors: { ...state.errors, [`moveStopLoss_${coin}`]: null },
    }));

    try {
      const positions = await service.getOpenPositions();
      const allMids = await service.getAllMids();
      const assetPosition = positions.find(p => p.position.coin === coin);

      if (!assetPosition) {
        throw new Error(`No open position found for ${coin}`);
      }

      const szi = parseFloat(assetPosition.position.szi);
      const entryPrice = parseFloat(assetPosition.position.entryPx || '0');
      const currentPrice = parseFloat(allMids[coin] || '0');
      const side: 'long' | 'short' = szi > 0 ? 'long' : 'short';
      const size = Math.abs(szi);

      let newStopLossPrice: number;
      if (side === 'long') {
        newStopLossPrice = entryPrice + (currentPrice - entryPrice) * (percentage / 100);
      } else {
        newStopLossPrice = entryPrice - (entryPrice - currentPrice) * (percentage / 100);
      }

      const allOrders = await service.getOpenOrders();
      const stopLossOrders = allOrders.filter((order: any) => {
        if (order.coin !== coin) return false;
        if (!order.isTrigger || !order.isPositionTpsl) return false;
        const ot = order.orderType?.toLowerCase() || '';
        return ot.includes('stop market') || order.reduceOnly;
      });

      if (stopLossOrders.length > 0) {
        for (const slOrder of stopLossOrders) {
          await service.cancelOrder(coin, slOrder.oid);
        }
      }

      const formattedStopLoss = await service.formatPrice(newStopLossPrice, coin);
      const formattedSize = await service.formatSize(size, coin);

      await service.placeStopLoss({
        coin,
        triggerPrice: formattedStopLoss,
        size: formattedSize,
        isBuy: side === 'short',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set((state) => ({
        errors: { ...state.errors, [`moveStopLoss_${coin}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`moveStopLoss_${coin}`]: false },
      }));
    }
  },

  cancelEntryOrders: async (symbol: string) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`cancelEntry_${symbol}`]: true },
      errors: { ...state.errors, [`cancelEntry_${symbol}`]: null },
    }));

    try {
      await service.cancelEntryOrders(symbol);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set((state) => ({
        errors: { ...state.errors, [`cancelEntry_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`cancelEntry_${symbol}`]: false },
      }));
    }
  },

  cancelAllOrders: async (symbol: string) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`cancelAll_${symbol}`]: true },
      errors: { ...state.errors, [`cancelAll_${symbol}`]: null },
    }));

    try {
      await service.cancelAllOrders(symbol);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set((state) => ({
        errors: { ...state.errors, [`cancelAll_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`cancelAll_${symbol}`]: false },
      }));
    }
  },
}));
