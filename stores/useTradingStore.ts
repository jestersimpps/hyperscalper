import { create } from 'zustand';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';
import { useOrderStore } from './useOrderStore';
import { usePositionStore } from './usePositionStore';
import toast from 'react-hot-toast';

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

interface LimitOrderAtPriceParams {
  symbol: string;
  price: number;
  isBuy: boolean;
  percentage: number;
  currentPrice: number;
}

interface ExitOrderAtPriceParams {
  symbol: string;
  price: number;
  percentage: 25 | 50 | 75 | 100;
  positionSide: 'long' | 'short';
  positionSize: number;
  currentPrice: number;
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
  placeLimitOrderAtPrice: (params: LimitOrderAtPriceParams) => Promise<void>;
  placeExitOrderAtPrice: (params: ExitOrderAtPriceParams) => Promise<void>;
  closePosition: (params: ClosePositionParams) => Promise<void>;
  moveStopLoss: (params: MoveStopLossParams) => Promise<void>;
  cancelEntryOrders: (symbol: string) => Promise<void>;
  cancelExitOrders: (symbol: string) => Promise<void>;
  cancelTPOrders: (symbol: string) => Promise<void>;
  cancelSLOrders: (symbol: string) => Promise<void>;
  cancelAllOrders: (symbol: string) => Promise<void>;
  cancelOrder: (coin: string, oid: string) => Promise<void>;
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
    const orderStore = useOrderStore.getState();

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`buyCloud_${symbol}`]: true },
      errors: { ...state.errors, [`buyCloud_${symbol}`]: null },
    }));

    const batchTempId = `batch_${Date.now()}`;
    const optimisticOrders: any[] = [];

    try {
      const [accountBalance, metadata] = await Promise.all([
        service.getAccountBalanceCached(),
        service.getMetadataCache(symbol)
      ]);

      const priceLevels: number[] = [];
      for (let i = 1; i <= ORDER_COUNT; i++) {
        const level = currentPrice - (2 * priceInterval * i / ORDER_COUNT);
        priceLevels.push(level);
      }

      const accountValue = parseFloat(accountBalance.accountValue);
      const cloudSize = (accountValue * percentage) / 100;

      const batchOrders = [];
      let totalCoinSize = 0;

      for (const level of priceLevels) {
        const formattedPrice = service.formatPriceCached(level, metadata);
        const coinSize = cloudSize / level;
        const formattedSize = service.formatSizeCached(coinSize, metadata);

        totalCoinSize += coinSize;

        const tempId = `${batchTempId}_limit_${optimisticOrders.length}`;
        optimisticOrders.push({
          oid: tempId,
          coin: symbol,
          side: 'buy',
          price: parseFloat(formattedPrice),
          size: parseFloat(formattedSize),
          orderType: 'limit',
          timestamp: Date.now(),
          isOptimistic: true,
          tempId,
        });

        batchOrders.push({
          a: metadata.coinIndex,
          b: true,
          p: formattedPrice,
          s: formattedSize,
          r: false,
          t: { limit: { tif: 'Gtc' as const } }
        });
      }

      const formattedTotalSize = service.formatSizeCached(totalCoinSize, metadata);
      const stopLossPrice = currentPrice - (8 * priceInterval);
      const formattedStopLoss = service.formatPriceCached(stopLossPrice, metadata);
      const slTempId = `${batchTempId}_sl`;
      optimisticOrders.push({
        oid: slTempId,
        coin: symbol,
        side: 'sell',
        price: parseFloat(formattedStopLoss),
        size: totalCoinSize,
        orderType: 'stop',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: slTempId,
      });

      batchOrders.push({
        a: metadata.coinIndex,
        b: false,
        p: formattedStopLoss,
        s: formattedTotalSize,
        r: true,
        t: { trigger: { triggerPx: formattedStopLoss, isMarket: true, tpsl: 'sl' as const } }
      });

      const takeProfitPrice = currentPrice * (1 + TAKE_PROFIT_PERCENT / 100);
      const formattedTakeProfit = service.formatPriceCached(takeProfitPrice, metadata);
      const tpTempId = `${batchTempId}_tp`;
      optimisticOrders.push({
        oid: tpTempId,
        coin: symbol,
        side: 'sell',
        price: parseFloat(formattedTakeProfit),
        size: totalCoinSize,
        orderType: 'tp',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: tpTempId,
      });

      batchOrders.push({
        a: metadata.coinIndex,
        b: false,
        p: formattedTakeProfit,
        s: formattedTotalSize,
        r: true,
        t: { trigger: { triggerPx: formattedTakeProfit, isMarket: true, tpsl: 'tp' as const } }
      });

      orderStore.addOptimisticOrders(symbol, optimisticOrders);

      const response = await service.placeBatchMixedOrders(batchOrders);

      if (response?.status === 'ok' && response.response?.data?.statuses) {
        response.response.data.statuses.forEach((status: any, index: number) => {
          if (status?.resting?.oid) {
            const tempId = optimisticOrders[index].tempId;
            orderStore.confirmOptimisticOrder(symbol, tempId, status.resting.oid);
          }
        });
      }

      service.invalidateAccountCache();

      toast.success('Buy cloud placed');
    } catch (error) {
      optimisticOrders.forEach(order => {
        orderStore.rollbackOptimisticOrder(symbol, order.tempId);
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Buy cloud failed: ${errorMessage}`);
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
    const orderStore = useOrderStore.getState();

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`sellCloud_${symbol}`]: true },
      errors: { ...state.errors, [`sellCloud_${symbol}`]: null },
    }));

    const batchTempId = `batch_${Date.now()}`;
    const optimisticOrders: any[] = [];

    try {
      const [accountBalance, metadata] = await Promise.all([
        service.getAccountBalanceCached(),
        service.getMetadataCache(symbol)
      ]);

      const priceLevels: number[] = [];
      for (let i = 1; i <= ORDER_COUNT; i++) {
        const level = currentPrice + (2 * priceInterval * i / ORDER_COUNT);
        priceLevels.push(level);
      }

      const accountValue = parseFloat(accountBalance.accountValue);
      const cloudSize = (accountValue * percentage) / 100;

      const batchOrders = [];
      let totalCoinSize = 0;

      for (const level of priceLevels) {
        const formattedPrice = service.formatPriceCached(level, metadata);
        const coinSize = cloudSize / level;
        const formattedSize = service.formatSizeCached(coinSize, metadata);

        totalCoinSize += coinSize;

        const tempId = `${batchTempId}_limit_${optimisticOrders.length}`;
        optimisticOrders.push({
          oid: tempId,
          coin: symbol,
          side: 'sell',
          price: parseFloat(formattedPrice),
          size: parseFloat(formattedSize),
          orderType: 'limit',
          timestamp: Date.now(),
          isOptimistic: true,
          tempId,
        });

        batchOrders.push({
          a: metadata.coinIndex,
          b: false,
          p: formattedPrice,
          s: formattedSize,
          r: false,
          t: { limit: { tif: 'Gtc' as const } }
        });
      }

      const formattedTotalSize = service.formatSizeCached(totalCoinSize, metadata);
      const stopLossPrice = currentPrice + (8 * priceInterval);
      const formattedStopLoss = service.formatPriceCached(stopLossPrice, metadata);
      const slTempId = `${batchTempId}_sl`;
      optimisticOrders.push({
        oid: slTempId,
        coin: symbol,
        side: 'buy',
        price: parseFloat(formattedStopLoss),
        size: totalCoinSize,
        orderType: 'stop',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: slTempId,
      });

      batchOrders.push({
        a: metadata.coinIndex,
        b: true,
        p: formattedStopLoss,
        s: formattedTotalSize,
        r: true,
        t: { trigger: { triggerPx: formattedStopLoss, isMarket: true, tpsl: 'sl' as const } }
      });

      const takeProfitPrice = currentPrice * (1 - TAKE_PROFIT_PERCENT / 100);
      const formattedTakeProfit = service.formatPriceCached(takeProfitPrice, metadata);
      const tpTempId = `${batchTempId}_tp`;
      optimisticOrders.push({
        oid: tpTempId,
        coin: symbol,
        side: 'buy',
        price: parseFloat(formattedTakeProfit),
        size: totalCoinSize,
        orderType: 'tp',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: tpTempId,
      });

      batchOrders.push({
        a: metadata.coinIndex,
        b: true,
        p: formattedTakeProfit,
        s: formattedTotalSize,
        r: true,
        t: { trigger: { triggerPx: formattedTakeProfit, isMarket: true, tpsl: 'tp' as const } }
      });

      orderStore.addOptimisticOrders(symbol, optimisticOrders);

      const response = await service.placeBatchMixedOrders(batchOrders);

      if (response?.status === 'ok' && response.response?.data?.statuses) {
        response.response.data.statuses.forEach((status: any, index: number) => {
          if (status?.resting?.oid) {
            const tempId = optimisticOrders[index].tempId;
            orderStore.confirmOptimisticOrder(symbol, tempId, status.resting.oid);
          }
        });
      }

      service.invalidateAccountCache();

      toast.success('Sell cloud placed');
    } catch (error) {
      optimisticOrders.forEach(order => {
        orderStore.rollbackOptimisticOrder(symbol, order.tempId);
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Sell cloud failed: ${errorMessage}`);
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
    const orderStore = useOrderStore.getState();
    const batchTempId = `batch_${Date.now()}`;
    const optimisticOrders: any[] = [];

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`smLong_${symbol}`]: true },
      errors: { ...state.errors, [`smLong_${symbol}`]: null },
    }));

    try {
      const [accountBalance, metadata] = await Promise.all([
        service.getAccountBalanceCached(),
        service.getMetadataCache(symbol)
      ]);

      const accountValue = parseFloat(accountBalance.accountValue);
      const positionSize = (accountValue * percentage) / 100;

      const coinSize = positionSize / currentPrice;
      const formattedSize = service.formatSizeCached(coinSize, metadata);

      const stopLossPrice = currentPrice - (8 * priceInterval);
      const formattedStopLoss = service.formatPriceCached(stopLossPrice, metadata);
      const slTempId = `${batchTempId}_sl`;
      optimisticOrders.push({
        oid: slTempId,
        coin: symbol,
        side: 'sell',
        price: parseFloat(formattedStopLoss),
        size: parseFloat(formattedSize),
        orderType: 'stop',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: slTempId,
      });

      const takeProfitPrice = currentPrice * (1 + TAKE_PROFIT_PERCENT / 100);
      const formattedTakeProfit = service.formatPriceCached(takeProfitPrice, metadata);
      const tpTempId = `${batchTempId}_tp`;
      optimisticOrders.push({
        oid: tpTempId,
        coin: symbol,
        side: 'sell',
        price: parseFloat(formattedTakeProfit),
        size: parseFloat(formattedSize),
        orderType: 'tp',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: tpTempId,
      });

      orderStore.addOptimisticOrders(symbol, optimisticOrders);

      const [, slResponse, tpResponse] = await Promise.all([
        service.placeMarketBuy(symbol, formattedSize),
        service.placeStopLoss({
          coin: symbol,
          triggerPrice: formattedStopLoss,
          size: formattedSize,
          isBuy: false,
        }),
        service.placeTakeProfit({
          coin: symbol,
          triggerPrice: formattedTakeProfit,
          size: formattedSize,
          isBuy: false,
        })
      ]);

      if (slResponse?.status === 'ok' && slResponse.response?.data?.statuses?.[0]) {
        const status = slResponse.response.data.statuses[0];
        if ('resting' in status && status.resting?.oid) {
          orderStore.confirmOptimisticOrder(symbol, slTempId, String(status.resting.oid));
        }
      }

      if (tpResponse?.status === 'ok' && tpResponse.response?.data?.statuses?.[0]) {
        const status = tpResponse.response.data.statuses[0];
        if ('resting' in status && status.resting?.oid) {
          orderStore.confirmOptimisticOrder(symbol, tpTempId, String(status.resting.oid));
        }
      }

      service.invalidateAccountCache();
      toast.success('Market long placed');
    } catch (error) {
      optimisticOrders.forEach(order => {
        orderStore.rollbackOptimisticOrder(symbol, order.tempId);
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Market long failed: ${errorMessage}`);
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
    const orderStore = useOrderStore.getState();
    const batchTempId = `batch_${Date.now()}`;
    const optimisticOrders: any[] = [];

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

      const stopLossPrice = currentPrice + (8 * priceInterval);
      const formattedStopLoss = await service.formatPrice(stopLossPrice, symbol);
      const slTempId = `${batchTempId}_sl`;
      optimisticOrders.push({
        oid: slTempId,
        coin: symbol,
        side: 'buy',
        price: parseFloat(formattedStopLoss),
        size: parseFloat(formattedSize),
        orderType: 'stop',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: slTempId,
      });

      const takeProfitPrice = currentPrice * (1 - TAKE_PROFIT_PERCENT / 100);
      const formattedTakeProfit = await service.formatPrice(takeProfitPrice, symbol);
      const tpTempId = `${batchTempId}_tp`;
      optimisticOrders.push({
        oid: tpTempId,
        coin: symbol,
        side: 'buy',
        price: parseFloat(formattedTakeProfit),
        size: parseFloat(formattedSize),
        orderType: 'tp',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: tpTempId,
      });

      orderStore.addOptimisticOrders(symbol, optimisticOrders);

      await service.placeMarketSell(symbol, formattedSize);

      const slResponse = await service.placeStopLoss({
        coin: symbol,
        triggerPrice: formattedStopLoss,
        size: formattedSize,
        isBuy: true,
      });

      if (slResponse?.status === 'ok' && slResponse.response?.data?.statuses?.[0]) {
        const status = slResponse.response.data.statuses[0];
        if ('resting' in status && status.resting?.oid) {
          orderStore.confirmOptimisticOrder(symbol, slTempId, String(status.resting.oid));
        }
      }

      const tpResponse = await service.placeTakeProfit({
        coin: symbol,
        triggerPrice: formattedTakeProfit,
        size: formattedSize,
        isBuy: true,
      });

      if (tpResponse?.status === 'ok' && tpResponse.response?.data?.statuses?.[0]) {
        const status = tpResponse.response.data.statuses[0];
        if ('resting' in status && status.resting?.oid) {
          orderStore.confirmOptimisticOrder(symbol, tpTempId, String(status.resting.oid));
        }
      }

      toast.success('Market short placed');
    } catch (error) {
      optimisticOrders.forEach(order => {
        orderStore.rollbackOptimisticOrder(symbol, order.tempId);
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Market short failed: ${errorMessage}`);
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
    const orderStore = useOrderStore.getState();
    const batchTempId = `batch_${Date.now()}`;
    const optimisticOrders: any[] = [];

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

      const stopLossPrice = currentPrice - (8 * priceInterval);
      const formattedStopLoss = await service.formatPrice(stopLossPrice, symbol);
      const slTempId = `${batchTempId}_sl`;
      optimisticOrders.push({
        oid: slTempId,
        coin: symbol,
        side: 'sell',
        price: parseFloat(formattedStopLoss),
        size: parseFloat(formattedSize),
        orderType: 'stop',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: slTempId,
      });

      const takeProfitPrice = currentPrice * (1 + TAKE_PROFIT_PERCENT / 100);
      const formattedTakeProfit = await service.formatPrice(takeProfitPrice, symbol);
      const tpTempId = `${batchTempId}_tp`;
      optimisticOrders.push({
        oid: tpTempId,
        coin: symbol,
        side: 'sell',
        price: parseFloat(formattedTakeProfit),
        size: parseFloat(formattedSize),
        orderType: 'tp',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: tpTempId,
      });

      orderStore.addOptimisticOrders(symbol, optimisticOrders);

      await service.placeMarketBuy(symbol, formattedSize);

      const slResponse = await service.placeStopLoss({
        coin: symbol,
        triggerPrice: formattedStopLoss,
        size: formattedSize,
        isBuy: false,
      });

      if (slResponse?.status === 'ok' && slResponse.response?.data?.statuses?.[0]) {
        const status = slResponse.response.data.statuses[0];
        if ('resting' in status && status.resting?.oid) {
          orderStore.confirmOptimisticOrder(symbol, slTempId, String(status.resting.oid));
        }
      }

      const tpResponse = await service.placeTakeProfit({
        coin: symbol,
        triggerPrice: formattedTakeProfit,
        size: formattedSize,
        isBuy: false,
      });

      if (tpResponse?.status === 'ok' && tpResponse.response?.data?.statuses?.[0]) {
        const status = tpResponse.response.data.statuses[0];
        if ('resting' in status && status.resting?.oid) {
          orderStore.confirmOptimisticOrder(symbol, tpTempId, String(status.resting.oid));
        }
      }

      toast.success('Big long placed');
    } catch (error) {
      optimisticOrders.forEach(order => {
        orderStore.rollbackOptimisticOrder(symbol, order.tempId);
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Big long failed: ${errorMessage}`);
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
    const orderStore = useOrderStore.getState();
    const batchTempId = `batch_${Date.now()}`;
    const optimisticOrders: any[] = [];

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

      const stopLossPrice = currentPrice + (8 * priceInterval);
      const formattedStopLoss = await service.formatPrice(stopLossPrice, symbol);
      const slTempId = `${batchTempId}_sl`;
      optimisticOrders.push({
        oid: slTempId,
        coin: symbol,
        side: 'buy',
        price: parseFloat(formattedStopLoss),
        size: parseFloat(formattedSize),
        orderType: 'stop',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: slTempId,
      });

      const takeProfitPrice = currentPrice * (1 - TAKE_PROFIT_PERCENT / 100);
      const formattedTakeProfit = await service.formatPrice(takeProfitPrice, symbol);
      const tpTempId = `${batchTempId}_tp`;
      optimisticOrders.push({
        oid: tpTempId,
        coin: symbol,
        side: 'buy',
        price: parseFloat(formattedTakeProfit),
        size: parseFloat(formattedSize),
        orderType: 'tp',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: tpTempId,
      });

      orderStore.addOptimisticOrders(symbol, optimisticOrders);

      await service.placeMarketSell(symbol, formattedSize);

      const slResponse = await service.placeStopLoss({
        coin: symbol,
        triggerPrice: formattedStopLoss,
        size: formattedSize,
        isBuy: true,
      });

      if (slResponse?.status === 'ok' && slResponse.response?.data?.statuses?.[0]) {
        const status = slResponse.response.data.statuses[0];
        if ('resting' in status && status.resting?.oid) {
          orderStore.confirmOptimisticOrder(symbol, slTempId, String(status.resting.oid));
        }
      }

      const tpResponse = await service.placeTakeProfit({
        coin: symbol,
        triggerPrice: formattedTakeProfit,
        size: formattedSize,
        isBuy: true,
      });

      if (tpResponse?.status === 'ok' && tpResponse.response?.data?.statuses?.[0]) {
        const status = tpResponse.response.data.statuses[0];
        if ('resting' in status && status.resting?.oid) {
          orderStore.confirmOptimisticOrder(symbol, tpTempId, String(status.resting.oid));
        }
      }

      toast.success('Big short placed');
    } catch (error) {
      optimisticOrders.forEach(order => {
        orderStore.rollbackOptimisticOrder(symbol, order.tempId);
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Big short failed: ${errorMessage}`);
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

  placeLimitOrderAtPrice: async (params: LimitOrderAtPriceParams) => {
    const { service } = get();
    if (!service) {
      console.error('Service not initialized');
      throw new Error('Service not initialized');
    }

    const { symbol, price, isBuy, percentage, currentPrice } = params;

    const useTriggerOrder = (isBuy && price > currentPrice) || (!isBuy && price < currentPrice);
    const orderType = useTriggerOrder ? 'TRIGGER MARKET' : 'LIMIT';

    console.log('[placeLimitOrderAtPrice] Starting:', {
      symbol,
      price,
      currentPrice,
      isBuy,
      percentage,
      orderType,
      reason: isBuy
        ? (price > currentPrice ? 'LONG above current (breakout entry)' : 'LONG below current (pullback entry)')
        : (price < currentPrice ? 'SHORT below current (breakdown entry)' : 'SHORT above current (rally entry)')
    });

    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const orderStore = useOrderStore.getState();

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`limitOrder_${symbol}`]: true },
      errors: { ...state.errors, [`limitOrder_${symbol}`]: null },
    }));

    try {
      const accountBalance = await service.getAccountBalance();
      const accountValue = parseFloat(accountBalance.accountValue);
      const positionSize = (accountValue * percentage) / 100;

      const coinSize = positionSize / price;
      const formattedSize = await service.formatSize(coinSize, symbol);
      const formattedPrice = await service.formatPrice(price, symbol);

      console.log('[placeLimitOrderAtPrice] Calculated values:', {
        accountValue,
        positionSize,
        coinSize,
        formattedSize,
        formattedPrice
      });

      orderStore.addOptimisticOrder(symbol, {
        oid: tempId,
        coin: symbol,
        side: isBuy ? 'buy' : 'sell',
        price: parseFloat(formattedPrice),
        size: parseFloat(formattedSize),
        orderType: useTriggerOrder ? 'trigger' : 'limit',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: tempId,
      });

      let response;
      if (useTriggerOrder) {
        response = await service.placeTriggerMarketOrder({
          coin: symbol,
          triggerPrice: formattedPrice,
          size: formattedSize,
          isBuy,
        });
        console.log('[placeLimitOrderAtPrice] ✅ Trigger market order placed successfully');
      } else {
        response = await service.placeLimitOrder({
          coin: symbol,
          isBuy,
          price: formattedPrice,
          size: formattedSize,
          reduceOnly: false,
        });
        console.log('[placeLimitOrderAtPrice] ✅ Limit order placed successfully');
      }

      if (response && response.status === 'ok' && response.response?.data?.statuses?.[0]) {
        const status = response.response.data.statuses[0];
        if ('resting' in status && status.resting?.oid) {
          const realOid = status.resting.oid;
          orderStore.confirmOptimisticOrder(symbol, tempId, String(realOid));
          toast.success('Order placed');
        } else {
          toast.error('Order placement failed (no OID returned)');
        }
      } else {
        orderStore.rollbackOptimisticOrder(symbol, tempId);
        toast.error('Order placement failed');
      }
    } catch (error) {
      orderStore.rollbackOptimisticOrder(symbol, tempId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[placeLimitOrderAtPrice] ❌ Error:', error);
      toast.error(`Order failed: ${errorMessage}`);
      set((state) => ({
        errors: { ...state.errors, [`limitOrder_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`limitOrder_${symbol}`]: false },
      }));
    }
  },

  placeExitOrderAtPrice: async (params: ExitOrderAtPriceParams) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const { symbol, price, percentage, positionSide, positionSize, currentPrice } = params;

    const isLong = positionSide === 'long';
    const priceAboveCurrent = price > currentPrice;

    const isTakeProfit = (isLong && priceAboveCurrent) || (!isLong && !priceAboveCurrent);
    const orderType = isTakeProfit ? 'tp' : 'stop';
    const tpslType = isTakeProfit ? 'tp' : 'sl';

    console.log('[placeExitOrderAtPrice] Starting:', {
      symbol,
      price,
      currentPrice,
      positionSide,
      percentage,
      orderType: isTakeProfit ? 'TAKE PROFIT' : 'STOP LOSS',
      reason: isLong
        ? (priceAboveCurrent ? 'LONG position, price above (TP)' : 'LONG position, price below (SL)')
        : (priceAboveCurrent ? 'SHORT position, price above (SL)' : 'SHORT position, price below (TP)')
    });

    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const orderStore = useOrderStore.getState();

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`exitOrder_${symbol}`]: true },
      errors: { ...state.errors, [`exitOrder_${symbol}`]: null },
    }));

    try {
      const metadata = await service.getMetadataCache(symbol);

      const sizeToExit = (Math.abs(positionSize) * percentage) / 100;
      const formattedSize = service.formatSizeCached(sizeToExit, metadata);
      const formattedPrice = service.formatPriceCached(price, metadata);

      const isBuy = !isLong;

      orderStore.addOptimisticOrder(symbol, {
        oid: tempId,
        coin: symbol,
        side: isBuy ? 'buy' : 'sell',
        price: parseFloat(formattedPrice),
        size: parseFloat(formattedSize),
        orderType,
        timestamp: Date.now(),
        isOptimistic: true,
        tempId: tempId,
      });

      let response;
      if (isTakeProfit) {
        response = await service.placeTakeProfit({
          coin: symbol,
          triggerPrice: formattedPrice,
          size: formattedSize,
          isBuy,
        });
        console.log('[placeExitOrderAtPrice] ✅ Take profit order placed successfully');
      } else {
        response = await service.placeStopLoss({
          coin: symbol,
          triggerPrice: formattedPrice,
          size: formattedSize,
          isBuy,
        });
        console.log('[placeExitOrderAtPrice] ✅ Stop loss order placed successfully');
      }

      if (response && response.status === 'ok' && response.response?.data?.statuses?.[0]) {
        const status = response.response.data.statuses[0];
        if ('resting' in status && status.resting?.oid) {
          const realOid = status.resting.oid;
          orderStore.confirmOptimisticOrder(symbol, tempId, String(realOid));
          toast.success(`${isTakeProfit ? 'Take profit' : 'Stop loss'} order placed`);
        } else {
          toast.error('Exit order placement failed (no OID returned)');
        }
      } else {
        orderStore.rollbackOptimisticOrder(symbol, tempId);
        toast.error('Exit order placement failed');
      }
    } catch (error) {
      orderStore.rollbackOptimisticOrder(symbol, tempId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[placeExitOrderAtPrice] ❌ Error:', error);
      toast.error(`Exit order failed: ${errorMessage}`);
      set((state) => ({
        errors: { ...state.errors, [`exitOrder_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`exitOrder_${symbol}`]: false },
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
    const orderStore = useOrderStore.getState();

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`moveStopLoss_${coin}`]: true },
      errors: { ...state.errors, [`moveStopLoss_${coin}`]: null },
    }));

    const tempId = `temp_${Date.now()}_sl`;

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

      stopLossOrders.forEach((order: any) => {
        orderStore.markPendingCancellation(coin, order.oid);
      });

      const formattedStopLoss = await service.formatPrice(newStopLossPrice, coin);
      const formattedSize = await service.formatSize(size, coin);

      orderStore.addOptimisticOrder(coin, {
        oid: tempId,
        coin,
        side: side === 'long' ? 'sell' : 'buy',
        price: parseFloat(formattedStopLoss),
        size: size,
        orderType: 'stop',
        timestamp: Date.now(),
        isOptimistic: true,
        tempId,
      });

      if (stopLossOrders.length > 0) {
        for (const slOrder of stopLossOrders) {
          await service.cancelOrder(coin, slOrder.oid);
          orderStore.confirmCancellation(coin, String(slOrder.oid));
        }
      }

      const slResponse = await service.placeStopLoss({
        coin,
        triggerPrice: formattedStopLoss,
        size: formattedSize,
        isBuy: side === 'short',
      });

      if (slResponse?.status === 'ok' && slResponse.response?.data?.statuses?.[0]) {
        const status = slResponse.response.data.statuses[0];
        if ('resting' in status && status.resting?.oid) {
          orderStore.confirmOptimisticOrder(coin, tempId, String(status.resting.oid));
          toast.success('Stop loss moved');
        } else {
          toast.error('Move stop loss failed (no OID returned)');
        }
      } else {
        orderStore.rollbackOptimisticOrder(coin, tempId);
        toast.error('Move stop loss failed');
      }
    } catch (error) {
      orderStore.rollbackOptimisticOrder(coin, tempId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Move stop loss failed: ${errorMessage}`);
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

    const orderStore = useOrderStore.getState();
    const allOrders = orderStore.getAllOrders(symbol);
    const entryOrders = allOrders.filter(order => order.orderType === 'limit' || order.orderType === 'trigger');

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`cancelEntry_${symbol}`]: true },
      errors: { ...state.errors, [`cancelEntry_${symbol}`]: null },
    }));

    entryOrders.forEach(order => {
      if (!order.isOptimistic) {
        orderStore.markPendingCancellation(symbol, order.oid);
      } else if (order.tempId) {
        orderStore.rollbackOptimisticOrder(symbol, order.tempId);
      }
    });

    try {
      await service.cancelEntryOrders(symbol);
      entryOrders.forEach(order => {
        if (!order.isOptimistic) {
          orderStore.confirmCancellation(symbol, order.oid);
        }
      });
      toast.success('Entry orders cancelled');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Cancel failed: ${errorMessage}`);
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

  cancelExitOrders: async (symbol: string) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const orderStore = useOrderStore.getState();
    const allOrders = orderStore.getAllOrders(symbol);
    const exitOrders = allOrders.filter(order => order.orderType === 'stop' || order.orderType === 'tp');

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`cancelExit_${symbol}`]: true },
      errors: { ...state.errors, [`cancelExit_${symbol}`]: null },
    }));

    exitOrders.forEach(order => {
      if (!order.isOptimistic) {
        orderStore.markPendingCancellation(symbol, order.oid);
      } else if (order.tempId) {
        orderStore.rollbackOptimisticOrder(symbol, order.tempId);
      }
    });

    try {
      await service.cancelExitOrders(symbol);
      exitOrders.forEach(order => {
        if (!order.isOptimistic) {
          orderStore.confirmCancellation(symbol, order.oid);
        }
      });
      toast.success('Exit orders cancelled');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Cancel failed: ${errorMessage}`);
      set((state) => ({
        errors: { ...state.errors, [`cancelExit_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`cancelExit_${symbol}`]: false },
      }));
    }
  },

  cancelTPOrders: async (symbol: string) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const orderStore = useOrderStore.getState();
    const positionStore = usePositionStore.getState();
    const position = positionStore.positions[symbol];

    if (!position) {
      toast.error('No position found');
      return;
    }

    const allOrders = orderStore.getAllOrders(symbol);
    const tpOrders = allOrders.filter(order => {
      if (position.side === 'long') {
        return order.side === 'sell' && order.price > position.entryPrice;
      } else {
        return order.side === 'buy' && order.price < position.entryPrice;
      }
    });

    if (tpOrders.length === 0) {
      toast.error('No take profit orders found');
      return;
    }

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`cancelTP_${symbol}`]: true },
      errors: { ...state.errors, [`cancelTP_${symbol}`]: null },
    }));

    tpOrders.forEach(order => {
      if (!order.isOptimistic) {
        orderStore.markPendingCancellation(symbol, order.oid);
      } else if (order.tempId) {
        orderStore.rollbackOptimisticOrder(symbol, order.tempId);
      }
    });

    try {
      await service.cancelTPOrders(symbol);
      tpOrders.forEach(order => {
        if (!order.isOptimistic) {
          orderStore.confirmCancellation(symbol, order.oid);
        }
      });
      toast.success('Take profit orders cancelled');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Cancel failed: ${errorMessage}`);
      set((state) => ({
        errors: { ...state.errors, [`cancelTP_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`cancelTP_${symbol}`]: false },
      }));
    }
  },

  cancelSLOrders: async (symbol: string) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const orderStore = useOrderStore.getState();
    const positionStore = usePositionStore.getState();
    const position = positionStore.positions[symbol];

    if (!position) {
      toast.error('No position found');
      return;
    }

    const allOrders = orderStore.getAllOrders(symbol);
    const slOrders = allOrders.filter(order => {
      if (position.side === 'long') {
        return order.side === 'sell' && order.price < position.entryPrice;
      } else {
        return order.side === 'buy' && order.price > position.entryPrice;
      }
    });

    if (slOrders.length === 0) {
      toast.error('No stop loss orders found');
      return;
    }

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`cancelSL_${symbol}`]: true },
      errors: { ...state.errors, [`cancelSL_${symbol}`]: null },
    }));

    slOrders.forEach(order => {
      if (!order.isOptimistic) {
        orderStore.markPendingCancellation(symbol, order.oid);
      } else if (order.tempId) {
        orderStore.rollbackOptimisticOrder(symbol, order.tempId);
      }
    });

    try {
      await service.cancelSLOrders(symbol);
      slOrders.forEach(order => {
        if (!order.isOptimistic) {
          orderStore.confirmCancellation(symbol, order.oid);
        }
      });
      toast.success('Stop loss orders cancelled');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Cancel failed: ${errorMessage}`);
      set((state) => ({
        errors: { ...state.errors, [`cancelSL_${symbol}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`cancelSL_${symbol}`]: false },
      }));
    }
  },

  cancelAllOrders: async (symbol: string) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const orderStore = useOrderStore.getState();
    const allOrders = orderStore.getAllOrders(symbol);

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`cancelAll_${symbol}`]: true },
      errors: { ...state.errors, [`cancelAll_${symbol}`]: null },
    }));

    allOrders.forEach(order => {
      if (!order.isOptimistic) {
        orderStore.markPendingCancellation(symbol, order.oid);
      } else if (order.tempId) {
        orderStore.rollbackOptimisticOrder(symbol, order.tempId);
      }
    });

    try {
      await service.cancelAllOrders(symbol);
      allOrders.forEach(order => {
        if (!order.isOptimistic) {
          orderStore.confirmCancellation(symbol, order.oid);
        }
      });
      toast.success('All orders cancelled');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Cancel failed: ${errorMessage}`);
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

  cancelOrder: async (coin: string, oid: string) => {
    const { service } = get();
    if (!service) throw new Error('Service not initialized');

    const orderStore = useOrderStore.getState();
    const allOrders = orderStore.getAllOrders(coin);
    const order = allOrders.find(o => o.oid === oid);

    if (!order) {
      throw new Error('Order not found');
    }

    set((state) => ({
      isExecuting: { ...state.isExecuting, [`cancel_${oid}`]: true },
      errors: { ...state.errors, [`cancel_${oid}`]: null },
    }));

    if (!order.isOptimistic) {
      orderStore.markPendingCancellation(coin, oid);
    } else if (order.tempId) {
      orderStore.rollbackOptimisticOrder(coin, order.tempId);
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`cancel_${oid}`]: false },
      }));
      return;
    }

    try {
      await service.cancelOrder(coin, parseInt(oid));
      orderStore.confirmCancellation(coin, oid);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set((state) => ({
        errors: { ...state.errors, [`cancel_${oid}`]: errorMessage },
      }));
      throw error;
    } finally {
      set((state) => ({
        isExecuting: { ...state.isExecuting, [`cancel_${oid}`]: false },
      }));
    }
  },
}));
