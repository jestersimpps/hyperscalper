'use client';

import { use, ReactNode, useEffect } from 'react';

interface SymbolLayoutProps {
  children: ReactNode;
  params: Promise<{ address: string; symbol: string }>;
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
          border: 1px solid var(--border-frame);
        }
        .terminal-text {
        }
      `}</style>

      {children}
    </>
  );
}
