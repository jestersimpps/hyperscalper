import {
  PublicClient,
  WalletClient,
  EventClient,
  HttpTransport,
  WebSocketTransport,
  Book,
  Candle,
  WsTrade,
  PerpsClearinghouseState,
  AssetPosition,
  FrontendOrder,
  OrderResponse,
  CancelResponse,
  PerpsMeta,
  AllMids,
  SuccessResponse,
  Fill,
  ApiRequestError
} from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';
import toast from 'react-hot-toast';
import type { UserFill } from '@/types';
import type {
  IHyperliquidService,
  CandleParams,
  TradesParams,
  OrderParams,
  StopLossParams,
  TakeProfitParams,
  TriggerMarketOrderParams,
  LongParams,
  ShortParams,
  ClosePositionParams,
  AccountBalance,
  TransformedCandle,
  MetaAndAssetCtxs,
  BulkCancelResult
} from './types';
import { metadataCache, type SymbolMetadata } from './metadata-cache.service';
import { accountCache } from './account-cache.service';

export class HyperliquidService implements IHyperliquidService {
  public publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private eventClient: EventClient | null = null;
  private isTestnet: boolean;
  private wsTransport: WebSocketTransport | null = null;
  private userAddress: string | null = null;
  private leverageCache: Map<string, number> = new Map();

  constructor(privateKey: string | null, walletAddress: string, isTestnet: boolean = false) {
    this.isTestnet = isTestnet;
    this.userAddress = walletAddress;

    const httpUrl = isTestnet ? 'https://api.hyperliquid-testnet.xyz' : 'https://api.hyperliquid.xyz';
    const httpTransport = new HttpTransport({
      url: httpUrl,
      fetchOptions: {
        keepalive: false
      }
    });

    this.publicClient = new PublicClient({ transport: httpTransport });

    if (privateKey) {
      try {
        const account = privateKeyToAccount(privateKey as `0x${string}`);

        this.walletClient = new WalletClient({
          wallet: account,
          transport: httpTransport,
          isTestnet
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to initialize wallet client:', errorMessage);
        toast.error(`Wallet initialization failed: ${errorMessage}`);
      }
    }
  }

  private initWebSocket() {
    if (!this.wsTransport) {
      const wsUrl = this.isTestnet
        ? 'wss://api.hyperliquid-testnet.xyz/ws'
        : 'wss://api.hyperliquid.xyz/ws';
      this.wsTransport = new WebSocketTransport({ url: wsUrl });
      this.eventClient = new EventClient({ transport: this.wsTransport });
    }
  }

  async getCandles(params: CandleParams): Promise<TransformedCandle[]> {
    const req: any = {
      coin: params.coin,
      interval: params.interval
    };
    if (params.startTime !== undefined) req.startTime = params.startTime;
    if (params.endTime !== undefined) req.endTime = params.endTime;

    const result = await this.publicClient.candleSnapshot(req);

    const transformed: TransformedCandle[] = result.map((candle: Candle) => ({
      time: candle.t,
      open: parseFloat(candle.o),
      high: parseFloat(candle.h),
      low: parseFloat(candle.l),
      close: parseFloat(candle.c),
      volume: parseFloat(candle.v)
    }));

    return transformed;
  }

  async getRecentTrades(params: TradesParams): Promise<WsTrade[]> {
    return await (this.publicClient as any).recentTrades?.({ coin: params.coin }) || [];
  }

  async subscribeToCandles(params: CandleParams, callback: (data: TransformedCandle) => void): Promise<() => void> {
    this.initWebSocket();
    const subscription = await this.eventClient!.candle({ coin: params.coin, interval: params.interval }, (candle: Candle) => {
      const transformed: TransformedCandle = {
        time: candle.t,
        open: parseFloat(candle.o),
        high: parseFloat(candle.h),
        low: parseFloat(candle.l),
        close: parseFloat(candle.c),
        volume: parseFloat(candle.v)
      };
      callback(transformed);
    });
    return () => subscription.unsubscribe();
  }

  async subscribeToTrades(params: TradesParams, callback: (data: WsTrade[]) => void): Promise<() => void> {
    this.initWebSocket();
    const subscription = await this.eventClient!.trades({ coin: params.coin }, callback);
    return () => subscription.unsubscribe();
  }

  async placeMarketBuy(coin: string, size: string, price: string, metadata: SymbolMetadata): Promise<OrderResponse> {
    this.ensureWalletClient();
    if (!price || !metadata) {
      throw new Error('Price and metadata are required parameters');
    }

    const formattedSize = this.formatSizeCached(parseFloat(size), metadata);

    return await this.walletClient!.order({
      orders: [{
        a: metadata.coinIndex,
        b: true,
        p: price,
        s: formattedSize,
        r: false,
        t: { limit: { tif: 'Ioc' } }
      }],
      grouping: 'na'
    });
  }

  async placeMarketSell(coin: string, size: string, price: string, metadata: SymbolMetadata): Promise<OrderResponse> {
    this.ensureWalletClient();
    if (!price || !metadata) {
      throw new Error('Price and metadata are required parameters');
    }

    const formattedSize = this.formatSizeCached(parseFloat(size), metadata);

    return await this.walletClient!.order({
      orders: [{
        a: metadata.coinIndex,
        b: false,
        p: price,
        s: formattedSize,
        r: false,
        t: { limit: { tif: 'Ioc' } }
      }],
      grouping: 'na'
    });
  }

  async placeLimitOrder(params: OrderParams, metadata: SymbolMetadata): Promise<OrderResponse> {
    this.ensureWalletClient();
    if (!metadata) {
      throw new Error('Metadata is a required parameter');
    }

    return await this.walletClient!.order({
      orders: [{
        a: metadata.coinIndex,
        b: params.isBuy,
        p: params.price,
        s: params.size,
        r: params.reduceOnly || false,
        t: { limit: { tif: 'Gtc' } }
      }],
      grouping: 'na'
    });
  }

  async placeBatchLimitOrders(orders: OrderParams[], metadata: SymbolMetadata): Promise<OrderResponse> {
    this.ensureWalletClient();

    if (orders.length === 0) {
      throw new Error('No orders provided for batch placement');
    }

    if (!metadata) {
      throw new Error('Metadata is a required parameter');
    }

    const formattedOrders = orders.map(order => ({
      a: metadata.coinIndex,
      b: order.isBuy,
      p: order.price,
      s: order.size,
      r: order.reduceOnly || false,
      t: { limit: { tif: 'Gtc' as const } }
    }));

    return await this.walletClient!.order({
      orders: formattedOrders,
      grouping: 'na'
    });
  }

  async placeStopLoss(params: StopLossParams, metadata: SymbolMetadata): Promise<OrderResponse> {
    this.ensureWalletClient();
    if (!metadata) {
      throw new Error('Metadata is a required parameter');
    }

    const triggerPrice = this.formatPriceCached(parseFloat(params.triggerPrice), metadata);
    const size = this.formatSizeCached(parseFloat(params.size), metadata);

    return await this.walletClient!.order({
      orders: [{
        a: metadata.coinIndex,
        b: params.isBuy,
        p: triggerPrice,
        s: size,
        r: true,
        t: {
          trigger: {
            triggerPx: triggerPrice,
            isMarket: true,
            tpsl: 'sl'
          }
        }
      }],
      grouping: 'na'
    });
  }

  async placeTakeProfit(params: TakeProfitParams, metadata: SymbolMetadata): Promise<OrderResponse> {
    this.ensureWalletClient();
    if (!metadata) {
      throw new Error('Metadata is a required parameter');
    }

    const triggerPrice = this.formatPriceCached(parseFloat(params.triggerPrice), metadata);
    const size = this.formatSizeCached(parseFloat(params.size), metadata);

    return await this.walletClient!.order({
      orders: [{
        a: metadata.coinIndex,
        b: params.isBuy,
        p: triggerPrice,
        s: size,
        r: true,
        t: {
          trigger: {
            triggerPx: triggerPrice,
            isMarket: true,
            tpsl: 'tp'
          }
        }
      }],
      grouping: 'na'
    });
  }

  async placeTriggerMarketOrder(params: TriggerMarketOrderParams, metadata: SymbolMetadata): Promise<OrderResponse> {
    this.ensureWalletClient();
    if (!metadata) {
      throw new Error('Metadata is a required parameter');
    }

    const triggerPriceNum = parseFloat(params.triggerPrice);
    // Market-at-trigger: when fired, fills at the book price. `p` is HL's
    // required worst-case execution cap, not extra slippage you pay. Wide cap
    // (10%) keeps the order from being rejected if price gapped past trigger.
    const SLIPPAGE_CAP = 0.10;
    const executionPriceNum = params.isBuy
      ? triggerPriceNum * (1 + SLIPPAGE_CAP)
      : triggerPriceNum * (1 - SLIPPAGE_CAP);

    const triggerPrice = this.formatPriceCached(triggerPriceNum, metadata);
    const executionPrice = this.formatPriceCached(executionPriceNum, metadata);
    const size = this.formatSizeCached(parseFloat(params.size), metadata);

    return await this.walletClient!.order({
      orders: [{
        a: metadata.coinIndex,
        b: params.isBuy,
        p: executionPrice,
        s: size,
        r: false,
        t: {
          trigger: {
            triggerPx: triggerPrice,
            isMarket: true,
            tpsl: 'sl'
          }
        }
      }],
      grouping: 'na'
    });
  }

  async placeBatchMixedOrders(orders: Array<{
    a: number;
    b: boolean;
    p: string;
    s: string;
    r: boolean;
    t: { limit: { tif: 'Gtc' | 'Ioc' } } | { trigger: { triggerPx: string; isMarket: boolean; tpsl: 'tp' | 'sl' } };
  }>): Promise<OrderResponse> {
    this.ensureWalletClient();
    return await this.walletClient!.order({
      orders,
      grouping: 'na'
    });
  }

  async getMetadataCache(coin: string) {
    return await metadataCache.getMetadata(coin, this);
  }

  formatPriceCached(price: number, metadata: SymbolMetadata): string {
    return metadataCache.formatPrice(price, metadata);
  }

  formatSizeCached(size: number, metadata: SymbolMetadata): string {
    return metadataCache.formatSize(size, metadata);
  }

  getMinSizeForPrice(price: number, metadata: SymbolMetadata, minNotional: number = 10): string {
    return metadataCache.getMinSizeForPrice(price, metadata, minNotional);
  }

  ensureMinNotional(size: number, price: number, metadata: SymbolMetadata, minNotional: number = 10): { size: string; wasBumped: boolean } {
    return metadataCache.ensureMinNotional(size, price, metadata, minNotional);
  }

  async getAccountBalanceCached(user?: string): Promise<AccountBalance> {
    return await accountCache.getBalance(this, user);
  }

  invalidateAccountCache(): void {
    accountCache.invalidate();
  }

  async getCoinIndex(coin: string): Promise<number> {
    const meta = await this.publicClient.meta();
    const index = meta.universe.findIndex(u => u.name === coin);
    if (index === -1) {
      throw new Error(`Coin ${coin} not found`);
    }
    return index;
  }

  async getAccountState(user?: string): Promise<PerpsClearinghouseState> {
    const address = (user || this.userAddress) as `0x${string}`;
    if (!address) {
      throw new Error('No wallet address available');
    }
    return await this.publicClient.clearinghouseState({ user: address });
  }

  async getOpenPositions(user?: string): Promise<AssetPosition[]> {
    const address = (user || this.userAddress) as `0x${string}`;
    if (!address) {
      throw new Error('No wallet address available');
    }
    const state = await this.publicClient.clearinghouseState({ user: address });
    const openPositions = state.assetPositions.filter(pos => parseFloat(pos.position.szi) !== 0);
    return openPositions;
  }

  async getAccountBalance(user?: string): Promise<AccountBalance> {
    const address = (user || this.userAddress) as `0x${string}`;
    if (!address) {
      throw new Error('No wallet address available');
    }
    const state = await this.publicClient.clearinghouseState({ user: address });
    return {
      withdrawable: state.withdrawable,
      marginUsed: (state as any).marginUsed || '0',
      accountValue: state.marginSummary.accountValue
    };
  }

  async getOpenOrders(user?: string): Promise<FrontendOrder[]> {
    const address = (user || this.userAddress) as `0x${string}`;
    if (!address) {
      throw new Error('No wallet address available');
    }
    return await this.publicClient.frontendOpenOrders({ user: address });
  }

  async getUserFillsByTime(startTime: number, endTime?: number, user?: string): Promise<UserFill[]> {
    const address = (user || this.userAddress) as `0x${string}`;
    if (!address) {
      throw new Error('No wallet address available');
    }

    try {
      const fills = await this.publicClient.userFillsByTime({
        user: address,
        startTime,
        endTime: endTime || undefined
      });

      return fills.map((fill: Fill): UserFill => ({
        coin: fill.coin,
        price: parseFloat(fill.px),
        size: parseFloat(fill.sz),
        side: fill.side === 'B' ? 'buy' : 'sell',
        time: fill.time,
        startPosition: parseFloat(fill.startPosition),
        closedPnl: parseFloat(fill.closedPnl),
        fee: parseFloat(fill.fee),
        oid: fill.oid,
        tid: fill.tid,
        hash: fill.hash,
        crossed: fill.crossed,
        feeToken: fill.feeToken
      }));
    } catch (error) {
      return [];
    }
  }

  async cancelOrder(coin: string, orderId: number, metadata: SymbolMetadata): Promise<CancelResponse> {
    this.ensureWalletClient();
    if (!metadata) {
      throw new Error('Metadata is a required parameter');
    }
    return await this.walletClient!.cancel({
      cancels: [{
        a: metadata.coinIndex,
        o: orderId
      }]
    });
  }

  private emptyBulkCancelResult(): BulkCancelResult {
    return {
      response: { status: 'ok', response: { type: 'cancel', data: { statuses: [] } } } as CancelResponse,
      attemptedOids: [],
    };
  }

  private async submitBulkCancel(
    targetOrders: Array<{ oid: string | number }>,
    metadata: SymbolMetadata
  ): Promise<BulkCancelResult> {
    if (targetOrders.length === 0) {
      return this.emptyBulkCancelResult();
    }

    const attemptedOids = targetOrders.map(o => o.oid.toString());
    const cancels = targetOrders.map(o => ({
      a: metadata.coinIndex,
      o: typeof o.oid === 'number' ? o.oid : parseInt(o.oid as string, 10),
    }));

    // SDK throws ApiRequestError when ANY cancel in the batch fails, even if
    // others succeeded. Recover the per-status array from err.response so the
    // caller can restore only the truly-failed oids instead of rolling back
    // the whole batch.
    try {
      const response = await this.walletClient!.cancel({ cancels });
      return { response, attemptedOids };
    } catch (err) {
      if (err instanceof ApiRequestError && err.response?.status === 'ok') {
        return { response: err.response as CancelResponse, attemptedOids };
      }
      throw err;
    }
  }

  // Cancel a list of oids that the caller has already classified. Avoids
  // a redundant frontendOpenOrders HTTP fetch — the store already polls
  // open orders every ~1s and has them classified client-side.
  async cancelOrdersByOid(metadata: SymbolMetadata, oids: Array<string | number>): Promise<BulkCancelResult> {
    this.ensureWalletClient();
    if (!metadata) {
      throw new Error('Metadata is a required parameter');
    }
    if (oids.length === 0) {
      return this.emptyBulkCancelResult();
    }
    return this.submitBulkCancel(oids.map(o => ({ oid: o })), metadata);
  }

  async openLong(params: LongParams, metadata: SymbolMetadata): Promise<OrderResponse> {
    this.ensureWalletClient();
    if (!params.price || !metadata) {
      throw new Error('Price and metadata are required parameters');
    }

    const formattedSize = this.formatSizeCached(parseFloat(params.size), metadata);

    return await this.walletClient!.order({
      orders: [{
        a: metadata.coinIndex,
        b: true,
        p: params.price,
        s: formattedSize,
        r: false,
        t: { limit: { tif: 'Gtc' } }
      }],
      grouping: 'na'
    });
  }

  async openShort(params: ShortParams, metadata: SymbolMetadata): Promise<OrderResponse> {
    this.ensureWalletClient();
    if (!params.price || !metadata) {
      throw new Error('Price and metadata are required parameters');
    }

    const formattedSize = this.formatSizeCached(parseFloat(params.size), metadata);

    return await this.walletClient!.order({
      orders: [{
        a: metadata.coinIndex,
        b: false,
        p: params.price,
        s: formattedSize,
        r: false,
        t: { limit: { tif: 'Gtc' } }
      }],
      grouping: 'na'
    });
  }

  async setLeverage(coin: string, leverage: number, metadata: SymbolMetadata, isCross: boolean = true): Promise<SuccessResponse | null> {
    this.ensureWalletClient();
    if (!metadata) {
      throw new Error('Metadata is a required parameter');
    }
    // Skip the signed updateLeverage HTTP call when the value is already set.
    // Saves ~80-200ms per order and halves request volume on rapid clicking.
    if (this.leverageCache.get(coin) === leverage) {
      return null;
    }
    try {
      const result = await (this.walletClient as any).updateLeverage({
        asset: metadata.coinIndex,
        isCross,
        leverage
      });
      this.leverageCache.set(coin, leverage);
      return result;
    } catch (error) {
      return null;
    }
  }

  // Seed the leverage cache from a positions snapshot so we skip the very first
  // setLeverage call for any coin where a position already exists.
  seedLeverageFromPositions(positions: AssetPosition[]): void {
    for (const p of positions) {
      const lev = parseFloat((p.position.leverage as any)?.value || '0');
      if (lev > 0) this.leverageCache.set(p.position.coin, lev);
    }
  }

  invalidateLeverageCache(coin?: string): void {
    if (coin) this.leverageCache.delete(coin);
    else this.leverageCache.clear();
  }

  async closePosition(params: ClosePositionParams, price: string, metadata: SymbolMetadata, positionData: AssetPosition): Promise<OrderResponse> {
    this.ensureWalletClient();
    if (!price || !metadata || !positionData) {
      throw new Error('Price, metadata, and positionData are required parameters');
    }

    const size = params.size || Math.abs(parseFloat(positionData.position.szi)).toString();
    const isLong = parseFloat(positionData.position.szi) > 0;

    const formattedSize = this.formatSizeCached(parseFloat(size), metadata);

    return await this.walletClient!.order({
      orders: [{
        a: metadata.coinIndex,
        b: !isLong,
        p: price,
        s: formattedSize,
        r: true,
        t: { limit: { tif: 'Ioc' } }
      }],
      grouping: 'na'
    });
  }

  async getMeta(): Promise<PerpsMeta> {
    return await this.publicClient.meta();
  }

  async getAllMids(): Promise<AllMids> {
    return await this.publicClient.allMids();
  }

  async getMetaAndAssetCtxs(): Promise<MetaAndAssetCtxs> {
    const url = this.isTestnet
      ? 'https://api.hyperliquid-testnet.xyz/info'
      : 'https://api.hyperliquid.xyz/info';

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch metaAndAssetCtxs: ${response.statusText}`);
    }

    const [meta, assetCtxs] = await response.json();
    return { meta, assetCtxs };
  }

  private ensureWalletClient(): void {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized. Trading operations require valid credentials.');
    }
  }
}
