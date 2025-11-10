import { useMemo } from 'react';
import { useCredentials } from '@/lib/context/credentials-context';
import { HyperliquidService } from '@/lib/services/hyperliquid.service';

export function useHyperliquidService(walletAddress?: string): HyperliquidService | null {
  const { credentials } = useCredentials();

  const service = useMemo(() => {
    if (!credentials && !walletAddress) {
      return null;
    }

    if (!credentials && walletAddress) {
      return new HyperliquidService(null, walletAddress, false);
    }

    const addressToUse = walletAddress || credentials!.walletAddress;
    const isOwnWallet = addressToUse.toLowerCase() === credentials!.walletAddress.toLowerCase();

    return new HyperliquidService(
      isOwnWallet ? credentials!.privateKey : null,
      addressToUse,
      credentials!.isTestnet
    );
  }, [credentials?.privateKey, credentials?.walletAddress, credentials?.isTestnet, walletAddress]);

  return service;
}
