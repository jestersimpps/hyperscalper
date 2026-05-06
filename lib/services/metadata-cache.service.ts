import type { HyperliquidService } from './hyperliquid.service';

const MAX_PRICE_DECIMALS_PERP = 6;
const MAX_PRICE_SIG_FIGS = 5;

export interface SymbolMetadata {
  coinIndex: number;
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

    const meta = await service.publicClient.meta();
    const coinIndex = meta.universe.findIndex(u => u.name === coin);
    if (coinIndex === -1) {
      throw new Error(`Coin ${coin} not found`);
    }

    const metadata: SymbolMetadata = {
      coinIndex,
      sizeDecimals: meta.universe[coinIndex].szDecimals,
      timestamp: Date.now()
    };

    this.cache.set(coin, metadata);
    return metadata;
  }

  // HL price rule: ≤ 5 significant figures AND ≤ (MAX_DECIMALS - szDecimals)
  // decimal places. The orderbook-spacing approach previously used here was
  // wrong on ~96 perps (the gap between bid[0] and bid[1] is the spread, not
  // the tick), causing prices to silently snap to a coarser grid than HL
  // actually requires.
  formatPrice(price: number, metadata: SymbolMetadata): string {
    if (price <= 0) return '0';
    const maxDecimals = Math.max(0, MAX_PRICE_DECIMALS_PERP - metadata.sizeDecimals);
    const intDigits = Math.floor(Math.log10(price)) + 1;
    const sigFigDecimals = Math.max(0, MAX_PRICE_SIG_FIGS - intDigits);
    const decimals = Math.min(maxDecimals, sigFigDecimals);
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(price * factor) / factor;
    return rounded.toFixed(decimals);
  }

  formatSize(size: number, metadata: SymbolMetadata): string {
    const minSize = Math.pow(10, -metadata.sizeDecimals);
    const clampedSize = Math.max(size, minSize);
    return clampedSize.toFixed(metadata.sizeDecimals);
  }

  ensureMinNotional(size: number, price: number, metadata: SymbolMetadata, minNotional: number = 10): { size: string; wasBumped: boolean } {
    const formatted = this.formatSize(size, metadata);
    const notional = parseFloat(formatted) * price;
    if (notional >= minNotional) {
      return { size: formatted, wasBumped: false };
    }
    const minSize = this.getMinSizeForPrice(price, metadata, minNotional);
    return { size: minSize, wasBumped: true };
  }

  getMinSizeForPrice(price: number, metadata: SymbolMetadata, minNotional: number = 10): string {
    const minCoinSize = minNotional / price;
    const minLot = Math.pow(10, -metadata.sizeDecimals);
    const size = Math.max(minCoinSize, minLot);
    const rounded = Math.ceil(size / minLot) * minLot;
    return rounded.toFixed(metadata.sizeDecimals);
  }

  invalidate(coin: string): void {
    this.cache.delete(coin);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const metadataCache = MetadataCache.getInstance();
