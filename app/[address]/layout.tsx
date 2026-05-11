'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';

interface AddressLayoutProps {
  children: ReactNode;
}

export default function AddressLayout({ children }: AddressLayoutProps) {
  const pathname = usePathname();

  const isChartPopup = pathname.includes('/chart-popup/');

  if (isChartPopup) {
    return <>{children}</>;
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];
  const selectedSymbol = lastSegment?.toUpperCase() || '';

  console.log('[AddressLayout] pathname:', pathname, 'selectedSymbol:', selectedSymbol);

  return (
    <AppShell selectedSymbol={selectedSymbol}>
      {children}
    </AppShell>
  );
}
