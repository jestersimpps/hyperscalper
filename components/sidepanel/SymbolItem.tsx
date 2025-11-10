'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { PositionPriceIndicator } from '@/components/PositionPriceIndicator';
import MiniPriceChart from '@/components/scanner/MiniPriceChart';

interface SymbolItemProps {
  symbol: string;
  selectedSymbol: string;
  onSymbolSelect?: (symbol: string) => void;
  address: string;
  isPinned: boolean;
  isTop20: boolean;
  volumeInMillions: string | null;
  closePrices?: number[];
  unpinSymbol: (symbol: string) => void;
  SymbolPrice: React.ComponentType<{ symbol: string; pnlAnimationClass?: string; closePrices?: number[]; show24hChange?: boolean }>;
  SymbolVolume: React.ComponentType<{ symbol: string; volumeInMillions: string }>;
  invertedMode: boolean;
}

const SymbolItem = memo(({
  symbol,
  selectedSymbol,
  onSymbolSelect,
  address,
  isPinned,
  isTop20,
  volumeInMillions,
  closePrices,
  unpinSymbol,
  SymbolPrice,
  SymbolVolume,
  invertedMode
}: SymbolItemProps) => {
  const router = useRouter();
  const isSelected = selectedSymbol === symbol;

  return (
    <div
      className={`${
        isSelected
          ? 'border-2 border-primary'
          : 'terminal-border hover:bg-primary/10'
      } transition-all duration-150`}
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
            className="flex-1 text-left p-2 pb-0 cursor-pointer relative active:scale-[0.98] transition-transform duration-100"
          >
            {closePrices && closePrices.length > 0 && (
              <div className="absolute inset-y-0 left-0 right-[40%] opacity-50 pointer-events-none">
                <MiniPriceChart closePrices={closePrices} invertedMode={invertedMode} />
              </div>
            )}
            <div className="flex justify-between items-stretch gap-2 relative z-10">
              <div className="flex flex-col justify-between min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-primary font-bold flex-shrink-0 text-xs"
                    title={`${symbol}/USD trading pair`}
                  >
                    {symbol}/USD
                  </span>
                </div>
              </div>
              <div className="flex-1">
              </div>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <SymbolPrice symbol={symbol} closePrices={closePrices} show24hChange={true} />
                {volumeInMillions && (
                  <SymbolVolume symbol={symbol} volumeInMillions={volumeInMillions} />
                )}
              </div>
            </div>
          </button>
          <div className="px-2 relative z-10">
            <PositionPriceIndicator symbol={symbol} invertedMode={invertedMode} />
          </div>
        </div>
        <div className="flex flex-col">
          {!isTop20 && isPinned && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                unpinSymbol(symbol);
              }}
              className="p-2 text-primary-muted hover:text-bearish active:scale-90 cursor-pointer transition-all duration-150"
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
            className="p-2 text-primary-muted hover:text-primary active:scale-90 cursor-pointer transition-all duration-150"
            title="Open in new window"
          >
            <span className="text-lg">⧉</span>
          </button>
        </div>
      </div>
    </div>
  );
});

SymbolItem.displayName = 'SymbolItem';

export default SymbolItem;
