'use client';

import { useEffect } from 'react';
import { useHyperliquidService } from '@/lib/hooks/use-hyperliquid-service';
import { useAddressFromUrl } from '@/lib/hooks/use-address-from-url';
import { usePositionStore } from '@/stores/usePositionStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useCandleStore } from '@/stores/useCandleStore';
import { useTradingStore } from '@/stores/useTradingStore';
import { useTopSymbolsStore } from '@/stores/useTopSymbolsStore';
import { useUserFillsStore } from '@/stores/useUserFillsStore';
import { useScannerStore } from '@/stores/useScannerStore';
import { useSymbolVolatilityStore } from '@/stores/useSymbolVolatilityStore';
import { useGlobalPollingStore } from '@/stores/useGlobalPollingStore';

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const addressFromUrl = useAddressFromUrl();
  const service = useHyperliquidService(addressFromUrl || undefined);
  const setPositionService = usePositionStore((state) => state.setService);
  const fetchAndStoreAllOpenPositions = usePositionStore((state) => state.fetchAndStoreAllOpenPositions);
  const setMetaService = useSymbolMetaStore((state) => state.setService);
  const fetchMetadata = useSymbolMetaStore((state) => state.fetchMetadata);
  const setOrderService = useOrderStore((state) => state.setService);
  const setCandleService = useCandleStore((state) => state.setService);
  const setTradingService = useTradingStore((state) => state.setService);
  const setTopSymbolsService = useTopSymbolsStore((state) => state.setService);
  const setUserFillsService = useUserFillsStore((state) => state.setService);
  const setScannerService = useScannerStore((state) => state.setService);
  const setVolatilityService = useSymbolVolatilityStore((state) => state.setService);
  const setGlobalPollingService = useGlobalPollingStore((state) => state.setService);

  useEffect(() => {
    if (service) {
      setPositionService(service);
      setMetaService(service);
      setOrderService(service);
      setCandleService(service);
      setTradingService(service);
      setTopSymbolsService(service);
      setUserFillsService(service);
      setScannerService(service);
      setVolatilityService(service);
      setGlobalPollingService(service);

      fetchMetadata();
      fetchAndStoreAllOpenPositions();
    }
  }, [service]);

  return <>{children}</>;
}
