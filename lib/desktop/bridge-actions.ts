import { useTradingStore } from '@/stores/useTradingStore';
import { useSidebarPricesStore } from '@/stores/useSidebarPricesStore';
import type {
  BridgePlaceOrderParams,
  BridgeCancelOrderParams,
  BridgeSetSymbolParams,
  BridgeError,
} from './models/bridge-types';

interface BridgeActionRuntime {
  navigateToSymbol: (symbol: string) => void;
}

let runtime: BridgeActionRuntime | null = null;

export function setBridgeActionRuntime(next: BridgeActionRuntime): void {
  runtime = next;
}

const MAX_NOTIONAL_USD = 10_000;

function bridgeError(code: BridgeError['code'], message: string): { error: BridgeError } {
  return { error: { code, message } };
}

export async function setSymbol(params: BridgeSetSymbolParams): Promise<{ ok: true } | { error: BridgeError }> {
  if (!params?.symbol || typeof params.symbol !== 'string') {
    return bridgeError('INVALID_ARGS', 'symbol is required');
  }
  if (!runtime) {
    return bridgeError('BRIDGE_NOT_READY', 'navigation runtime not installed');
  }
  runtime.navigateToSymbol(params.symbol);
  return { ok: true };
}

export async function placeOrder(
  params: BridgePlaceOrderParams
): Promise<{ ok: true; oid?: string } | { error: BridgeError }> {
  const validationError = validatePlaceOrder(params);
  if (validationError) return bridgeError('INVALID_ARGS', validationError);

  const service = useTradingStore.getState().service;
  if (!service) return bridgeError('NOT_AUTHENTICATED', 'HyperliquidService not initialized');

  try {
    const metadata = await service.getMetadataCache(params.symbol);
    const refPrice = resolveReferencePrice(params);
    if (refPrice === null) return bridgeError('INVALID_ARGS', 'no reference price available');

    const notional = params.size * refPrice;
    if (notional > MAX_NOTIONAL_USD) {
      return bridgeError(
        'INVALID_ARGS',
        `notional ${notional.toFixed(2)} exceeds bridge ceiling ${MAX_NOTIONAL_USD}`
      );
    }

    const formattedSize = service.formatSizeCached(params.size, metadata);

    if (params.type === 'market') {
      const formattedPrice = service.formatPriceCached(refPrice, metadata);
      const isBuy = params.side === 'buy';
      const response = isBuy
        ? await service.placeMarketBuy(params.symbol, formattedSize, formattedPrice, metadata)
        : await service.placeMarketSell(params.symbol, formattedSize, formattedPrice, metadata);
      return { ok: true, oid: extractOid(response) };
    }

    if (params.type === 'limit') {
      if (typeof params.price !== 'number') {
        return bridgeError('INVALID_ARGS', 'limit order requires price');
      }
      const formattedPrice = service.formatPriceCached(params.price, metadata);
      const response = await service.placeLimitOrder(
        {
          coin: params.symbol,
          isBuy: params.side === 'buy',
          price: formattedPrice,
          size: formattedSize,
          reduceOnly: params.reduceOnly ?? false,
        },
        metadata
      );
      return { ok: true, oid: extractOid(response) };
    }

    return bridgeError('INVALID_ARGS', `unknown order type: ${params.type}`);
  } catch (err) {
    return bridgeError('EXECUTION_FAILED', err instanceof Error ? err.message : 'unknown failure');
  }
}

export async function cancelOrder(
  params: BridgeCancelOrderParams
): Promise<{ ok: true } | { error: BridgeError }> {
  if (!params?.symbol || !params?.oid) {
    return bridgeError('INVALID_ARGS', 'symbol and oid are required');
  }
  const service = useTradingStore.getState().service;
  if (!service) return bridgeError('NOT_AUTHENTICATED', 'HyperliquidService not initialized');

  try {
    const metadata = await service.getMetadataCache(params.symbol);
    await service.cancelOrder(params.symbol, parseInt(params.oid, 10), metadata);
    return { ok: true };
  } catch (err) {
    return bridgeError('EXECUTION_FAILED', err instanceof Error ? err.message : 'unknown failure');
  }
}

function validatePlaceOrder(params: BridgePlaceOrderParams): string | null {
  if (!params?.symbol) return 'symbol required';
  if (params.side !== 'buy' && params.side !== 'sell') return 'side must be buy or sell';
  if (!Number.isFinite(params.size) || params.size <= 0) return 'size must be positive number';
  if (params.type !== 'market' && params.type !== 'limit') return 'type must be market or limit';
  return null;
}

function resolveReferencePrice(params: BridgePlaceOrderParams): number | null {
  if (params.type === 'limit' && typeof params.price === 'number') return params.price;
  return useSidebarPricesStore.getState().getPrice(params.symbol);
}

function extractOid(response: unknown): string | undefined {
  const r = response as { response?: { data?: { statuses?: Array<{ resting?: { oid?: number }; filled?: { oid?: number } }> } } };
  const status = r?.response?.data?.statuses?.[0];
  const oid = status?.resting?.oid ?? status?.filled?.oid;
  return typeof oid === 'number' ? String(oid) : undefined;
}
