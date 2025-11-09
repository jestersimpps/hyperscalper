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

  const selectedSymbol = pathname.split('/').pop()?.toUpperCase() || '';

  return (
    <AppShell sidepanel={<Sidepanel selectedSymbol={selectedSymbol} />}>
      {children}
    </AppShell>
  );
}
