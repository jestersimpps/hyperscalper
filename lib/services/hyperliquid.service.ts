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
  SuccessResponse
} from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';
import type {
  IHyperliquidService,
  CandleParams,
  OrderBookParams,
  TradesParams,
  OrderParams,
  StopLossParams,
  TakeProfitParams,
  LongParams,
  ShortParams,
  ClosePositionParams,
  AccountBalance,
  TransformedCandle,
  MetaAndAssetCtxs
} from './types';

export class HyperliquidService implements IHyperliquidService {
  public publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private eventClient: EventClient | null = null;
  private isTestnet: boolean;
  private wsTransport: WebSocketTransport | null = null;
  private userAddress: string | null = null;

  constructor(privateKey: string, walletAddress: string, isTestnet: boolean = false) {
    this.isTestnet = isTestnet;

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
        this.userAddress = walletAddress || account.address;

        this.walletClient = new WalletClient({
          wallet: account,
          transport: httpTransport,
          isTestnet
        });
      } catch (error) {
        throw new Error(`Failed to initialize wallet client: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  async getOrderBook(params: OrderBookParams): Promise<Book> {
    return await this.publicClient.l2Book({
      coin: params.coin,
      nSigFigs: params.nSigFigs,
      mantissa: params.mantissa
    });
  }

  async getRecentTrades(params: TradesParams): Promise<any[]> {
    return await (this.publicClient as any).recentTrades?.({ coin: params.coin }) || [];
  }

  async subscribeToOrderBook(params: OrderBookParams, callback: (data: Book) => void): Promise<() => void> {
    this.initWebSocket();
    const subscription = await this.eventClient!.l2Book({
      coin: params.coin,
      nSigFigs: params.nSigFigs,
      mantissa: params.mantissa
    }, callback);
    return () => subscription.unsubscribe();
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

  async placeMarketBuy(coin: string, size: string): Promise<OrderResponse> {
    this.ensureWalletClient();
    return await this.walletClient!.order({
      orders: [{
        a: await this.getCoinIndex(coin),
        b: true,
        p: await this.getMarketPrice(coin, true),
        s: size,
        r: false,
        t: { limit: { tif: 'Ioc' } }
      }],
      grouping: 'na'
    });
  }

  async placeMarketSell(coin: string, size: string): Promise<OrderResponse> {
    this.ensureWalletClient();
    return await this.walletClient!.order({
      orders: [{
        a: await this.getCoinIndex(coin),
        b: false,
        p: await this.getMarketPrice(coin, false),
        s: size,
        r: false,
        t: { limit: { tif: 'Ioc' } }
      }],
      grouping: 'na'
    });
  }

  async placeLimitOrder(params: OrderParams): Promise<OrderResponse> {
    this.ensureWalletClient();
    return await this.walletClient!.order({
      orders: [{
        a: await this.getCoinIndex(params.coin),
        b: params.isBuy,
        p: params.price,
        s: params.size,
        r: params.reduceOnly || false,
        t: { limit: { tif: 'Gtc' } }
      }],
      grouping: 'na'
    });
  }

  async placeBatchLimitOrders(orders: OrderParams[]): Promise<OrderResponse> {
    this.ensureWalletClient();

    if (orders.length === 0) {
      throw new Error('No orders provided for batch placement');
    }

    const coinIndex = await this.getCoinIndex(orders[0].coin);

    const formattedOrders = orders.map(order => ({
      a: coinIndex,
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

  async placeStopLoss(params: StopLossParams): Promise<OrderResponse> {
    this.ensureWalletClient();
    const triggerPrice = await this.formatPrice(parseFloat(params.triggerPrice), params.coin);
    const size = await this.formatSize(parseFloat(params.size), params.coin);
    return await this.walletClient!.order({
      orders: [{
        a: await this.getCoinIndex(params.coin),
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

  async placeTakeProfit(params: TakeProfitParams): Promise<OrderResponse> {
    this.ensureWalletClient();
    const triggerPrice = await this.formatPrice(parseFloat(params.triggerPrice), params.coin);
    const size = await this.formatSize(parseFloat(params.size), params.coin);
    return await this.walletClient!.order({
      orders: [{
        a: await this.getCoinIndex(params.coin),
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

  async getCoinIndex(coin: string): Promise<number> {
    const meta = await this.publicClient.meta();
    const index = meta.universe.findIndex(u => u.name === coin);
    if (index === -1) {
      throw new Error(`Coin ${coin} not found`);
    }
    return index;
  }

  private async getSizeDecimals(coin: string): Promise<number> {
    const meta = await this.publicClient.meta();
    const asset = meta.universe.find(u => u.name === coin);
    if (!asset) {
      throw new Error(`Coin ${coin} not found`);
    }
    return asset.szDecimals;
  }

  private async getTickSize(coin: string): Promise<number> {
    const book = await this.publicClient.l2Book({ coin });
    const bids = book.levels[0];

    if (!bids || bids.length < 2) {
      return 0.01;
    }

    const price1 = parseFloat(bids[0].px);
    const price2 = parseFloat(bids[1].px);
    let diff = Math.abs(price1 - price2);

    if (diff === 0 && bids.length >= 3) {
      const price3 = parseFloat(bids[2].px);
      diff = Math.abs(price1 - price3);
    }

    if (diff === 0) return 0.01;

    const isCloseTo = (value: number, target: number): boolean => {
      return Math.abs(value - target) < target * 0.1;
    };

    if (diff >= 10 || isCloseTo(diff, 10)) return 10;
    if (diff >= 5 || isCloseTo(diff, 5)) return 5;
    if (diff >= 1 || isCloseTo(diff, 1)) return 1;
    if (diff >= 0.5 || isCloseTo(diff, 0.5)) return 0.5;
    if (diff >= 0.1 || isCloseTo(diff, 0.1)) return 0.1;
    if (diff >= 0.05 || isCloseTo(diff, 0.05)) return 0.05;
    if (diff >= 0.01 || isCloseTo(diff, 0.01)) return 0.01;
    if (diff >= 0.005 || isCloseTo(diff, 0.005)) return 0.005;
    if (diff >= 0.001 || isCloseTo(diff, 0.001)) return 0.001;
    if (diff >= 0.0005 || isCloseTo(diff, 0.0005)) return 0.0005;
    if (diff >= 0.0001 || isCloseTo(diff, 0.0001)) return 0.0001;
    if (diff >= 0.00005 || isCloseTo(diff, 0.00005)) return 0.00005;
    if (diff >= 0.00001 || isCloseTo(diff, 0.00001)) return 0.00001;

    return 0.00001;
  }

  private roundToTickSize(price: number, tickSize: number): number {
    const rounded = Math.round(price / tickSize) * tickSize;
    const decimals = this.getDecimalsFromTickSize(tickSize);
    return parseFloat(rounded.toFixed(decimals));
  }

  private getDecimalsFromTickSize(tickSize: number): number {
    if (tickSize >= 1) return 0;
    if (tickSize >= 0.1) return 1;
    if (tickSize >= 0.01) return 2;
    if (tickSize >= 0.001) return 3;
    if (tickSize >= 0.0001) return 4;
    if (tickSize >= 0.00001) return 5;
    return 6;
  }

  async formatPrice(price: number, coin: string): Promise<string> {
    const tickSize = await this.getTickSize(coin);
    const rounded = this.roundToTickSize(price, tickSize);
    const decimals = this.getDecimalsFromTickSize(tickSize);
    return rounded.toFixed(decimals);
  }

  async formatSize(size: number, coin: string): Promise<string> {
    const decimals = await this.getSizeDecimals(coin);
    return size.toFixed(decimals);
  }

  private async getMarketPrice(coin: string, isBuy: boolean): Promise<string> {
    const book = await this.publicClient.l2Book({ coin });
    const levels = isBuy ? book.levels[1] : book.levels[0];
    if (!levels || levels.length === 0) {
      throw new Error(`No market price available for ${coin}`);
    }
    const price = parseFloat(levels[0].px);
    const slippage = isBuy ? 1.005 : 0.995;
    return await this.formatPrice(price * slippage, coin);
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
    const orders = await this.publicClient.frontendOpenOrders({ user: address });
    return orders;
  }

  async cancelOrder(coin: string, orderId: number): Promise<CancelResponse> {
    this.ensureWalletClient();
    const coinIndex = await this.getCoinIndex(coin);
    return await this.walletClient!.cancel({
      cancels: [{
        a: coinIndex,
        o: orderId
      }]
    });
  }

  async cancelAllOrders(coin: string): Promise<CancelResponse> {
    this.ensureWalletClient();
    const orders = await this.getOpenOrders();
    const coinOrders = orders.filter(order => order.coin === coin);

    if (coinOrders.length === 0) {
      return { status: 'ok', response: { type: 'cancel', data: { statuses: [] } } } as CancelResponse;
    }

    const coinIndex = await this.getCoinIndex(coin);
    const cancels = coinOrders.map(order => ({
      a: coinIndex,
      o: order.oid
    }));

    return await this.walletClient!.cancel({ cancels });
  }

  async cancelEntryOrders(coin: string): Promise<CancelResponse> {
    this.ensureWalletClient();
    const orders = await this.getOpenOrders();
    const coinOrders = orders.filter(order => order.coin === coin);

    const entryOrders = coinOrders.filter(order => {
      if (order.isPositionTpsl) return false;

      const ot = order.orderType?.toLowerCase() || '';
      if (ot.includes('stop')) return false;
      if (ot.includes('tp')) return false;

      if (order.isTrigger && order.reduceOnly) {
        const triggerType = ot || '';
        if (triggerType.includes('market')) return false;
      }

      return true;
    });

    if (entryOrders.length === 0) {
      return { status: 'ok', response: { type: 'cancel', data: { statuses: [] } } } as CancelResponse;
    }

    const coinIndex = await this.getCoinIndex(coin);
    const cancels = entryOrders.map(order => ({
      a: coinIndex,
      o: order.oid
    }));

    return await this.walletClient!.cancel({ cancels });
  }

  async openLong(params: LongParams): Promise<OrderResponse> {
    this.ensureWalletClient();
    const price = params.price || await this.getMarketPrice(params.coin, true);
    const size = await this.formatSize(parseFloat(params.size), params.coin);

    return await this.walletClient!.order({
      orders: [{
        a: await this.getCoinIndex(params.coin),
        b: true,
        p: price,
        s: size,
        r: false,
        t: params.price ? { limit: { tif: 'Gtc' } } : { limit: { tif: 'Ioc' } }
      }],
      grouping: 'na'
    });
  }

  async openShort(params: ShortParams): Promise<OrderResponse> {
    this.ensureWalletClient();
    const price = params.price || await this.getMarketPrice(params.coin, false);
    const size = await this.formatSize(parseFloat(params.size), params.coin);

    return await this.walletClient!.order({
      orders: [{
        a: await this.getCoinIndex(params.coin),
        b: false,
        p: price,
        s: size,
        r: false,
        t: params.price ? { limit: { tif: 'Gtc' } } : { limit: { tif: 'Ioc' } }
      }],
      grouping: 'na'
    });
  }

  async setLeverage(coin: string, leverage: number, isCross: boolean = true): Promise<SuccessResponse | null> {
    this.ensureWalletClient();
    try {
      return await (this.walletClient as any).updateLeverage({
        asset: await this.getCoinIndex(coin),
        isCross,
        leverage
      });
    } catch (error) {
      return null;
    }
  }

  async closePosition(params: ClosePositionParams): Promise<OrderResponse> {
    this.ensureWalletClient();
    const positions = await this.getOpenPositions();
    const position = positions.find(p => p.position.coin === params.coin);

    if (!position) {
      throw new Error(`No open position for ${params.coin}`);
    }

    const size = params.size || Math.abs(parseFloat(position.position.szi)).toString();
    const isLong = parseFloat(position.position.szi) > 0;

    const book = await this.publicClient.l2Book({ coin: params.coin });
    const bids = book.levels[0];
    const asks = book.levels[1];

    if (bids.length === 0 || asks.length === 0) {
      throw new Error(`No liquidity available for ${params.coin}`);
    }

    const topBid = parseFloat(bids[0].px);
    const topAsk = parseFloat(asks[0].px);
    const slippage = 0.005;

    const price = isLong
      ? await this.formatPrice(topBid * (1 - slippage), params.coin)
      : await this.formatPrice(topAsk * (1 + slippage), params.coin);

    const formattedSize = await this.formatSize(parseFloat(size), params.coin);

    return await this.walletClient!.order({
      orders: [{
        a: await this.getCoinIndex(params.coin),
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
