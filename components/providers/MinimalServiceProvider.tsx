'use client';

import { useEffect } from 'react';
import { useHyperliquidService } from '@/lib/hooks/use-hyperliquid-service';
import { useAddressFromUrl } from '@/lib/hooks/use-address-from-url';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useCandleStore } from '@/stores/useCandleStore';

export function MinimalServiceProvider({ children }: { children: React.ReactNode }) {
  const addressFromUrl = useAddressFromUrl();
  const service = useHyperliquidService(addressFromUrl || undefined);
  const setMetaService = useSymbolMetaStore((state) => state.setService);
  const fetchMetadata = useSymbolMetaStore((state) => state.fetchMetadata);
  const setCandleService = useCandleStore((state) => state.setService);

  useEffect(() => {
    if (service) {
      setMetaService(service);
      setCandleService(service);
      fetchMetadata();
    }
  }, [service, setMetaService, setCandleService, fetchMetadata]);

  return <>{children}</>;
}
