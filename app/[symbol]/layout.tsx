'use client';

import { use, ReactNode, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import Sidepanel from '@/components/layout/Sidepanel';

interface SymbolLayoutProps {
  children: ReactNode;
  params: Promise<{ symbol: string }>;
}

export default function SymbolLayout({ children, params }: SymbolLayoutProps) {
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
        {children}
      </AppShell>
    </>
  );
}
