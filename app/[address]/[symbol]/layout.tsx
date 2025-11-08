'use client';

import { use, ReactNode, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import Sidepanel from '@/components/layout/Sidepanel';

interface SymbolLayoutProps {
  children: ReactNode;
  params: Promise<{ address: string; symbol: string }>;
}

export default function SymbolLayout({ children, params }: SymbolLayoutProps) {
  const { address, symbol } = use(params);
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
          border: 1px solid var(--border-frame);
        }
        .terminal-text {
        }
      `}</style>

      <AppShell
        sidepanel={<Sidepanel selectedSymbol={upperSymbol} />}
      >
        {children}
      </AppShell>
    </>
  );
}
