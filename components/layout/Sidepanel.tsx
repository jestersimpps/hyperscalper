'use client';

interface SidepanelProps {
  selectedSymbol: string;
  onSymbolSelect?: (symbol: string) => void;
}

export default function Sidepanel({ selectedSymbol, onSymbolSelect }: SidepanelProps) {
  const symbols = ['BTC'];

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
          <button
            key={symbol}
            onClick={() => onSymbolSelect?.(symbol)}
            className={`w-full text-left terminal-border p-2 transition-colors ${
              selectedSymbol === symbol
                ? 'bg-primary/10 border-primary'
                : 'hover:bg-primary/5'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-primary font-bold">{symbol}/USD</span>
              {selectedSymbol === symbol && (
                <span className="text-primary text-xs">█</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
