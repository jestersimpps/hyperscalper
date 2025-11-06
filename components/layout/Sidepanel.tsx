'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { useScannerStore } from '@/stores/useScannerStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTopSymbolsStore } from '@/stores/useTopSymbolsStore';
import { useSidebarPricesStore } from '@/stores/useSidebarPricesStore';
import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
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
  const orders = useOrderStore((state) => state.orders);

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
    if (allSymbolsToShow.length > 0) {
      startPollingMultiple(allSymbolsToShow);
    }

    return () => {
      if (allSymbolsToShow.length > 0) {
        stopPollingMultiple(allSymbolsToShow);
      }
    };
  }, [allSymbolsToShow, startPollingMultiple, stopPollingMultiple]);

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

  const symbolsWithOrders = useMemo(() => {
    return Object.entries(orders)
      .filter(([_, orderList]) => orderList && orderList.length > 0)
      .map(([symbol]) => symbol);
  }, [orders]);

  const allSymbolsToShow = useMemo(() => {
    const symbolSet = new Set([...pinnedSymbols, ...symbolsWithOrders]);
    return Array.from(symbolSet);
  }, [pinnedSymbols, symbolsWithOrders]);

  const sortedSymbols = useMemo(() => {
    return [...allSymbolsToShow].sort((a, b) => {
      const posA = getPosition(a);
      const posB = getPosition(b);

      const pnlA = posA?.pnl ?? null;
      const pnlB = posB?.pnl ?? null;

      if (pnlA !== null && pnlB !== null) {
        return pnlB - pnlA;
      }

      if (pnlA !== null && pnlB === null) {
        return pnlA > 0 ? -1 : 1;
      }

      if (pnlA === null && pnlB !== null) {
        return pnlB > 0 ? 1 : -1;
      }

      return 0;
    });
  }, [allSymbolsToShow, getPosition]);

  return (
    <div className="p-2 h-full flex gap-2 overflow-hidden">
      {/* Left Column - Scanner */}
      {settings.scanner.enabled && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="terminal-border p-2 mb-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-primary text-xs font-bold tracking-wider">█ SCANNER</span>
              <button
                onClick={runScan}
                disabled={status.isScanning}
                className="px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 active:bg-primary/30 active:scale-95 text-primary border border-primary rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer transition-all"
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

          <div className="flex-1 overflow-y-auto">
            {results.length > 0 && (() => {
              const groupedBySymbol = results.reduce((acc, result) => {
                if (!acc[result.symbol]) {
                  acc[result.symbol] = [];
                }
                acc[result.symbol].push(result);
                return acc;
              }, {} as Record<string, typeof results>);

              return (
                <div className="space-y-1">
                <div className="text-xs text-primary-muted font-mono px-1">
                  {Object.keys(groupedBySymbol).length} symbol{Object.keys(groupedBySymbol).length !== 1 ? 's' : ''} ({results.length} signal{results.length !== 1 ? 's' : ''})
                </div>
                {Object.entries(groupedBySymbol).map(([symbol, symbolResults]) => {
                  const isBullish = symbolResults[0].signalType === 'bullish';
                  const bgColor = isBullish ? 'bg-bullish/5' : 'bg-bearish/5';
                  const borderColor = isBullish ? 'border-bullish' : 'border-bearish';
                  const arrowColor = isBullish ? 'text-bullish' : 'text-bearish';
                  const arrow = isBullish ? '▲' : '▼';
                  const isPinned = pinnedSymbols.includes(symbol);

                  const signalBadges: JSX.Element[] = [];

                  symbolResults.forEach((result, idx) => {
                    const resultBullish = result.signalType === 'bullish';
                    const badgeBg = resultBullish ? 'bg-bullish' : 'bg-bearish';

                    if (result.scanType === 'stochastic') {
                      signalBadges.push(
                        <span key={`${symbol}-stoch-${idx}`} className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded text-[10px] font-bold`}>
                          STOCH
                        </span>
                      );
                    } else if (result.scanType === 'emaAlignment') {
                      const emaArrow = resultBullish ? '↑' : '↓';
                      signalBadges.push(
                        <span key={`${symbol}-ema-${idx}`} className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded text-[10px] font-bold`}>
                          EMA{emaArrow}
                        </span>
                      );
                    } else if (result.scanType === 'macdReversal') {
                      const timeframes = [...new Set(result.macdReversals?.map(r => r.timeframe))].join(',');
                      signalBadges.push(
                        <span key={`${symbol}-macd-${idx}`} className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded text-[10px] font-bold`}>
                          MACD {timeframes}
                        </span>
                      );
                    } else if (result.scanType === 'rsiReversal') {
                      const timeframes = [...new Set(result.rsiReversals?.map(r => r.timeframe))].join(',');
                      signalBadges.push(
                        <span key={`${symbol}-rsi-${idx}`} className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded text-[10px] font-bold`}>
                          RSI {timeframes}
                        </span>
                      );
                    } else if (result.scanType === 'channel') {
                      const channels = result.channels || [];
                      const channelArrows = channels.map(c => {
                        if (c.type === 'ascending') return '↗';
                        if (c.type === 'descending') return '↘';
                        return '→';
                      });
                      const uniqueArrow = channelArrows[0] || '→';
                      signalBadges.push(
                        <span key={`${symbol}-ch-${idx}`} className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded text-[10px] font-bold`}>
                          {uniqueArrow}CH
                        </span>
                      );
                    } else if (result.scanType === 'divergence') {
                      const divergences = result.divergences || [];
                      const isHidden = divergences[0]?.type.includes('hidden');
                      const variants = [...new Set(divergences.map(d => d.variant.replace(/\D/g, '')))].join(',');
                      signalBadges.push(
                        <span key={`${symbol}-div-${idx}`} className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded text-[10px] font-bold`}>
                          {isHidden ? 'H-' : ''}DIV {variants}
                        </span>
                      );
                    }
                  });

                  return (
                    <div key={symbol} className={`terminal-border ${bgColor} ${borderColor}`}>
                      <div className="flex items-center gap-2 p-2">
                        <button
                          onClick={() => {
                            if (onSymbolSelect) {
                              onSymbolSelect(symbol);
                            } else {
                              router.push(`/${symbol}`);
                            }
                          }}
                          className="flex-1 flex items-center gap-2 flex-wrap text-left"
                        >
                          <span className={`text-lg ${arrowColor} font-bold`}>{arrow}</span>
                          <span className="text-primary font-bold text-xs">{symbol}/USD</span>
                          {signalBadges}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isPinned) {
                              unpinSymbol(symbol);
                            } else {
                              pinSymbol(symbol);
                            }
                          }}
                          className="p-1 text-primary-muted hover:text-primary transition-colors flex-shrink-0 cursor-pointer"
                          title={isPinned ? "Unpin symbol" : "Pin symbol"}
                        >
                          <span className="text-base font-bold">{isPinned ? '−' : '+'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Right Column - Pinned Symbols */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="mb-4">
          <div className="terminal-border p-1.5">
            <div className="terminal-text text-center">
              <span className="text-primary text-xs font-bold tracking-wider">█ SYMBOLS</span>
            </div>
          </div>
        </div>

        {/* Top Symbols Dropdown Selector */}
        <div className="mb-3 flex-shrink-0">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full terminal-border p-2 hover:bg-primary/5 active:bg-primary/10 active:scale-[0.99] cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-primary-muted text-xs font-mono">ADD FROM TOP 20 BY VOLUME</span>
            <span className="text-primary text-base">{isDropdownOpen ? '▼' : '▶'}</span>
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
                        className="p-2 text-primary-muted hover:text-primary cursor-pointer transition-colors"
                        title={isPinned ? 'Unpin symbol' : 'Pin symbol'}
                      >
                        <span className="text-lg font-bold">{isPinned ? '−' : '+'}</span>
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
        <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {sortedSymbols.length === 0 ? (
          <div className="terminal-border p-3 text-center">
            <span className="text-primary-muted text-xs font-mono">
              No pinned symbols. Use + to add symbols.
            </span>
          </div>
        ) : (
          sortedSymbols.map((symbol) => {
            const isPinned = pinnedSymbols.includes(symbol);
            const hasOrders = symbolsWithOrders.includes(symbol);
            const orderCount = orders[symbol]?.length || 0;

            return (
            <div
              key={symbol}
              className={`terminal-border ${
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
                      {selectedSymbol === symbol && (
                        <span className="text-primary text-xs flex-shrink-0">█</span>
                      )}
                      <span className="text-primary font-bold flex-shrink-0">{symbol}/USD</span>
                      {hasOrders && (
                        <span className="text-accent-orange text-[10px] flex-shrink-0" title={`${orderCount} open order${orderCount !== 1 ? 's' : ''}`}>
                          ✦{orderCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {renderPrice(symbol)}
                    </div>
                  </div>
                </button>
                {isPinned && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      unpinSymbol(symbol);
                    }}
                    className="p-2 text-primary-muted hover:text-bearish cursor-pointer transition-colors"
                    title="Unpin symbol"
                  >
                    <span className="text-lg font-bold">−</span>
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/chart-popup/${symbol}`, '_blank', 'width=1200,height=800');
                  }}
                  className="p-2 text-primary-muted hover:text-primary cursor-pointer transition-colors"
                  title="Open in new window"
                >
                  <span className="text-lg">⧉</span>
                </button>
              </div>
            </div>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
}
