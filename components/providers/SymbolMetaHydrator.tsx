'use client';

import { useRef, useEffect } from 'react';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import type { SymbolMeta } from '@/stores/useSymbolMetaStore';

interface SymbolMetaHydratorProps {
  initialData: { universe: SymbolMeta[] } | null;
}

export default function SymbolMetaHydrator({ initialData }: SymbolMetaHydratorProps) {
  const hydrated = useRef(false);

  if (!hydrated.current && initialData?.universe) {
    const metadata: Record<string, SymbolMeta> = {};
    initialData.universe.forEach((symbol: SymbolMeta) => {
      metadata[symbol.name] = symbol;
    });

    useSymbolMetaStore.setState({
      metadata,
      loading: false,
      error: null
    });

    hydrated.current = true;
  }

  useEffect(() => {
    if (!initialData?.universe && !hydrated.current) {
      useSymbolMetaStore.getState().fetchMetadata();
    }
  }, [initialData]);

  return null;
}
