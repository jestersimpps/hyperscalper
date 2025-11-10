'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';

interface SymbolDropdownProps {
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void;
  currentPrice?: number;
  decimals?: number;
}

export function SymbolDropdown({ currentSymbol, onSymbolChange, currentPrice, decimals = 2 }: SymbolDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const metadata = useSymbolMetaStore((state) => state.metadata);

  const allSymbols = useMemo(() => {
    return Object.keys(metadata).sort();
  }, [metadata]);

  const filteredSymbols = useMemo(() => {
    if (!searchQuery) return allSymbols;
    const query = searchQuery.toUpperCase();
    return allSymbols.filter(symbol => symbol.includes(query));
  }, [allSymbols, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      searchInputRef.current?.focus();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSymbolSelect = (symbol: string) => {
    onSymbolChange(symbol);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 terminal-border bg-bg-primary hover:bg-primary/5 transition-colors"
      >
        <span className="text-primary text-lg font-bold tracking-wider">
          {currentSymbol}/USD
        </span>
        {currentPrice && currentPrice > 0 && (
          <span className="text-primary-muted text-sm">
            ${currentPrice.toFixed(decimals)}
          </span>
        )}
        <span className="text-primary text-xs ml-1">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 terminal-border bg-bg-primary shadow-lg z-50">
          <div className="p-2 border-b border-primary/20">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbols..."
              className="w-full px-2 py-1 bg-bg-secondary terminal-border text-primary text-sm font-mono focus:outline-none focus:border-primary/50"
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filteredSymbols.length === 0 ? (
              <div className="p-4 text-center text-primary-muted text-sm font-mono">
                No symbols found
              </div>
            ) : (
              filteredSymbols.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => handleSymbolSelect(symbol)}
                  className={`w-full px-3 py-2 text-left text-sm font-mono hover:bg-primary/10 transition-colors ${
                    symbol === currentSymbol
                      ? 'bg-primary/20 text-primary font-bold'
                      : 'text-primary-muted'
                  }`}
                >
                  {symbol}/USD
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
