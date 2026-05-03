'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCredentials } from '@/lib/context/credentials-context';
import { setBridgeRuntime, getReadyState, getAccountState, getPositions, getOpenOrders, getLastPrice } from './bridge-getters';
import { setBridgeActionRuntime, setSymbol, placeOrder, cancelOrder } from './bridge-actions';
import type { BridgeMethodName } from './models/bridge-types';

declare global {
  interface Window {
    __hyperscalper_bridge__?: HyperscalperBridge;
    __IS_DESKTOP__?: boolean;
  }
}

type HyperscalperBridge = {
  call: (method: BridgeMethodName, args?: unknown) => Promise<unknown>;
};

export function DesktopBridge(): null {
  const { credentials } = useCredentials();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.log('[hyperscalper-bridge] installing, IS_DESKTOP=', window.__IS_DESKTOP__);

    setBridgeRuntime({
      getCredentials: () =>
        credentials
          ? { walletAddress: credentials.walletAddress, isTestnet: credentials.isTestnet }
          : null,
      getCurrentSymbol: () => {
        const symbol = params?.symbol;
        return typeof symbol === 'string' ? symbol.toUpperCase() : null;
      },
    });

    setBridgeActionRuntime({
      navigateToSymbol: (symbol: string) => {
        const address = credentials?.walletAddress ?? (params?.address as string | undefined);
        if (!address) return;
        router.push(`/${address}/${symbol.toLowerCase()}`);
      },
    });

    console.log('[hyperscalper-bridge] mounting __hyperscalper_bridge__');
    window.__hyperscalper_bridge__ = {
      call: async (method, args) => {
        switch (method) {
          case 'getReadyState':
            return getReadyState();
          case 'getAccountState':
            return getAccountState();
          case 'getPositions':
            return getPositions();
          case 'getOpenOrders':
            return getOpenOrders((args as { coin?: string } | undefined)?.coin);
          case 'getLastPrice':
            return getLastPrice((args as { coin: string }).coin);
          case 'setSymbol':
            return setSymbol(args as Parameters<typeof setSymbol>[0]);
          case 'placeOrder':
            return placeOrder(args as Parameters<typeof placeOrder>[0]);
          case 'cancelOrder':
            return cancelOrder(args as Parameters<typeof cancelOrder>[0]);
          default:
            throw new Error(`unknown bridge method: ${method}`);
        }
      },
    };
  }, [credentials, router, params]);

  return null;
}
