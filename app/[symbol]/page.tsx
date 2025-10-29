'use client';

import { use, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import Sidepanel from '@/components/layout/Sidepanel';
import SymbolView from '@/components/symbol/SymbolView';

interface SymbolPageProps {
  params: Promise<{ symbol: string }>;
}

export default function SymbolPage({ params }: SymbolPageProps) {
  const { symbol } = use(params);
  const upperSymbol = symbol.toUpperCase();

  useEffect(() => {
    document.title = `${upperSymbol} - HyperScalper`;
  }, [upperSymbol]);

  return (
    <>
      <style jsx global>{`
        body {
          background: var(--background-primary);
          font-family: 'Courier New', monospace;
        }
        .terminal-border {
          border: 2px solid var(--border-frame);
          box-shadow: 0 0 10px color-mix(in srgb, var(--border-frame) 50%, transparent);
        }
        .terminal-text {
          text-shadow: 0 0 5px color-mix(in srgb, var(--primary) 50%, transparent);
        }
      `}</style>

      <AppShell
        sidepanel={<Sidepanel selectedSymbol={upperSymbol} />}
      >
        <SymbolView key={upperSymbol} coin={upperSymbol} />
      </AppShell>
    </>
  );
}
