'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useScannerStore } from '@/stores/useScannerStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface SidepanelProps {
  selectedSymbol: string;
  onSymbolSelect?: (symbol: string) => void;
}

export default function Sidepanel({ selectedSymbol, onSymbolSelect }: SidepanelProps) {
  const router = useRouter();
  const symbols = ['BTC', 'PUMP'];

  const { results, status, runScan, startAutoScanWithDelay, stopAutoScan } = useScannerStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    if (settings.scanner.enabled) {
      startAutoScanWithDelay();
    } else {
      stopAutoScan();
    }

    return () => {
      stopAutoScan();
    };
  }, [settings.scanner.enabled, settings.scanner.scanInterval, startAutoScanWithDelay, stopAutoScan]);

  const formatTimeSince = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="p-2 h-full flex flex-col overflow-y-auto">
      {settings.scanner.enabled && (
        <div className="mb-4">
          <div className="terminal-border p-2 mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-primary text-xs font-bold tracking-wider">█ SCANNER</span>
              <button
                onClick={runScan}
                disabled={status.isScanning}
                className="px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Run manual scan"
              >
                {status.isScanning ? '⟳ SCANNING...' : '⟳ SCAN'}
              </button>
            </div>

            <div className="text-xs text-primary-muted font-mono space-y-1">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={status.isRunning ? 'text-success' : 'text-primary-muted'}>
                  {status.isRunning ? '● AUTO' : '○ MANUAL'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last scan:</span>
                <span>{formatTimeSince(status.lastScanTime)}</span>
              </div>
              {status.error && (
                <div className="text-error text-[10px] mt-1">{status.error}</div>
              )}
            </div>
          </div>

          {results.length > 0 && (
            <div className="space-y-1 mb-4">
              <div className="text-xs text-primary-muted font-mono px-1">
                {results.length} match{results.length !== 1 ? 'es' : ''}
              </div>
              {results.map((result, index) => {
                const isBullish = result.signalType === 'bullish';
                const bgColor = isBullish ? 'bg-bullish/5' : 'bg-bearish/5';
                const borderColor = isBullish ? 'border-bullish' : 'border-bearish';
                const textColor = isBullish ? 'text-bullish' : 'text-bearish';

                let displayText = '';
                if (result.scanType === 'stochastic') {
                  const signal = isBullish ? 'bottomed' : 'topped';
                  displayText = `${result.symbol}/USD stochastics ${signal}`;
                } else if (result.scanType === 'emaAlignment') {
                  const signal = isBullish ? 'crossed up' : 'crossed down';
                  displayText = `${result.symbol}/USD ema ${signal}`;
                }

                return (
                  <div key={`${result.symbol}-${result.scanType}-${index}`} className={`terminal-border ${bgColor} ${borderColor}`}>
                    <button
                      onClick={() => {
                        if (onSymbolSelect) {
                          onSymbolSelect(result.symbol);
                        } else {
                          router.push(`/${result.symbol}`);
                        }
                      }}
                      className="w-full text-left p-2"
                    >
                      <div className={`text-xs font-mono ${textColor}`}>
                        {displayText}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
