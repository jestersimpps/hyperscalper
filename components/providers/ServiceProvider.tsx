'use client';

import { useEffect } from 'react';
import { useHyperliquidService } from '@/lib/hooks/use-hyperliquid-service';
import { usePositionStore } from '@/stores/usePositionStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useCandleStore } from '@/stores/useCandleStore';
import { useTradingStore } from '@/stores/useTradingStore';
import { useTopSymbolsStore } from '@/stores/useTopSymbolsStore';

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const service = useHyperliquidService();
  const setPositionService = usePositionStore((state) => state.setService);
  const fetchAndStoreAllOpenPositions = usePositionStore((state) => state.fetchAndStoreAllOpenPositions);
  const setMetaService = useSymbolMetaStore((state) => state.setService);
  const fetchMetadata = useSymbolMetaStore((state) => state.fetchMetadata);
  const setOrderService = useOrderStore((state) => state.setService);
  const setCandleService = useCandleStore((state) => state.setService);
  const setTradingService = useTradingStore((state) => state.setService);
  const setTopSymbolsService = useTopSymbolsStore((state) => state.setService);

  useEffect(() => {
    if (service) {
      setPositionService(service);
      setMetaService(service);
      setOrderService(service);
      setCandleService(service);
      setTradingService(service);
      setTopSymbolsService(service);

      fetchMetadata();
      fetchAndStoreAllOpenPositions();
    }
  }, [service, setPositionService, setMetaService, setOrderService, setCandleService, setTradingService, setTopSymbolsService, fetchMetadata, fetchAndStoreAllOpenPositions]);

  return <>{children}</>;
}
