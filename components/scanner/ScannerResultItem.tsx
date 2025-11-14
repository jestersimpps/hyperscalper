'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import MiniPriceChart from '@/components/scanner/MiniPriceChart';
import {
  getInvertedColorClass,
  getInvertedArrow,
} from '@/lib/inverted-utils';
import type { TimeInterval } from '@/types';

interface ProcessedSignal {
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
}

interface DivergenceSignal {
  variant: string;
  isHidden: boolean;
  signalType: 'bullish' | 'bearish';
}

interface ScannerResultItemProps {
  symbol: string;
  selectedSymbol: string;
  onSymbolSelect?: (symbol: string) => void;
  address: string;
  sortedTimeframes: [string, ProcessedSignal][];
  divergenceSignals: DivergenceSignal[];
  closePrices?: number[];
  signalType: 'bullish' | 'bearish';
  invertedMode: boolean;
}

const ScannerResultItem = ({
  symbol,
  selectedSymbol,
  onSymbolSelect,
  address,
  sortedTimeframes,
  divergenceSignals,
  closePrices,
  signalType,
  invertedMode,
}: ScannerResultItemProps) => {
  const router = useRouter();

  return (
    <div
      onClick={() => {
        if (onSymbolSelect) {
          onSymbolSelect(symbol);
        } else {
          router.push(`/${address}/${symbol}`);
        }
      }}
      className={`h-[80px] ${
        selectedSymbol === symbol
          ? 'border-2 border-primary'
          : 'terminal-border hover:bg-primary/10'
      } cursor-pointer active:scale-[0.98] transition-all duration-150`}
    >
      <div className="flex items-start">
        <div className="flex flex-col flex-1 relative">
          {closePrices && closePrices.length > 0 && (
            <div className="absolute inset-0 opacity-50 pointer-events-none">
              <MiniPriceChart
                closePrices={closePrices}
                signalType={signalType}
                invertedMode={invertedMode}
              />
            </div>
          )}
          <div className="p-2 pb-1 relative z-10">
            <span className="text-primary font-bold text-xs">{symbol}/USD</span>
          </div>

          <div className="px-2 pb-2 space-y-1 relative z-10">
            {sortedTimeframes.map(([timeframe, signals]) => {
              const baseArrow = signals.signalType === 'bullish' ? '▲' : '▼';
              const arrow = getInvertedArrow(baseArrow as '▲' | '▼', invertedMode);
              const baseArrowColor = signals.signalType === 'bullish' ? 'text-bullish' : 'text-bearish';
              const arrowColor = getInvertedColorClass(baseArrowColor, invertedMode);
              const baseBadgeBg = signals.signalType === 'bullish' ? 'bg-bullish' : 'bg-bearish';
              const badgeBg = getInvertedColorClass(baseBadgeBg, invertedMode);

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
                    {signals.sr && (() => {
                      const baseSrBg = signals.sr === 'support' ? 'bg-bullish' : 'bg-bearish';
                      const srBg = getInvertedColorClass(baseSrBg, invertedMode);
                      const displaySrType = invertedMode
                        ? (signals.sr === 'support' ? 'resistance' : 'support')
                        : signals.sr;
                      const displayLabel = displaySrType === 'support' ? 'S' : 'R';
                      return (
                        <span className={`${srBg} text-bg-primary px-1.5 py-0.5 rounded font-bold`} title={`${displaySrType === 'support' ? 'Support' : 'Resistance'} level at $${signals.srPrice?.toFixed(2)}: ${signals.srDistance?.toFixed(2)}% away, ${signals.srTouches} touches`}>
                          {displayLabel} ${signals.srPrice?.toFixed(2)} {signals.srDistance?.toFixed(1)}% ({signals.srTouches})
                        </span>
                      );
                    })()}
                  </div>
                </div>
              );
            })}

            {divergenceSignals.length > 0 && (
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-primary-muted font-mono">DIV:</span>
                <div className="flex gap-1 flex-wrap">
                  {divergenceSignals.map((div, idx) => {
                    const baseBadgeBg = div.signalType === 'bullish' ? 'bg-bullish' : 'bg-bearish';
                    const badgeBg = getInvertedColorClass(baseBadgeBg, invertedMode);
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
};

ScannerResultItem.displayName = 'ScannerResultItem';

function areEqual(prevProps: ScannerResultItemProps, nextProps: ScannerResultItemProps) {
  if (prevProps.symbol !== nextProps.symbol) return false;
  if (prevProps.selectedSymbol !== nextProps.selectedSymbol) return false;
  if (prevProps.invertedMode !== nextProps.invertedMode) return false;
  if (prevProps.signalType !== nextProps.signalType) return false;
  if (prevProps.sortedTimeframes.length !== nextProps.sortedTimeframes.length) return false;
  if (prevProps.divergenceSignals.length !== nextProps.divergenceSignals.length) return false;

  if (prevProps.closePrices?.length !== nextProps.closePrices?.length) return false;
  if (prevProps.closePrices && nextProps.closePrices) {
    const prevLast = prevProps.closePrices[prevProps.closePrices.length - 1];
    const nextLast = nextProps.closePrices[nextProps.closePrices.length - 1];
    if (prevLast !== nextLast) return false;
  }

  return true;
}

export default memo(ScannerResultItem, areEqual);
