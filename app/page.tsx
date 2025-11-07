'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCredentials } from '@/lib/context/credentials-context';

export default function Home() {
  const router = useRouter();
  const { credentials } = useCredentials();

  useEffect(() => {
    if (credentials?.walletAddress) {
      router.replace(`/${credentials.walletAddress}/trades`);
    }
  }, [router, credentials?.walletAddress]);

  return null;
}
