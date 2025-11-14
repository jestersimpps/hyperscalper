'use client';

import React, { memo } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useScannerStore } from '@/stores/useScannerStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTopSymbolsStore } from '@/stores/useTopSymbolsStore';
import { useSidebarPricesStore } from '@/stores/useSidebarPricesStore';
import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useSymbolVolatilityStore } from '@/stores/useSymbolVolatilityStore';
import { useSymbolCandlesStore } from '@/stores/useSymbolCandlesStore';
import { useGlobalPollingStore } from '@/stores/useGlobalPollingStore';
import { formatPrice } from '@/lib/format-utils';
import { useAddressFromUrl } from '@/lib/hooks/use-address-from-url';
import { usePriceVolumeAnimation } from '@/hooks/usePriceVolumeAnimation';
import MiniPriceChart from '@/components/scanner/MiniPriceChart';
import SymbolItem from '@/components/sidepanel/SymbolItem';
import ScannerResultItem from '@/components/scanner/ScannerResultItem';
import {
  getInvertedColorClass,
  getInvertedAnimationClass,
  getInvertedArrow,
  shouldInvertCondition
} from '@/lib/inverted-utils';
import type { TimeInterval } from '@/types';

interface SidepanelProps {
  selectedSymbol: string;
  onSymbolSelect?: (symbol: string) => void;
  mobileView?: 'scanner' | 'symbols' | 'all';
}

interface SymbolPriceProps {
  symbol: string;
  closePrices?: number[];
}

const SymbolPrice = memo(({ symbol, closePrices }: SymbolPriceProps) => {
  const price = useSidebarPricesStore((state) => state.prices[symbol]);
  const invertedMode = useSettingsStore((state) => state.settings.chart.invertedMode);

  const { priceDirection } = usePriceVolumeAnimation(symbol, closePrices, undefined);

  const decimals = useSymbolMetaStore.getState().getDecimals(symbol);
  const formattedPrice = price ? formatPrice(price, decimals.price) : '-.--';

  const volatilityData = useSymbolVolatilityStore.getState().volatility[symbol];
  const percentChange = volatilityData?.percentChange || 0;
  const changeColorClass = percentChange >= 0 ? 'text-bullish' : 'text-bearish';
  const changeText = `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`;
  const changeTooltip = `24h change: ${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`;

  let priceTrend: 'up' | 'down' | null = null;
  if (closePrices && closePrices.length >= 5) {
    const last5 = closePrices.slice(-5);
    priceTrend = last5[last5.length - 1] > last5[0] ? 'up' : 'down';
  }

  const basePriceColorClass = priceTrend === 'up'
    ? 'text-bullish'
    : priceTrend === 'down'
    ? 'text-bearish'
    : 'text-primary-muted';
  const priceColorClass = getInvertedColorClass(basePriceColorClass, invertedMode);

  const basePriceBlinkClass = priceDirection === 'up'
    ? 'animate-blink-green'
    : priceDirection === 'down'
    ? 'animate-blink-red'
    : '';
  const priceBlinkClass = getInvertedAnimationClass(basePriceBlinkClass, invertedMode);

  return (
    <div className="flex flex-col text-xs font-mono text-right flex-shrink-0 w-24 tabular-nums">
      <span className={`${changeColorClass}`} title={changeTooltip}>{changeText}</span>
      <span className={`${priceColorClass} ${priceBlinkClass}`} title={`Current price: $${formattedPrice}`}>${formattedPrice}</span>
    </div>
  );
});

SymbolPrice.displayName = 'SymbolPrice';

interface SymbolVolumeProps {
  symbol: string;
  volumeInMillions: string;
}

const SymbolVolume = memo(({ symbol, volumeInMillions }: SymbolVolumeProps) => {
  const topSymbols = useTopSymbolsStore((state) => state.symbols);
  const topSymbolData = topSymbols.find(s => s.name === symbol);
  const volume = topSymbolData?.volume;
  const invertedMode = useSettingsStore((state) => state.settings.chart.invertedMode);

  const { volumeDirection } = usePriceVolumeAnimation(symbol, undefined, volume);

  const baseVolumeBlinkClass = volumeDirection === 'up'
    ? 'animate-blink-green'
    : volumeDirection === 'down'
    ? 'animate-blink-red'
    : '';
  const volumeBlinkClass = getInvertedAnimationClass(baseVolumeBlinkClass, invertedMode);

  return (
    <span
      className={`text-[10px] text-primary-muted font-mono ${volumeBlinkClass}`}
      title={`24h volume: $${volumeInMillions}M`}
    >
      ${volumeInMillions}M
    </span>
  );
});

SymbolVolume.displayName = 'SymbolVolume';

const VolatilityBlocks = memo(({ symbol }: SymbolPriceProps) => {
  const volatilityData = useSymbolVolatilityStore((state) => state.volatility[symbol]);

  const percentChange = volatilityData?.percentChange || 0;
  const tooltip = `24h change: ${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`;
  const colorClass = percentChange >= 0 ? 'text-bullish' : 'text-bearish';

  return (
    <div className="absolute inset-0 flex items-center justify-start pointer-events-none" title={tooltip}>
      <span className={`text-[10px] leading-none font-mono ${colorClass}`}>
        {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
      </span>
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

export default function Sidepanel({ selectedSymbol, onSymbolSelect, mobileView = 'all' }: SidepanelProps) {
  const router = useRouter();
  const address = useAddressFromUrl();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { results, status, runScan, startAutoScanWithDelay, stopAutoScan } = useScannerStore();
  const { settings, pinSymbol, unpinSymbol } = useSettingsStore();
  const invertedMode = settings.chart.invertedMode;
  const topSymbols = useTopSymbolsStore((state) => state.symbols);
  const isLoadingTopSymbols = useTopSymbolsStore((state) => state.isLoading);
  const startAutoRefresh = useTopSymbolsStore((state) => state.startAutoRefresh);
  const stopAutoRefresh = useTopSymbolsStore((state) => state.stopAutoRefresh);
  const fetchTopSymbols = useTopSymbolsStore((state) => state.fetchTopSymbols);
  const pinnedSymbols = settings.pinnedSymbols;
  const subscribe = useSidebarPricesStore((state) => state.subscribe);
  const unsubscribe = useSidebarPricesStore((state) => state.unsubscribe);
  const startPollingMultiple = usePositionStore((state) => state.startPollingMultiple);
  const stopPollingMultiple = usePositionStore((state) => state.stopPollingMultiple);
  const getPosition = usePositionStore((state) => state.getPosition);
  const { setService: setCandlesService, fetchClosePrices, getClosePrices } = useSymbolCandlesStore();
  const lastCandlePollTime = useGlobalPollingStore((state) => state.lastCandlePollTime);

  const orders = useOrderStore((state) => state.orders);
  const symbolsWithOrders = useMemo(() => {
    return Object.entries(orders)
      .filter(([_, orderList]) => orderList && orderList.length > 0)
      .map(([symbol]) => symbol);
  }, [orders]);

  const positions = usePositionStore((state) => state.positions);
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
  }, [settings.scanner.enabled, settings.scanner.scanInterval]);

  useEffect(() => {
    startAutoRefresh();

    return () => {
      stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    subscribe();

    return () => {
      unsubscribe();
    };
  }, []);

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

  useEffect(() => {
    const symbols = allSymbolsString.split(',').filter(s => s.length > 0);
    if (symbols.length > 0) {
      fetchClosePrices(symbols);

      const intervalId = setInterval(() => {
        fetchClosePrices(symbols);
      }, 5000);

      return () => clearInterval(intervalId);
    }
  }, [allSymbolsString, lastCandlePollTime]);

  const formatTimeSince = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const sortedSymbols = useMemo(() => {
    const symbols = [...allSymbolsToShow];

    // Sort all symbols by absolute value of 24h price change
    symbols.sort((a, b) => {
      const volatilityA = useSymbolVolatilityStore.getState().volatility[a];
      const volatilityB = useSymbolVolatilityStore.getState().volatility[b];
      const percentChangeA = volatilityA?.percentChange ?? 0;
      const percentChangeB = volatilityB?.percentChange ?? 0;
      return Math.abs(percentChangeB) - Math.abs(percentChangeA);
    });

    return symbols;
  }, [allSymbolsToShow]);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: sortedSymbols.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 62,
    overscan: 5,
  });

  const groupedScannerResults = useMemo(() => {
    return results.reduce((acc, result) => {
      if (!acc[result.symbol]) {
        acc[result.symbol] = [];
      }
      acc[result.symbol].push(result);
      return acc;
    }, {} as Record<string, typeof results>);
  }, [results]);

  const scannerParentRef = useRef<HTMLDivElement>(null);

  const scannerVirtualizer = useVirtualizer({
    count: results.length > 0 ? Object.keys(groupedScannerResults).length : 0,
    getScrollElement: () => scannerParentRef.current,
    estimateSize: () => 83,
    overscan: 3,
  });

  const processedScannerResults = useMemo(() => {
    return Object.entries(groupedScannerResults).map(([symbol, symbolResults]) => {
      const timeframeOrder: TimeInterval[] = ['1m', '5m'];

      const timeframeSignals = new Map<string, {
        stoch: boolean;
        ema: boolean;
        macd: boolean;
        rsi: boolean;
        vol: boolean;
        channel: string | null;
        sr: 'support' | 'resistance' | null;
        srDistance: number | null;
        srTouches: number | null;
        srPrice: number | null;
        signalType: 'bullish' | 'bearish';
      }>();

      const divergenceSignals: { variant: string; isHidden: boolean; signalType: 'bullish' | 'bearish' }[] = [];

      symbolResults.forEach((result) => {
        if (result.scanType === 'divergence' && result.divergences) {
          result.divergences.forEach(div => {
            const strength = div.strength ?? 0;
            const strengthLabel =
              strength >= 60 ? 'S+' :
              strength >= 40 ? 'S' :
              strength >= 30 ? 'M' : 'W';
            divergenceSignals.push({
              variant: strengthLabel,
              isHidden: div.type.includes('hidden'),
              signalType: result.signalType
            });
          });
          return;
        }

        const timeframes: string[] = [];
        if (result.stochastics) timeframes.push(...result.stochastics.map(s => s.timeframe));
        if (result.emaAlignments) timeframes.push(...result.emaAlignments.map(e => e.timeframe));
        if (result.macdReversals) timeframes.push(...result.macdReversals.map(m => m.timeframe));
        if (result.rsiReversals) timeframes.push(...result.rsiReversals.map(r => r.timeframe));
        if (result.volumeSpikes) timeframes.push(...result.volumeSpikes.map(v => v.timeframe));
        if (result.channels) timeframes.push(...result.channels.map(c => c.timeframe));
        if (result.supportResistanceLevels) timeframes.push(...result.supportResistanceLevels.map(sr => sr.timeframe));

        const uniqueTimeframes = [...new Set(timeframes)];

        uniqueTimeframes.forEach(tf => {
          if (!timeframeSignals.has(tf)) {
            timeframeSignals.set(tf, {
              stoch: false,
              ema: false,
              macd: false,
              rsi: false,
              vol: false,
              channel: null,
              sr: null,
              srDistance: null,
              srTouches: null,
              srPrice: null,
              signalType: result.signalType
            });
          }

          const tfData = timeframeSignals.get(tf)!;

          if (result.scanType === 'stochastic' && result.stochastics?.some(s => s.timeframe === tf)) {
            tfData.stoch = true;
          }
          if (result.scanType === 'emaAlignment' && result.emaAlignments?.some(e => e.timeframe === tf)) {
            tfData.ema = true;
          }
          if (result.scanType === 'macdReversal' && result.macdReversals?.some(m => m.timeframe === tf)) {
            tfData.macd = true;
          }
          if (result.scanType === 'rsiReversal' && result.rsiReversals?.some(r => r.timeframe === tf)) {
            tfData.rsi = true;
          }
          if (result.scanType === 'volumeSpike' && result.volumeSpikes?.some(v => v.timeframe === tf)) {
            tfData.vol = true;
          }
          if (result.scanType === 'channel' && result.channels) {
            const channel = result.channels.find(c => c.timeframe === tf);
            if (channel) {
              tfData.channel = channel.type === 'ascending' ? '↗' : channel.type === 'descending' ? '↘' : '→';
            }
          }
          if (result.scanType === 'supportResistance' && result.supportResistanceLevels) {
            const srLevel = result.supportResistanceLevels.find(sr => sr.timeframe === tf);
            if (srLevel) {
              tfData.sr = srLevel.nearLevel;
              const distance = srLevel.nearLevel === 'support'
                ? Math.abs(srLevel.distanceToSupport)
                : Math.abs(srLevel.distanceToResistance);
              const touches = srLevel.nearLevel === 'support'
                ? srLevel.supportTouches
                : srLevel.resistanceTouches;
              const price = srLevel.nearLevel === 'support'
                ? srLevel.supportLevel
                : srLevel.resistanceLevel;
              tfData.srDistance = distance;
              tfData.srTouches = touches;
              tfData.srPrice = price;
            }
          }
        });
      });

      const sortedTimeframes = Array.from(timeframeSignals.entries())
        .sort(([a], [b]) => timeframeOrder.indexOf(a as TimeInterval) - timeframeOrder.indexOf(b as TimeInterval));

      return {
        symbol,
        sortedTimeframes,
        divergenceSignals,
        closePrices: symbolResults[0]?.closePrices,
        signalType: symbolResults[0]?.signalType || 'bullish',
      };
    });
  }, [groupedScannerResults]);

  return (
    <div className="p-2 h-full flex gap-2 overflow-hidden">
      {/* Left Column - Scanner */}
      {settings.scanner.enabled && (mobileView === 'all' || mobileView === 'scanner') && (
        <div className={`${mobileView === 'scanner' ? 'w-full' : 'w-[200px]'} flex flex-col overflow-hidden flex-shrink-0`}>
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

          <div ref={scannerParentRef} className="flex-1 overflow-y-auto">
            {results.length > 0 && (
              <>
                <div className="text-xs text-primary-muted font-mono px-1 mb-1">
                  {Object.keys(groupedScannerResults).length} symbol{Object.keys(groupedScannerResults).length !== 1 ? 's' : ''} ({results.length} signal{results.length !== 1 ? 's' : ''})
                </div>
                <div
                  style={{
                    height: `${scannerVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {scannerVirtualizer.getVirtualItems().map((virtualRow) => {
                    const result = processedScannerResults[virtualRow.index];
                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <ScannerResultItem
                          symbol={result.symbol}
                          selectedSymbol={selectedSymbol}
                          onSymbolSelect={onSymbolSelect}
                          address={address || ''}
                          sortedTimeframes={result.sortedTimeframes}
                          divergenceSignals={result.divergenceSignals}
                          closePrices={result.closePrices}
                          signalType={result.signalType}
                          invertedMode={invertedMode}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Right Column - Symbols */}
      {(mobileView === 'all' || mobileView === 'symbols') && (
        <div className="flex-1 flex flex-col overflow-hidden gap-3">
          {/* Symbols Section */}
          {sortedSymbols.length > 0 && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="terminal-border p-2 mb-2">
              <div className="flex items-center justify-between">
                <span className="text-primary text-xs font-bold tracking-wider">█ SYMBOLS</span>
                <button
                  onClick={fetchTopSymbols}
                  disabled={isLoadingTopSymbols}
                  className="px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 active:bg-primary/30 active:scale-95 text-primary border border-primary rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer transition-all"
                  title="Refresh symbols list"
                >
                  {isLoadingTopSymbols ? '⟳ LOADING...' : '⟳ REFRESH'}
                </button>
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
                          className="flex items-center hover:bg-primary/10 transition-all duration-150"
                        >
                          <button
                            onClick={() => {
                              if (onSymbolSelect) {
                                onSymbolSelect(symbol);
                              } else {
                                router.push(`/${address}/${symbol}`);
                              }
                            }}
                            className="flex-1 text-left p-2 cursor-pointer active:scale-[0.98] transition-transform duration-100"
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
                            className="p-2 text-primary-muted hover:text-primary active:scale-90 cursor-pointer transition-all duration-150"
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

            <div ref={parentRef} className="flex-1 overflow-y-auto">
              {isLoadingTopSymbols && topSymbols.length === 0 ? (
                <>
                  <SymbolItemSkeleton />
                  <SymbolItemSkeleton />
                  <SymbolItemSkeleton />
                </>
              ) : (
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const symbol = sortedSymbols[virtualRow.index];
                    const isPinned = pinnedSymbols.includes(symbol);
                    const top20Data = topSymbols.find(s => s.name === symbol);
                    const isTop20 = !!top20Data;
                    const volumeInMillions = top20Data ? (top20Data.volume / 1000000).toFixed(1) : null;
                    const symbolClosePrices = getClosePrices(symbol);

                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <SymbolItem
                          symbol={symbol}
                          selectedSymbol={selectedSymbol}
                          onSymbolSelect={onSymbolSelect}
                          address={address || ''}
                          isPinned={isPinned}
                          isTop20={isTop20}
                          volumeInMillions={volumeInMillions}
                          closePrices={symbolClosePrices || undefined}
                          unpinSymbol={unpinSymbol}
                          SymbolPrice={SymbolPrice}
                          SymbolVolume={SymbolVolume}
                          invertedMode={invertedMode}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}
