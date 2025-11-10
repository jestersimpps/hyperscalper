'use client';

import { usePathname } from 'next/navigation';
import { ServiceProvider } from '@/components/providers/ServiceProvider';
import { MinimalServiceProvider } from '@/components/providers/MinimalServiceProvider';

export function ConditionalServiceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPopup = pathname?.includes('/chart-popup/');

  if (isPopup) {
    return <MinimalServiceProvider>{children}</MinimalServiceProvider>;
  }

  return <ServiceProvider>{children}</ServiceProvider>;
}
