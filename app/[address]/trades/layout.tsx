'use client';

import { ReactNode, useEffect } from 'react';

interface TradesLayoutProps {
  children: ReactNode;
}

export default function TradesLayout({ children }: TradesLayoutProps) {
  useEffect(() => {
    document.title = 'Today\'s Trades - HyperScalper';
  }, []);

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
