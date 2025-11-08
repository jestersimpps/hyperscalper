'use client';

import React, { memo } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { useScannerStore } from '@/stores/useScannerStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTopSymbolsStore } from '@/stores/useTopSymbolsStore';
import { useSidebarPricesStore } from '@/stores/useSidebarPricesStore';
import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useSymbolVolatilityStore } from '@/stores/useSymbolVolatilityStore';
import { formatPrice } from '@/lib/format-utils';
import { useAddressFromUrl } from '@/lib/hooks/use-address-from-url';
import { PositionPriceIndicator } from '@/components/PositionPriceIndicator';

interface SidepanelProps {
  selectedSymbol: string;
  onSymbolSelect?: (symbol: string) => void;
}

interface SymbolPriceProps {
  symbol: string;
}

const SymbolPrice = memo(({ symbol }: SymbolPriceProps) => {
  const price = useSidebarPricesStore((state) => state.prices[symbol]);
  const position = usePositionStore((state) => state.positions[symbol]);

  const decimals = useSymbolMetaStore.getState().getDecimals(symbol);
  const formattedPrice = price ? formatPrice(price, decimals.price) : '-.--';

  const pnlText = position && position.size > 0
    ? `${position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)} USD`
    : '+-.-- USD';

  const pnlColorClass = position && position.size > 0
    ? (position.pnl >= 0 ? 'text-bullish' : 'text-bearish')
    : 'text-primary-muted';

  const pnlTooltip = position && position.size > 0
    ? `Unrealized PnL: ${position.pnl >= 0 ? '+' : ''}$${position.pnl.toFixed(2)}`
    : 'No active position';

  return (
    <div className="flex flex-col text-xs font-mono text-right flex-shrink-0 w-24 tabular-nums">
      <span className={pnlColorClass} title={pnlTooltip}>{pnlText}</span>
      <span className="text-primary-muted" title={`Current price: $${formattedPrice}`}>${formattedPrice}</span>
    </div>
  );
});

SymbolPrice.displayName = 'SymbolPrice';

const VolatilityBlocks = memo(({ symbol }: SymbolPriceProps) => {
  const volatilityData = useSymbolVolatilityStore((state) => state.volatility[symbol]);

  const blocks = volatilityData?.blocks || 0;
  const percentChange = volatilityData?.percentChange || 0;
  const tooltip = `24h change: ${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`;

  return (
    <div className="flex gap-0.5 items-center pb-1" title={tooltip}>
      {Array.from({ length: 10 }).map((_, index) => (
        <span
          key={index}
          className={`text-[10px] ${index < blocks ? 'text-primary' : 'text-primary/20'}`}
        >
          █
        </span>
      ))}
    </div>
  );
});

VolatilityBlocks.displayName = 'VolatilityBlocks';

const SymbolItemSkeleton = memo(() => {
  return (
    <div className="terminal-border p-2 animate-pulse">
      <div className="flex justify-between items-stretch gap-2">
        <div className="flex flex-col justify-between min-w-0 flex-1">
          <div className="h-3 bg-primary/20 rounded w-20 mb-2"></div>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-2 w-1.5 bg-primary/10 rounded"></div>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <div className="h-3 bg-primary/20 rounded w-20"></div>
          <div className="h-2 bg-primary/10 rounded w-16"></div>
        </div>
      </div>
    </div>
  );
});

SymbolItemSkeleton.displayName = 'SymbolItemSkeleton';

export default function Sidepanel({ selectedSymbol, onSymbolSelect }: SidepanelProps) {
  const router = useRouter();
  const address = useAddressFromUrl();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { results, status, runScan, startAutoScanWithDelay, stopAutoScan } = useScannerStore();
  const { settings, pinSymbol, unpinSymbol } = useSettingsStore();
  const topSymbols = useTopSymbolsStore((state) => state.symbols);
  const isLoadingTopSymbols = useTopSymbolsStore((state) => state.isLoading);
  const startAutoRefresh = useTopSymbolsStore((state) => state.startAutoRefresh);
  const stopAutoRefresh = useTopSymbolsStore((state) => state.stopAutoRefresh);
  const pinnedSymbols = settings.pinnedSymbols;
  const subscribe = useSidebarPricesStore((state) => state.subscribe);
  const unsubscribe = useSidebarPricesStore((state) => state.unsubscribe);
  const startPollingMultiple = usePositionStore((state) => state.startPollingMultiple);
  const stopPollingMultiple = usePositionStore((state) => state.stopPollingMultiple);
  const getPosition = usePositionStore((state) => state.getPosition);
  const positions = usePositionStore((state) => state.positions);
  const orders = useOrderStore((state) => state.orders);

  const symbolsWithOrders = useMemo(() => {
    return Object.entries(orders)
      .filter(([_, orderList]) => orderList && orderList.length > 0)
      .map(([symbol]) => symbol);
  }, [orders]);

  const symbolsWithPositions = useMemo(() => {
    return Object.entries(positions)
      .filter(([_, position]) => position !== null && position.size > 0)
      .map(([symbol]) => symbol);
  }, [positions]);

  const allSymbolsToShow = useMemo(() => {
    const top20Names = topSymbols.map(s => s.name);
    const userPinnedNotInTop20 = pinnedSymbols.filter(s => !top20Names.includes(s));
    const symbolSet = new Set([
      ...top20Names,
      ...userPinnedNotInTop20,
      ...symbolsWithOrders,
      ...symbolsWithPositions
    ]);
    return Array.from(symbolSet);
  }, [topSymbols, pinnedSymbols, symbolsWithOrders, symbolsWithPositions]);

  const allSymbolsString = useMemo(() => {
    return [...allSymbolsToShow].sort().join(',');
  }, [allSymbolsToShow]);

  const nonTop20Symbols = useMemo(() => {
    const metadata = useSymbolMetaStore.getState().metadata;
    const allSymbolNames = Object.keys(metadata);
    const top20Names = topSymbols.map(s => s.name);
    return allSymbolNames
      .filter(symbol => !top20Names.includes(symbol))
      .sort();
  }, [topSymbols]);

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
    const symbols = allSymbolsString.split(',').filter(s => s.length > 0);
    if (symbols.length > 0) {
      startPollingMultiple(symbols);
    }

    return () => {
      if (symbols.length > 0) {
        stopPollingMultiple(symbols);
      }
    };
  }, [allSymbolsString, startPollingMultiple, stopPollingMultiple]);

  useEffect(() => {
    const symbols = allSymbolsString.split(',').filter(s => s.length > 0);
    if (symbols.length > 0) {
      useSymbolVolatilityStore.getState().subscribe(symbols);
    }

    return () => {
      if (symbols.length > 0) {
        useSymbolVolatilityStore.getState().unsubscribe(symbols);
      }
    };
  }, [allSymbolsString]);

  const formatTimeSince = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const { symbolsWithOpenPositions, symbolsWithoutPositions } = useMemo(() => {
    const withPositions: string[] = [];
    const withoutPositions: string[] = [];

    allSymbolsToShow.forEach(symbol => {
      const position = getPosition(symbol);
      if (position && position.size > 0) {
        withPositions.push(symbol);
      } else {
        withoutPositions.push(symbol);
      }
    });

    // Sort symbols with positions by absolute PnL
    withPositions.sort((a, b) => {
      const posA = getPosition(a);
      const posB = getPosition(b);
      const pnlA = Math.abs(posA?.pnl ?? 0);
      const pnlB = Math.abs(posB?.pnl ?? 0);
      return pnlB - pnlA;
    });

    // Sort symbols without positions by volatility
    withoutPositions.sort((a, b) => {
      const volatilityA = useSymbolVolatilityStore.getState().volatility[a];
      const volatilityB = useSymbolVolatilityStore.getState().volatility[b];
      const blocksA = volatilityA?.blocks ?? 0;
      const blocksB = volatilityB?.blocks ?? 0;
      return blocksB - blocksA;
    });

    return { symbolsWithOpenPositions: withPositions, symbolsWithoutPositions: withoutPositions };
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

                  const signalBadges: React.JSX.Element[] = [];

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
                              router.push(`/${address}/${symbol}`);
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

      {/* Right Column - Symbols */}
      <div className="flex-1 flex flex-col overflow-hidden gap-3">
        {/* Open Positions Section */}
        {symbolsWithOpenPositions.length > 0 && (
          <div className="flex-shrink-0">
            <div className="terminal-border p-1.5 mb-2">
              <div className="terminal-text text-center">
                <span className="text-primary text-xs font-bold tracking-wider">█ OPEN POSITIONS</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
              {isLoadingTopSymbols && symbolsWithOpenPositions.length === 0 ? (
                <>
                  <SymbolItemSkeleton />
                  <SymbolItemSkeleton />
                </>
              ) : (
                symbolsWithOpenPositions.map((symbol) => {
            const isPinned = pinnedSymbols.includes(symbol);
            const top20Data = topSymbols.find(s => s.name === symbol);
            const isTop20 = !!top20Data;
            const volumeInMillions = top20Data ? (top20Data.volume / 1000000).toFixed(1) : null;

            return (
            <div
              key={symbol}
              className={`${
                selectedSymbol === symbol
                  ? 'terminal-border bg-primary/20'
                  : 'terminal-border hover:bg-primary/5'
              }`}
            >
              <div className="flex items-start">
              <div className="flex flex-col flex-1">
                <button
                  onClick={() => {
                    if (onSymbolSelect) {
                      onSymbolSelect(symbol);
                    } else {
                      router.push(`/${address}/${symbol}`);
                    }
                  }}
                  className="flex-1 text-left p-2 pb-0"
                >
                  <div className="flex justify-between items-stretch gap-2">
                    <div className="flex flex-col justify-between min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-primary font-bold flex-shrink-0 text-xs ${
                            positions[symbol] && positions[symbol].size > 0 ? 'animate-pulse' : ''
                          }`}
                          title={`${symbol}/USD trading pair`}
                        >
                          {symbol}/USD
                        </span>
                      </div>
                      <div>
                        <VolatilityBlocks symbol={symbol} />
                      </div>
                    </div>
                    <div className="flex-1">
                      {/* Reserved space for minimal chart */}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <SymbolPrice symbol={symbol} />
                      {volumeInMillions && (
                        <span
                          className="text-[10px] text-primary-muted font-mono"
                          title={`24h volume: $${volumeInMillions}M`}
                        >
                          ${volumeInMillions}M
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <div className="px-2">
                  <PositionPriceIndicator symbol={symbol} />
                </div>
              </div>
              <div className="flex flex-col">
                {!isTop20 && isPinned && (
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
                    window.open(`/${address}/chart-popup/${symbol}`, '_blank', 'width=1200,height=800');
                  }}
                  className="p-2 text-primary-muted hover:text-primary cursor-pointer transition-colors"
                  title="Open in new window"
                >
                  <span className="text-lg">⧉</span>
                </button>
              </div>
              </div>
            </div>
            );
                })
              )}
            </div>
          </div>
        )}

        {/* Rest of Symbols Section */}
        {symbolsWithoutPositions.length > 0 && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="terminal-border p-1.5 mb-2">
              <div className="terminal-text text-center">
                <span className="text-primary text-xs font-bold tracking-wider">█ SYMBOLS</span>
              </div>
            </div>

            {/* Add Symbols Dropdown */}
            <div className="flex-shrink-0 mb-2">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full terminal-border p-2 hover:bg-primary/5 active:bg-primary/10 active:scale-[0.99] cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-primary-muted text-xs font-mono">ADD OTHER SYMBOLS</span>
                <span className="text-primary text-base">{isDropdownOpen ? '▼' : '▶'}</span>
              </div>
            </button>

            {isDropdownOpen && (
              <div className="mt-1 terminal-border bg-bg-primary max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-primary-dark scrollbar-track-transparent">
                {nonTop20Symbols.length === 0 ? (
                  <div className="p-3 text-center text-primary-muted text-xs font-mono">
                    No additional symbols available
                  </div>
                ) : (
                  <div className="divide-y divide-frame">
                    {nonTop20Symbols.map((symbol) => {
                      const isPinned = pinnedSymbols.includes(symbol);

                      return (
                        <div
                          key={symbol}
                          className="flex items-center hover:bg-primary/5 transition-colors"
                        >
                          <button
                            onClick={() => {
                              if (onSymbolSelect) {
                                onSymbolSelect(symbol);
                              } else {
                                router.push(`/${address}/${symbol}`);
                              }
                            }}
                            className="flex-1 text-left p-2"
                          >
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-primary text-xs font-mono font-bold">
                                {symbol}/USD
                              </span>
                              <SymbolPrice symbol={symbol} />
                            </div>
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

            <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
              {isLoadingTopSymbols && topSymbols.length === 0 ? (
                <>
                  <SymbolItemSkeleton />
                  <SymbolItemSkeleton />
                  <SymbolItemSkeleton />
                </>
              ) : (
                symbolsWithoutPositions.map((symbol) => {
                  const isPinned = pinnedSymbols.includes(symbol);
                  const top20Data = topSymbols.find(s => s.name === symbol);
                  const isTop20 = !!top20Data;
                  const volumeInMillions = top20Data ? (top20Data.volume / 1000000).toFixed(1) : null;

                  return (
                    <div
                      key={symbol}
                      className={`${
                        selectedSymbol === symbol
                          ? 'terminal-border bg-primary/20'
                          : 'terminal-border hover:bg-primary/5'
                      }`}
                    >
                      <div className="flex items-start">
                      <div className="flex flex-col flex-1">
                        <button
                          onClick={() => {
                            if (onSymbolSelect) {
                              onSymbolSelect(symbol);
                            } else {
                              router.push(`/${address}/${symbol}`);
                            }
                          }}
                          className="flex-1 text-left p-2 pb-0"
                        >
                          <div className="flex justify-between items-stretch gap-2">
                            <div className="flex flex-col justify-between min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-primary font-bold flex-shrink-0 text-xs"
                                  title={`${symbol}/USD trading pair`}
                                >
                                  {symbol}/USD
                                </span>
                              </div>
                              <div>
                                <VolatilityBlocks symbol={symbol} />
                              </div>
                            </div>
                            <div className="flex-1">
                              {/* Reserved space for minimal chart */}
                            </div>
                            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                              <SymbolPrice symbol={symbol} />
                              {volumeInMillions && (
                                <span
                                  className="text-[10px] text-primary-muted font-mono"
                                  title={`24h volume: $${volumeInMillions}M`}
                                >
                                  ${volumeInMillions}M
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        <div className="px-2">
                          <PositionPriceIndicator symbol={symbol} />
                        </div>
                      </div>
                      <div className="flex flex-col">
                        {!isTop20 && isPinned && (
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
                            window.open(`/${address}/chart-popup/${symbol}`, '_blank', 'width=1200,height=800');
                          }}
                          className="p-2 text-primary-muted hover:text-primary cursor-pointer transition-colors"
                          title="Open in new window"
                        >
                          <span className="text-lg">⧉</span>
                        </button>
                      </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
