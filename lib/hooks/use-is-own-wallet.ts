'use client';

import { useCredentials } from '@/lib/context/credentials-context';
import { useAddressFromUrl } from './use-address-from-url';

export function useIsOwnWallet(): boolean {
  const { credentials } = useCredentials();
  const addressFromUrl = useAddressFromUrl();

  if (!credentials || !addressFromUrl) {
    return false;
  }

  return credentials.walletAddress.toLowerCase() === addressFromUrl.toLowerCase();
}
