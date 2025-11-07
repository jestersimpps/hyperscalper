'use client';

import { useParams } from 'next/navigation';

export function useAddressFromUrl(): string | null {
  const params = useParams();
  return (params?.address as string) || null;
}
