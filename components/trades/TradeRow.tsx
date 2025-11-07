'use client';

import { memo, useState } from 'react';
import type { PositionGroup } from '@/lib/trade-grouping-utils';

interface TradeRowProps {
  group: PositionGroup;
}

function TradeRow({ group }: TradeRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatPrice = (price: number): string => {
    return price.toFixed(price < 1 ? 4 : 2);
  };

  const formatSize = (size: number): string => {
    return size.toFixed(4);
  };

  const pnlColor = group.totalPnl >= 0 ? 'text-bullish' : 'text-bearish';
  const sideColor = group.side === 'long' ? 'text-bullish' : 'text-bearish';

  return (
    <div className="terminal-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-2 py-1.5 hover:bg-primary/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-3">
            <span className="text-primary-muted">{isExpanded ? '▼' : '▶'}</span>
            <span className={`font-bold ${sideColor}`}>{group.coin}</span>
            <span className="text-primary-muted">{formatTime(group.exitTime)}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-primary-muted">AVG ENTRY</div>
              <div className="text-primary">{formatPrice(group.averageEntry)}</div>
            </div>
            <div className="text-right">
              <div className="text-primary-muted">QTY</div>
              <div className="text-primary">{formatSize(group.totalQuantity)}</div>
            </div>
            <div className="text-right min-w-[80px]">
              <div className="text-primary-muted">P&L</div>
              <div className={pnlColor}>
                {group.totalPnl >= 0 ? '+' : ''}{group.totalPnl.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t-2 border-frame px-2 py-1 bg-bg-secondary">
          <div className="space-y-0.5">
            {group.fills.map((fill, index) => (
              <div
                key={`${fill.tid}-${index}`}
                className="flex items-center justify-between text-[10px] font-mono text-primary-muted pl-6 py-0.5"
              >
                <div className="flex items-center gap-3">
                  <span className="w-16">{formatTime(fill.time)}</span>
                  <span className={`w-12 ${fill.side === 'buy' ? 'text-bullish' : 'text-bearish'}`}>
                    {fill.side.toUpperCase()}
                  </span>
                  <span className="w-20 text-primary">{formatPrice(fill.price)}</span>
                  <span className="w-16 text-primary">{formatSize(fill.size)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-16 text-right">
                    {fill.closedPnl !== 0 && (
                      <span className={fill.closedPnl >= 0 ? 'text-bullish' : 'text-bearish'}>
                        {fill.closedPnl >= 0 ? '+' : ''}{fill.closedPnl.toFixed(2)}
                      </span>
                    )}
                  </span>
                  <span className="w-16 text-right text-primary-muted/60">
                    {fill.fee !== 0 && `${fill.fee >= 0 ? '' : '+'}${Math.abs(fill.fee).toFixed(2)}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(TradeRow);
