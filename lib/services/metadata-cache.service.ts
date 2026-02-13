import type { HyperliquidService } from './hyperliquid.service';

export interface SymbolMetadata {
  coinIndex: number;
  tickSize: number;
  sizeDecimals: number;
  timestamp: number;
}

export class MetadataCache {
  private static instance: MetadataCache;
  private cache: Map<string, SymbolMetadata> = new Map();
  private readonly TTL = 60000;

  private constructor() {}

  static getInstance(): MetadataCache {
    if (!MetadataCache.instance) {
      MetadataCache.instance = new MetadataCache();
    }
    return MetadataCache.instance;
  }

  async getMetadata(coin: string, service: HyperliquidService): Promise<SymbolMetadata> {
    const cached = this.cache.get(coin);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached;
    }

    const [meta, book] = await Promise.all([
      service.publicClient.meta(),
      service.publicClient.l2Book({ coin })
    ]);

    const coinIndex = meta.universe.findIndex(u => u.name === coin);
    if (coinIndex === -1) {
      throw new Error(`Coin ${coin} not found`);
    }

    const asset = meta.universe[coinIndex];
    const tickSize = this.calculateTickSize(book);

    const metadata: SymbolMetadata = {
      coinIndex,
      tickSize,
      sizeDecimals: asset.szDecimals,
      timestamp: Date.now()
    };

    this.cache.set(coin, metadata);
    return metadata;
  }

  private calculateTickSize(book: any): number {
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

  formatPrice(price: number, metadata: SymbolMetadata): string {
    const rounded = Math.round(price / metadata.tickSize) * metadata.tickSize;
    const decimals = this.getDecimalsFromTickSize(metadata.tickSize);
    return parseFloat(rounded.toFixed(decimals)).toFixed(decimals);
  }

  formatSize(size: number, metadata: SymbolMetadata): string {
    const minSize = Math.pow(10, -metadata.sizeDecimals);
    const clampedSize = Math.max(size, minSize);
    return clampedSize.toFixed(metadata.sizeDecimals);
  }

  /**
   * Check if an order size meets the minimum notional value ($10 on Hyperliquid).
   * Returns the minimum coin size needed at the given price, or the formatted size if it already meets the requirement.
   */
  getMinSizeForPrice(price: number, metadata: SymbolMetadata, minNotional: number = 10): string {
    const minCoinSize = minNotional / price;
    const minLot = Math.pow(10, -metadata.sizeDecimals);
    const size = Math.max(minCoinSize, minLot);
    // Round up to nearest lot to ensure we meet the minimum
    const rounded = Math.ceil(size / minLot) * minLot;
    return rounded.toFixed(metadata.sizeDecimals);
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

  invalidate(coin: string): void {
    this.cache.delete(coin);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const metadataCache = MetadataCache.getInstance();
