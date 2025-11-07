'use client';

import { useEffect } from 'react';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';

export default function SymbolMetaHydrator() {
  const fetchMetadata = useSymbolMetaStore((state) => state.fetchMetadata);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return null;
}
