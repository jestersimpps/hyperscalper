import { PublicClient, WalletClient, EventClient, HttpTransport, WebSocketTransport, Book, Candle, WsTrade } from '@nktkas/hyperliquid';
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
  AccountBalance
} from './types';

export class HyperliquidService implements IHyperliquidService {
  private static instance: HyperliquidService | null = null;

  public publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private eventClient: EventClient | null = null;
  private isTestnet: boolean;
  private wsTransport: WebSocketTransport | null = null;
  private userAddress: string | null = null;

  private constructor(privateKey?: string, walletAddress?: string, isTestnet: boolean = false) {
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
        console.warn('[HyperliquidService] Failed to initialize wallet client:', error);
      }
    }
  }

  public static getInstance(privateKey?: string, walletAddress?: string, isTestnet: boolean = false): HyperliquidService {
    if (!HyperliquidService.instance) {
      HyperliquidService.instance = new HyperliquidService(privateKey, walletAddress, isTestnet);
    }
    return HyperliquidService.instance;
  }

  public static resetInstance(): void {
    HyperliquidService.instance = null;
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

  async getCandles(params: CandleParams): Promise<Candle[]> {
    const req: any = {
      coin: params.coin,
      interval: params.interval
    };
    if (params.startTime !== undefined) req.startTime = params.startTime;
    if (params.endTime !== undefined) req.endTime = params.endTime;

    return await this.publicClient.candleSnapshot(req);
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
    return this.eventClient!.l2Book({
      coin: params.coin,
      nSigFigs: params.nSigFigs,
      mantissa: params.mantissa
    }, callback);
  }

  async subscribeToCandles(params: CandleParams, callback: (data: Candle) => void): Promise<() => void> {
    this.initWebSocket();
    return this.eventClient!.candle({ coin: params.coin, interval: params.interval }, callback);
  }

  async subscribeToTrades(params: TradesParams, callback: (data: WsTrade[]) => void): Promise<() => void> {
    this.initWebSocket();
    return this.eventClient!.trades({ coin: params.coin }, callback);
  }

  async placeMarketBuy(coin: string, size: string): Promise<any> {
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

  async placeMarketSell(coin: string, size: string): Promise<any> {
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

  async placeLimitOrder(params: OrderParams): Promise<any> {
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

  async placeBatchLimitOrders(orders: OrderParams[]): Promise<any> {
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
      t: { limit: { tif: 'Gtc' } }
    }));

    return await this.walletClient!.order({
      orders: formattedOrders,
      grouping: 'na'
    });
  }

  async placeStopLoss(params: StopLossParams): Promise<any> {
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

  async placeTakeProfit(params: TakeProfitParams): Promise<any> {
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

  async getAccountState(user?: string): Promise<any> {
    const address = (user || this.userAddress) as `0x${string}`;
    if (!address) {
      throw new Error('No wallet address available');
    }
    return await this.publicClient.clearinghouseState({ user: address });
  }

  async getOpenPositions(user?: string): Promise<any[]> {
    const address = (user || this.userAddress) as `0x${string}`;
    if (!address) {
      throw new Error('No wallet address available');
    }
    console.log(`[getOpenPositions] Fetching positions for address: ${address}`);
    const state = await this.publicClient.clearinghouseState({ user: address });
    console.log(`[getOpenPositions] Total asset positions: ${state.assetPositions.length}`);
    console.log(`[getOpenPositions] All asset positions:`, state.assetPositions.map(p => ({
      coin: p.position.coin,
      szi: p.position.szi
    })));
    const openPositions = state.assetPositions.filter(pos => parseFloat(pos.position.szi) !== 0);
    console.log(`[getOpenPositions] Open positions (szi !== 0): ${openPositions.length}`);
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

  async getOpenOrders(user?: string): Promise<any[]> {
    const address = (user || this.userAddress) as `0x${string}`;
    if (!address) {
      throw new Error('No wallet address available');
    }
    const orders = await this.publicClient.frontendOpenOrders({ user: address });
    console.log('[getOpenOrders] Raw frontendOpenOrders response:', JSON.stringify(orders, null, 2));
    return orders;
  }

  async cancelOrder(coin: string, orderId: number): Promise<any> {
    this.ensureWalletClient();
    const coinIndex = await this.getCoinIndex(coin);
    return await this.walletClient!.cancel({
      cancels: [{
        a: coinIndex,
        o: orderId
      }]
    });
  }

  async cancelAllOrders(coin: string): Promise<any> {
    this.ensureWalletClient();
    const orders = await this.getOpenOrders();
    const coinOrders = orders.filter(order => order.coin === coin);

    if (coinOrders.length === 0) {
      return { status: 'ok', response: { type: 'default', data: { statuses: [] } } };
    }

    const coinIndex = await this.getCoinIndex(coin);
    const cancels = coinOrders.map(order => ({
      a: coinIndex,
      o: order.oid
    }));

    return await this.walletClient!.cancel({ cancels });
  }

  async cancelEntryOrders(coin: string): Promise<any> {
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

    console.log(`[cancelEntryOrders] Total orders: ${coinOrders.length}, Entry orders: ${entryOrders.length}, TP/SL orders: ${coinOrders.length - entryOrders.length}`);

    if (entryOrders.length === 0) {
      return { status: 'ok', response: { type: 'default', data: { statuses: [] } } };
    }

    const coinIndex = await this.getCoinIndex(coin);
    const cancels = entryOrders.map(order => ({
      a: coinIndex,
      o: order.oid
    }));

    return await this.walletClient!.cancel({ cancels });
  }

  async openLong(params: LongParams): Promise<any> {
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

  async openShort(params: ShortParams): Promise<any> {
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

  async setLeverage(coin: string, leverage: number, isCross: boolean = true): Promise<any> {
    this.ensureWalletClient();
    try {
      return await (this.walletClient as any).updateLeverage({
        asset: await this.getCoinIndex(coin),
        isCross,
        leverage
      });
    } catch (error) {
      console.warn(`[HyperliquidService] Could not set leverage for ${coin}:`, (error as Error).message);
      return null;
    }
  }

  async closePosition(params: ClosePositionParams): Promise<any> {
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

  async getMeta(): Promise<any> {
    return await this.publicClient.meta();
  }

  async getAllMids(): Promise<any> {
    return await this.publicClient.allMids();
  }

  private ensureWalletClient(): void {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized. Trading operations require HYPERLIQUID_PRIVATE_KEY environment variable.');
    }
  }
}

export const getHyperliquidService = (): HyperliquidService => {
  const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
  const walletAddress = process.env.HYPERLIQUID_WALLET_ADDRESS;
  const isTestnet = process.env.HYPERLIQUID_TESTNET === 'true';

  return HyperliquidService.getInstance(privateKey, walletAddress, isTestnet);
};
