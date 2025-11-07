import { useMemo } from 'react';
import { useCredentials } from '@/lib/context/credentials-context';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';

export function useHyperliquidService(): HyperliquidService {
  const { credentials } = useCredentials();

  const service = useMemo(() => {
    if (!credentials) {
      throw new Error('Credentials not configured. Please configure your Hyperliquid credentials in settings.');
    }

    return new HyperliquidService(
      credentials.privateKey,
      credentials.walletAddress,
      credentials.isTestnet
    );
  }, [credentials?.privateKey, credentials?.walletAddress, credentials?.isTestnet]);

  return service;
}
