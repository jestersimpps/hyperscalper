'use client';

import { useEffect } from 'react';
import { useGlobalBTCStore } from '@/stores/useGlobalBTCStore';

export default function GlobalBTCProvider() {
  useEffect(() => {
    const initialize = useGlobalBTCStore.getState().initialize;
    const cleanup = useGlobalBTCStore.getState().cleanup;

    initialize();

    return () => {
      cleanup();
    };
  }, []);

  return null;
}
