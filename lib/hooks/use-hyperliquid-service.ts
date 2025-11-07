import { useMemo } from 'react';
import { useCredentials } from '@/lib/context/credentials-context';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';

export function useHyperliquidService(): HyperliquidService {
  const { credentials } = useCredentials();

  const service = useMemo(() => {
    console.log('[useHyperliquidService] Creating service with credentials:', {
      hasCredentials: !!credentials,
      isTestnet: credentials?.isTestnet
    });

    if (!credentials) {
      throw new Error('Credentials not configured. Please configure your Hyperliquid credentials in settings.');
    }

    const svc = new HyperliquidService(
      credentials.privateKey,
      credentials.walletAddress,
      credentials.isTestnet
    );

    console.log('[useHyperliquidService] Service created successfully');

    return svc;
  }, [credentials?.privateKey, credentials?.walletAddress, credentials?.isTestnet]);

  return service;
}
