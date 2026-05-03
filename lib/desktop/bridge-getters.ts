import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useSidebarPricesStore } from '@/stores/useSidebarPricesStore';
import type {
  BridgeAccountState,
  BridgePositionView,
  BridgeOrderView,
  BridgePriceView,
  BridgeReadyState,
} from './models/bridge-types';

interface CredentialsLike {
  walletAddress: string;
  isTestnet: boolean;
}

interface BridgeRuntime {
  getCredentials: () => CredentialsLike | null;
  getCurrentSymbol: () => string | null;
}

let runtime: BridgeRuntime | null = null;

export function setBridgeRuntime(next: BridgeRuntime): void {
  runtime = next;
}

export function getReadyState(): BridgeReadyState {
  return {
    installedAt: Date.now(),
    storesAvailable: runtime !== null,
  };
}

export function getAccountState(): BridgeAccountState {
  const creds = runtime?.getCredentials() ?? null;
  return {
    walletAddress: creds?.walletAddress ?? null,
    isTestnet: creds?.isTestnet ?? false,
    symbol: runtime?.getCurrentSymbol() ?? null,
    ready: runtime !== null,
  };
}

export function getPositions(): BridgePositionView[] {
  const all = usePositionStore.getState().positions;
  return Object.values(all).filter((p): p is BridgePositionView => p !== null);
}

export function getOpenOrders(coin?: string): BridgeOrderView[] {
  const store = useOrderStore.getState();
  if (coin) {
    return store.getAllOrders(coin);
  }
  const allByCoin = store.orders;
  const optimisticByCoin = store.optimisticOrders;
  const flattened: BridgeOrderView[] = [];
  for (const symbol of Object.keys(allByCoin)) {
    flattened.push(...allByCoin[symbol]);
  }
  for (const symbol of Object.keys(optimisticByCoin)) {
    flattened.push(...optimisticByCoin[symbol]);
  }
  return flattened;
}

export function getLastPrice(coin: string): BridgePriceView {
  const price = useSidebarPricesStore.getState().getPrice(coin);
  return { coin, price };
}
