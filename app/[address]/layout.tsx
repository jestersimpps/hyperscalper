'use client';

import { use, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import Sidepanel from '@/components/layout/Sidepanel';

interface AddressLayoutProps {
  children: ReactNode;
  params: Promise<{ address: string }>;
}

export default function AddressLayout({ children, params }: AddressLayoutProps) {
  const { address } = use(params);
  const pathname = usePathname();

  // Extract symbol from pathname - handles routes like:
  // /{address}/{symbol} -> symbol
  // /{address}/trades -> TRADES (won't match any symbol)
  // /{address}/chart-popup/{symbol} -> symbol
  const pathSegments = pathname.split('/').filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];
  const selectedSymbol = lastSegment?.toUpperCase() || '';

  console.log('[AddressLayout] pathname:', pathname, 'selectedSymbol:', selectedSymbol);

  return (
    <AppShell sidepanel={<Sidepanel selectedSymbol={selectedSymbol} />}>
      {children}
    </AppShell>
  );
}
