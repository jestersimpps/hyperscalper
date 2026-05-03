'use client';

import { useParams } from 'next/navigation';
import { useCredentials } from '@/lib/context/credentials-context';

export function useAddressFromUrl(): string | null {
  const params = useParams();
  const { credentials } = useCredentials();
  if (credentials?.walletAddress) return credentials.walletAddress;
  return (params?.address as string) || null;
}
