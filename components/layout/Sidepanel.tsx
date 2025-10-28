'use client';

import { useRouter } from 'next/navigation';

interface SidepanelProps {
  selectedSymbol: string;
  onSymbolSelect?: (symbol: string) => void;
}

export default function Sidepanel({ selectedSymbol, onSymbolSelect }: SidepanelProps) {
  const router = useRouter();
  const symbols = ['BTC', 'PUMP'];

  return (
    <div className="p-2 h-full flex flex-col">
      <div className="mb-4">
        <div className="terminal-border p-1.5">
          <div className="terminal-text text-center">
            <span className="text-primary text-xs font-bold tracking-wider">█ SYMBOLS</span>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {symbols.map((symbol) => (
          <div
            key={symbol}
            className={`terminal-border transition-colors ${
              selectedSymbol === symbol
                ? 'bg-primary/10 border-primary'
                : 'hover:bg-primary/5'
            }`}
          >
            <div className="flex items-center">
              <button
                onClick={() => {
                  if (onSymbolSelect) {
                    onSymbolSelect(symbol);
                  } else {
                    router.push(`/${symbol}`);
                  }
                }}
                className="flex-1 text-left p-2"
              >
                <div className="flex justify-between items-center">
                  <span className="text-primary font-bold">{symbol}/USD</span>
                  {selectedSymbol === symbol && (
                    <span className="text-primary text-xs">█</span>
                  )}
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/chart-popup/${symbol}`, '_blank', 'width=1200,height=800');
                }}
                className="p-2 text-primary-muted hover:text-primary transition-colors"
                title="Open in new window"
              >
                <span className="text-sm">⧉</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
