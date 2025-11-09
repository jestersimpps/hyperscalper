'use client';

import React, { memo } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useScannerStore } from '@/stores/useScannerStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTopSymbolsStore } from '@/stores/useTopSymbolsStore';
import { useSidebarPricesStore } from '@/stores/useSidebarPricesStore';
import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { useSymbolVolatilityStore } from '@/stores/useSymbolVolatilityStore';
import { useSymbolCandlesStore } from '@/stores/useSymbolCandlesStore';
import { formatPrice } from '@/lib/format-utils';
import { useAddressFromUrl } from '@/lib/hooks/use-address-from-url';
import { PositionPriceIndicator } from '@/components/PositionPriceIndicator';
import { usePositionAnimations } from '@/hooks/usePositionAnimations';
import { usePriceVolumeAnimation } from '@/hooks/usePriceVolumeAnimation';
import MiniPriceChart from '@/components/scanner/MiniPriceChart';
import type { TimeInterval } from '@/types';

interface SidepanelProps {
  selectedSymbol: string;
  onSymbolSelect?: (symbol: string) => void;
}

interface SymbolPriceProps {
  symbol: string;
  pnlAnimationClass?: string;
  closePrices?: number[];
}

const SymbolPrice = memo(({ symbol, pnlAnimationClass, closePrices }: SymbolPriceProps) => {
  const price = useSidebarPricesStore((state) => state.prices[symbol]);
  const position = usePositionStore((state) => state.positions[symbol]);

  const { priceDirection } = usePriceVolumeAnimation(symbol, closePrices, undefined);

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

  let priceTrend: 'up' | 'down' | null = null;
  if (closePrices && closePrices.length >= 5) {
    const last5 = closePrices.slice(-5);
    priceTrend = last5[last5.length - 1] > last5[0] ? 'up' : 'down';
  }

  const priceColorClass = priceTrend === 'up'
    ? 'text-bullish'
    : priceTrend === 'down'
    ? 'text-bearish'
    : 'text-primary-muted';

  const priceBlinkClass = priceDirection === 'up'
    ? 'animate-blink-green'
    : priceDirection === 'down'
    ? 'animate-blink-red'
    : '';

  return (
    <div className="flex flex-col text-xs font-mono text-right flex-shrink-0 w-24 tabular-nums">
      <span className={`${pnlColorClass} ${pnlAnimationClass || ''}`} title={pnlTooltip}>{pnlText}</span>
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

  const { volumeDirection } = usePriceVolumeAnimation(symbol, undefined, volume);

  const volumeBlinkClass = volumeDirection === 'up'
    ? 'animate-blink-green'
    : volumeDirection === 'down'
    ? 'animate-blink-red'
    : '';

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

  const blocks = volatilityData?.blocks || 0;
  const percentChange = volatilityData?.percentChange || 0;
  const tooltip = `24h change: ${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`;

  return (
    <div className="absolute inset-0 flex gap-px items-center opacity-30 pointer-events-none" title={tooltip}>
      {Array.from({ length: 10 }).map((_, index) => (
        <span
          key={index}
          className={`text-[6px] leading-none ${index < blocks ? 'text-primary' : 'text-primary/20'}`}
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
  const fetchTopSymbols = useTopSymbolsStore((state) => state.fetchTopSymbols);
  const pinnedSymbols = settings.pinnedSymbols;
  const subscribe = useSidebarPricesStore((state) => state.subscribe);
  const unsubscribe = useSidebarPricesStore((state) => state.unsubscribe);
  const startPollingMultiple = usePositionStore((state) => state.startPollingMultiple);
  const stopPollingMultiple = usePositionStore((state) => state.stopPollingMultiple);
  const getPosition = usePositionStore((state) => state.getPosition);
  const positions = usePositionStore((state) => state.positions);
  const orders = useOrderStore((state) => state.orders);
  const { setService: setCandlesService, fetchClosePrices, getClosePrices } = useSymbolCandlesStore();

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
      }, 60000);

      return () => clearInterval(intervalId);
    }
  }, [allSymbolsString, fetchClosePrices]);

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

    // Sort symbols without positions by volatility
    withoutPositions.sort((a, b) => {
      const volatilityA = useSymbolVolatilityStore.getState().volatility[a];
      const volatilityB = useSymbolVolatilityStore.getState().volatility[b];
      const blocksA = volatilityA?.blocks ?? 0;
      const blocksB = volatilityB?.blocks ?? 0;
      return blocksB - blocksA;
    });

    return { symbolsWithOpenPositions: withPositions, symbolsWithoutPositions: withoutPositions };
  }, [allSymbolsToShow, getPosition, positions]);

  const [positionListRef] = useAutoAnimate();
  const positionAnimations = usePositionAnimations(symbolsWithOpenPositions, positions);

  return (
    <div className="p-2 h-full flex gap-2 overflow-hidden">
      {/* Left Column - Scanner */}
      {settings.scanner.enabled && (
        <div className="flex-[0.4] flex flex-col overflow-hidden">
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
                  const timeframeOrder: TimeInterval[] = ['1m', '5m'];

                  const timeframeSignals = new Map<string, {
                    stoch: boolean;
                    ema: boolean;
                    macd: boolean;
                    rsi: boolean;
                    vol: boolean;
                    channel: string | null;
                    signalType: 'bullish' | 'bearish';
                  }>();

                  const divergenceSignals: { variant: string; isHidden: boolean; signalType: 'bullish' | 'bearish' }[] = [];

                  symbolResults.forEach((result) => {
                    if (result.scanType === 'divergence' && result.divergences) {
                      result.divergences.forEach(div => {
                        const variantLabel =
                          div.variant === 'ultraFast' ? 'UF' :
                          div.variant === 'fast' ? 'F' :
                          div.variant === 'medium' ? 'M' : 'S';
                        divergenceSignals.push({
                          variant: variantLabel,
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
                    });
                  });

                  const sortedTimeframes = Array.from(timeframeSignals.entries())
                    .sort(([a], [b]) => timeframeOrder.indexOf(a as TimeInterval) - timeframeOrder.indexOf(b as TimeInterval));

                  return (
                    <div
                      key={symbol}
                      onClick={() => {
                        if (onSymbolSelect) {
                          onSymbolSelect(symbol);
                        } else {
                          router.push(`/${address}/${symbol}`);
                        }
                      }}
                      className={`${
                        selectedSymbol === symbol
                          ? 'terminal-border bg-primary/20'
                          : 'terminal-border hover:bg-primary/5'
                      } cursor-pointer`}
                    >
                      <div className="flex items-start">
                        <div className="flex flex-col flex-1 relative">
                          {symbolResults[0]?.closePrices && symbolResults[0].closePrices.length > 0 && (
                            <div className="absolute inset-0 opacity-20 pointer-events-none">
                              <MiniPriceChart
                                closePrices={symbolResults[0].closePrices}
                                signalType={symbolResults[0].signalType}
                              />
                            </div>
                          )}
                          <div className="p-2 pb-1 relative z-10">
                            <span className="text-primary font-bold text-xs">{symbol}/USD</span>
                          </div>

                          <div className="px-2 pb-2 space-y-1 relative z-10">
                            {sortedTimeframes.map(([timeframe, signals]) => {
                              const arrow = signals.signalType === 'bullish' ? '▲' : '▼';
                              const arrowColor = signals.signalType === 'bullish' ? 'text-bullish' : 'text-bearish';
                              const badgeBg = signals.signalType === 'bullish' ? 'bg-bullish' : 'bg-bearish';

                              return (
                                <div key={timeframe} className="flex items-center gap-1 text-[10px]">
                                  <span className={`${arrowColor} font-bold`}>{arrow}</span>
                                  <span className="text-primary-muted font-mono w-8">{timeframe}:</span>
                                  <div className="flex gap-1 flex-wrap">
                                    {signals.stoch && (
                                      <span className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded font-bold`}>STOCH</span>
                                    )}
                                    {signals.ema && (
                                      <span className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded font-bold`}>EMA</span>
                                    )}
                                    {signals.macd && (
                                      <span className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded font-bold`}>MACD</span>
                                    )}
                                    {signals.rsi && (
                                      <span className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded font-bold`}>RSI</span>
                                    )}
                                    {signals.vol && (
                                      <span className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded font-bold`}>VOL</span>
                                    )}
                                    {signals.channel && (
                                      <span className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded font-bold`}>{signals.channel}CH</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {divergenceSignals.length > 0 && (
                              <div className="flex items-center gap-1 text-[10px]">
                                <span className="text-primary-muted font-mono">DIV:</span>
                                <div className="flex gap-1 flex-wrap">
                                  {divergenceSignals.map((div, idx) => {
                                    const badgeBg = div.signalType === 'bullish' ? 'bg-bullish' : 'bg-bearish';
                                    return (
                                      <span key={idx} className={`${badgeBg} text-bg-primary px-1.5 py-0.5 rounded font-bold`}>
                                        {div.isHidden ? 'H-' : ''}{div.variant}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
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
                  );
                })}
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Right Column - Symbols */}
      <div className="flex-[0.6] flex flex-col overflow-hidden gap-3">
        {/* Open Positions Section */}
        {symbolsWithOpenPositions.length > 0 && (
          <div className="flex-shrink-0">
            <div className="terminal-border p-1.5 mb-2">
              <div className="terminal-text text-center">
                <span className="text-primary text-xs font-bold tracking-wider">█ OPEN POSITIONS</span>
              </div>
            </div>
            <div ref={positionListRef} className="flex flex-col gap-1 max-h-96 overflow-y-auto">
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

            const animationState = positionAnimations[symbol];
            const itemAnimationClass = animationState?.isNew
              ? animationState.side === 'long' ? 'animate-highlight-new-long' : 'animate-highlight-new-short'
              : animationState?.sizeChange ? 'animate-pulse-scale' : '';

            const pnlAnimationClass = animationState?.pnlChange === 'increase'
              ? 'animate-flash-pnl-increase'
              : animationState?.pnlChange === 'decrease'
              ? 'animate-flash-pnl-decrease'
              : '';

            const symbolClosePrices = getClosePrices(symbol);

            return (
            <div
              key={symbol}
              className={`${
                selectedSymbol === symbol
                  ? 'terminal-border bg-primary/20'
                  : 'terminal-border hover:bg-primary/5'
              } ${itemAnimationClass}`}
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
                  className="flex-1 text-left p-2 pb-0 cursor-pointer relative"
                >
                  {symbolClosePrices && symbolClosePrices.length > 0 && (
                    <div className="absolute inset-y-0 left-0 right-[40%] opacity-20 pointer-events-none">
                      <MiniPriceChart
                        closePrices={symbolClosePrices}
                      />
                    </div>
                  )}
                  <div className="flex justify-between items-stretch gap-2 relative z-10">
                    <div className="flex flex-col justify-between min-w-0 relative">
                      <VolatilityBlocks symbol={symbol} />
                      <div className="flex items-center gap-2 relative z-10">
                        <span
                          className={`font-bold flex-shrink-0 text-xs ${
                            positions[symbol] && positions[symbol].size > 0
                              ? `animate-pulse ${positions[symbol].side === 'long' ? 'text-bullish' : 'text-bearish'}`
                              : 'text-primary'
                          }`}
                          title={positions[symbol] && positions[symbol].size > 0
                            ? `${positions[symbol].side === 'long' ? 'Long' : 'Short'} position volume: $${(Math.abs(positions[symbol].size * positions[symbol].currentPrice)).toFixed(2)}`
                            : `${symbol}/USD trading pair`
                          }
                        >
                          {positions[symbol] && positions[symbol].size > 0 && (
                            <>
                              ${(Math.abs(positions[symbol].size * positions[symbol].currentPrice)).toFixed(0)}{' '}
                              {positions[symbol].side.toUpperCase()}{' '}
                            </>
                          )}
                          {symbol}/USD
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      {/* Reserved space for minimal chart */}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <SymbolPrice symbol={symbol} pnlAnimationClass={pnlAnimationClass} closePrices={symbolClosePrices || undefined} />
                      {volumeInMillions && (
                        <SymbolVolume symbol={symbol} volumeInMillions={volumeInMillions} />
                      )}
                    </div>
                  </div>
                </button>
                <div className="px-2 relative z-10">
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
                            className="flex-1 text-left p-2 cursor-pointer"
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
                  const symbolClosePrices = getClosePrices(symbol);

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
                          className="flex-1 text-left p-2 pb-0 cursor-pointer relative"
                        >
                          {symbolClosePrices && symbolClosePrices.length > 0 && (
                            <div className="absolute inset-y-0 left-0 right-[40%] opacity-20 pointer-events-none">
                              <MiniPriceChart
                                closePrices={symbolClosePrices}
                              />
                            </div>
                          )}
                          <div className="flex justify-between items-stretch gap-2 relative z-10">
                            <div className="flex flex-col justify-between min-w-0 relative">
                              <VolatilityBlocks symbol={symbol} />
                              <div className="flex items-center gap-2 relative z-10">
                                <span
                                  className="text-primary font-bold flex-shrink-0 text-xs"
                                  title={`${symbol}/USD trading pair`}
                                >
                                  {symbol}/USD
                                </span>
                              </div>
                            </div>
                            <div className="flex-1">
                              {/* Reserved space for minimal chart */}
                            </div>
                            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                              <SymbolPrice symbol={symbol} closePrices={symbolClosePrices || undefined} />
                              {volumeInMillions && (
                                <SymbolVolume symbol={symbol} volumeInMillions={volumeInMillions} />
                              )}
                            </div>
                          </div>
                        </button>
                        <div className="px-2 relative z-10">
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
