import { memo } from 'react';
import { usePositionStore } from '@/stores/usePositionStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';

interface PositionPriceIndicatorProps {
  symbol: string;
}

export const PositionPriceIndicator = memo(({ symbol }: PositionPriceIndicatorProps) => {
  const position = usePositionStore((state) => state.positions[symbol]);
  const orders = useOrderStore((state) => state.orders[symbol]) || [];

  if (!position || position.size === 0) {
    return null;
  }

  const stopLossOrder = orders.find((o: any) => o.orderType === 'stop');
  const takeProfitOrder = orders.find((o: any) => o.orderType === 'trigger');

  const entryPrice = position.entryPrice;
  const currentPrice = position.currentPrice;
  const slPrice = stopLossOrder?.price;
  const tpPrice = takeProfitOrder?.price;

  if (!slPrice && !tpPrice) {
    return null;
  }

  const isLong = position.side === 'long';

  let leftPrice: number;
  let rightPrice: number;

  if (slPrice && tpPrice) {
    leftPrice = slPrice;
    rightPrice = tpPrice;
  } else if (slPrice && !tpPrice) {
    leftPrice = slPrice;
    const slToEntry = Math.abs(entryPrice - slPrice);
    rightPrice = entryPrice + slToEntry;
  } else {
    const tpToEntry = Math.abs(tpPrice! - entryPrice);
    leftPrice = entryPrice - tpToEntry;
    rightPrice = tpPrice!;
  }

  const priceRange = rightPrice - leftPrice;

  if (priceRange === 0) {
    return null;
  }

  const getPositionPercent = (price: number) => {
    const percent = ((price - leftPrice) / priceRange) * 100;
    return Math.max(0, Math.min(100, percent));
  };

  const decimals = useSymbolMetaStore.getState().getDecimals(symbol);

  const formatPriceValue = (price: number) => {
    return price.toFixed(decimals.price);
  };

  const slPercent = slPrice ? getPositionPercent(slPrice) : null;
  const entryPercent = getPositionPercent(entryPrice);
  const tpPercent = tpPrice ? getPositionPercent(tpPrice) : null;
  const currentPercent = getPositionPercent(currentPrice);

  return (
    <div className="w-full mt-1 pb-4 flex items-center gap-2">
      <div className="relative h-4 flex-1">
        <div className="absolute inset-0 rounded-sm bg-gradient-to-r from-bearish/10 via-transparent to-bullish/10" />

        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-primary-muted/30" />

        {slPercent !== null && (
          <div
            className="absolute top-0 bottom-0 flex flex-col items-start justify-center"
            style={{ left: `${slPercent}%` }}
            title={`Stop Loss: $${formatPriceValue(slPrice!)}`}
          >
            <div className="w-[2px] h-full bg-bearish" />
            <div className="absolute -bottom-3 left-0 text-[8px] text-primary-muted font-mono whitespace-nowrap pl-1">
              {formatPriceValue(slPrice!)}
            </div>
          </div>
        )}

        <div
          className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
          style={{ left: `${entryPercent}%` }}
          title={`Entry Price: $${formatPriceValue(entryPrice)}`}
        >
          <div className="w-[2px] h-full bg-primary" />
          <div className="absolute -bottom-3 text-[8px] text-primary font-mono font-bold whitespace-nowrap">
            {formatPriceValue(entryPrice)}
          </div>
        </div>

        {tpPercent !== null && (
          <div
            className="absolute top-0 bottom-0 flex flex-col items-end justify-center"
            style={{ left: `${tpPercent}%` }}
            title={`Take Profit: $${formatPriceValue(tpPrice!)}`}
          >
            <div className="w-[2px] h-full bg-bullish" />
            <div className="absolute -bottom-3 right-0 text-[8px] text-primary-muted font-mono whitespace-nowrap pr-1">
              {formatPriceValue(tpPrice!)}
            </div>
          </div>
        )}

        <div
          className="absolute top-0 bottom-0 flex items-center justify-center"
          style={{ left: `${currentPercent}%` }}
          title={`Current Price: $${formatPriceValue(currentPrice)}`}
        >
          <div className="w-1 h-full bg-primary opacity-70" />
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          // TODO: Implement emergency close
          console.log('Emergency close:', symbol);
        }}
        className="px-2 py-0.5 text-[9px] bg-bearish/10 hover:bg-bearish/20 text-bearish border border-bearish rounded cursor-pointer transition-colors font-bold flex-shrink-0"
        title="Emergency close position"
      >
        CLOSE
      </button>
    </div>
  );
});

PositionPriceIndicator.displayName = 'PositionPriceIndicator';
