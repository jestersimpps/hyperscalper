'use client';

import { useEffect } from 'react';
import { useHyperliquidService } from '@/lib/hooks/use-hyperliquid-service';
import { usePositionStore } from '@/stores/usePositionStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useCandleStore } from '@/stores/useCandleStore';
import { useTradingStore } from '@/stores/useTradingStore';

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const service = useHyperliquidService();
  const setPositionService = usePositionStore((state) => state.setService);
  const setMetaService = useSymbolMetaStore((state) => state.setService);
  const fetchMetadata = useSymbolMetaStore((state) => state.fetchMetadata);
  const setOrderService = useOrderStore((state) => state.setService);
  const setCandleService = useCandleStore((state) => state.setService);
  const setTradingService = useTradingStore((state) => state.setService);

  useEffect(() => {
    if (service) {
      setPositionService(service);
      setMetaService(service);
      setOrderService(service);
      setCandleService(service);
      setTradingService(service);

      fetchMetadata();
    }
  }, [service, setPositionService, setMetaService, setOrderService, setCandleService, setTradingService, fetchMetadata]);

  return <>{children}</>;
}
