'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useScannerStore } from '@/stores/useScannerStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTopSymbolsStore } from '@/stores/useTopSymbolsStore';
import { useSidebarPricesStore } from '@/stores/useSidebarPricesStore';
import { usePositionStore } from '@/stores/usePositionStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { formatPrice } from '@/lib/format-utils';

interface SidepanelProps {
  selectedSymbol: string;
  onSymbolSelect?: (symbol: string) => void;
}

export default function Sidepanel({ selectedSymbol, onSymbolSelect }: SidepanelProps) {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { results, status, runScan, startAutoScanWithDelay, stopAutoScan } = useScannerStore();
  const { settings, pinSymbol, unpinSymbol } = useSettingsStore();
  const topSymbols = useTopSymbolsStore((state) => state.symbols);
  const isLoadingTopSymbols = useTopSymbolsStore((state) => state.isLoading);
  const startAutoRefresh = useTopSymbolsStore((state) => state.startAutoRefresh);
  const stopAutoRefresh = useTopSymbolsStore((state) => state.stopAutoRefresh);
  const pinnedSymbols = settings.pinnedSymbols;
  const { subscribe, unsubscribe, getPrice } = useSidebarPricesStore();
  const { startPollingMultiple, stopPollingMultiple, getPosition } = usePositionStore();

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

  useEffect(() => {
    startAutoRefresh();

    return () => {
      stopAutoRefresh();
    };
  }, [startAutoRefresh, stopAutoRefresh]);

  useEffect(() => {
    subscribe();

    return () => {
      unsubscribe();
    };
  }, [subscribe, unsubscribe]);

  useEffect(() => {
    if (pinnedSymbols.length > 0) {
      startPollingMultiple(pinnedSymbols);
    }

    return () => {
      if (pinnedSymbols.length > 0) {
        stopPollingMultiple(pinnedSymbols);
      }
    };
  }, [pinnedSymbols, startPollingMultiple, stopPollingMultiple]);

  const formatTimeSince = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const renderPrice = (coin: string) => {
    const price = getPrice(coin);
    const position = getPosition(coin);

    if (!price) return null;

    const decimals = useSymbolMetaStore.getState().getDecimals(coin);
    const formattedPrice = formatPrice(price, decimals.price);

    if (position) {
      const formattedPnl = position.pnl.toFixed(2);
      const pnlSign = position.pnl >= 0 ? '+' : '';
      const colorClass = position.pnl >= 0 ? 'text-bullish' : 'text-bearish';

      return (
        <div className="flex flex-col text-xs font-mono text-right flex-shrink-0 w-24 tabular-nums">
          <span className="text-primary-muted">${formattedPrice}</span>
          <span className={colorClass}>{pnlSign}${formattedPnl}</span>
        </div>
      );
    }

    return (
      <span className="text-xs font-mono text-primary-muted text-right flex-shrink-0 w-24 tabular-nums block">
        ${formattedPrice}
      </span>
    );
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
                } else if (result.scanType === 'macdReversal') {
                  const timeframes = result.macdReversals?.map(r => r.timeframe).join(', ') || '';
                  displayText = `${result.symbol}/USD MACD ${isBullish ? 'bullish' : 'bearish'} ${timeframes}`;
                } else if (result.scanType === 'rsiReversal') {
                  const timeframes = result.rsiReversals?.map(r => r.timeframe).join(', ') || '';
                  displayText = `${result.symbol}/USD RSI ${isBullish ? 'bullish' : 'bearish'} ${timeframes}`;
                }

                const isPinned = pinnedSymbols.includes(result.symbol);

                return (
                  <div key={`${result.symbol}-${result.scanType}-${index}`} className={`terminal-border ${bgColor} ${borderColor}`}>
                    <div className="flex items-center">
                      <button
                        onClick={() => {
                          if (onSymbolSelect) {
                            onSymbolSelect(result.symbol);
                          } else {
                            router.push(`/${result.symbol}`);
                          }
                        }}
                        className="flex-1 text-left p-2"
                      >
                        <div className="flex justify-between items-center gap-2">
                          <div className={`text-xs font-mono ${textColor} flex-1 min-w-0`}>
                            {displayText}
                          </div>
                          <div className="flex-shrink-0">
                            {renderPrice(result.symbol)}
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isPinned) {
                            unpinSymbol(result.symbol);
                          } else {
                            pinSymbol(result.symbol);
                          }
                        }}
                        className="p-2 text-primary-muted hover:text-primary transition-colors"
                        title={isPinned ? "Unpin symbol" : "Pin symbol"}
                      >
                        <span className="text-sm font-bold">{isPinned ? '−' : '+'}</span>
                      </button>
                    </div>
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

      {/* Top Symbols Dropdown Selector */}
      <div className="mb-3">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full terminal-border p-2 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-primary-muted text-xs font-mono">ADD FROM TOP 20 BY VOLUME</span>
            <span className="text-primary text-xs">{isDropdownOpen ? '▼' : '▶'}</span>
          </div>
        </button>

        {isDropdownOpen && (
          <div className="mt-1 terminal-border bg-bg-primary max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-primary-dark scrollbar-track-transparent">
            {isLoadingTopSymbols ? (
              <div className="p-3 text-center text-primary-muted text-xs font-mono">
                Loading...
              </div>
            ) : (
              <div className="divide-y divide-frame">
                {topSymbols.map((symbolData) => {
                  const isPinned = pinnedSymbols.includes(symbolData.name);
                  const volumeInMillions = (symbolData.volume / 1000000).toFixed(1);

                  return (
                    <div
                      key={symbolData.name}
                      className="flex items-center hover:bg-primary/5 transition-colors"
                    >
                      <button
                        onClick={() => {
                          if (onSymbolSelect) {
                            onSymbolSelect(symbolData.name);
                          } else {
                            router.push(`/${symbolData.name}`);
                          }
                        }}
                        className="flex-1 text-left p-2"
                      >
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-primary text-xs font-mono font-bold w-16 flex-shrink-0">
                            {symbolData.name}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {renderPrice(symbolData.name)}
                            <span className="text-primary-muted text-xs font-mono w-12 text-right">
                              ${volumeInMillions}M
                            </span>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isPinned) {
                            unpinSymbol(symbolData.name);
                          } else {
                            pinSymbol(symbolData.name);
                          }
                        }}
                        className="p-2 text-primary-muted hover:text-primary transition-colors"
                        title={isPinned ? 'Unpin symbol' : 'Pin symbol'}
                      >
                        <span className="text-sm font-bold">{isPinned ? '−' : '+'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pinned Symbols List */}
      <div className="space-y-1">
        {pinnedSymbols.length === 0 ? (
          <div className="terminal-border p-3 text-center">
            <span className="text-primary-muted text-xs font-mono">
              No pinned symbols. Use + to add symbols.
            </span>
          </div>
        ) : (
          pinnedSymbols.map((symbol) => (
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
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-primary font-bold w-20 flex-shrink-0">{symbol}/USD</span>
                      {selectedSymbol === symbol && (
                        <span className="text-primary text-xs flex-shrink-0">█</span>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {renderPrice(symbol)}
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unpinSymbol(symbol);
                  }}
                  className="p-2 text-primary-muted hover:text-bearish transition-colors"
                  title="Unpin symbol"
                >
                  <span className="text-sm font-bold">−</span>
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
          ))
        )}
      </div>
    </div>
  );
}
