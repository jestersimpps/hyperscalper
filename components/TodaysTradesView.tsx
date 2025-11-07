'use client';

import { memo, useMemo, useEffect } from 'react';
import { useUserFillsStore } from '@/stores/useUserFillsStore';
import { useHyperliquidService } from '@/lib/hooks/use-hyperliquid-service';
import { groupFillsByPosition } from '@/lib/trade-grouping-utils';
import TradeRow from '@/components/trades/TradeRow';

function TodaysTradesView() {
  const service = useHyperliquidService();
  const fills = useUserFillsStore((state) => state.fills);
  const loading = useUserFillsStore((state) => state.loading);
  const error = useUserFillsStore((state) => state.error);
  const setService = useUserFillsStore((state) => state.setService);
  const fetchTodaysFills = useUserFillsStore((state) => state.fetchTodaysFills);

  useEffect(() => {
    if (service) {
      setService(service);
      fetchTodaysFills();
    }
  }, [service, setService, fetchTodaysFills]);

  const currentDate = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  const positionGroups = useMemo(() => {
    return groupFillsByPosition(fills);
  }, [fills]);

  const totalPnl = useMemo(() => {
    return positionGroups.reduce((sum, group) => sum + group.totalPnl, 0);
  }, [positionGroups]);

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <div className="flex flex-col h-full w-full p-2 gap-2">
        <div className="terminal-border p-1.5">
          <div className="flex justify-between items-center">
            <div className="terminal-text">
              <span className="text-primary text-sm font-bold tracking-wider">█ TODAY'S TRADES</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-[10px]">
                <div className="text-primary-muted">{currentDate}</div>
              </div>
              <div className="text-right text-[10px]">
                <div className="text-primary-muted">TOTAL P&L:</div>
                <div className={totalPnl >= 0 ? 'text-bullish' : 'text-bearish'}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USD
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="terminal-border p-1.5 flex flex-col flex-1 min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="text-[12px] text-primary-muted font-mono animate-pulse">
                  Loading trades...
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="text-[12px] text-bearish font-mono">
                  Error: {error}
                </div>
              </div>
            </div>
          ) : positionGroups.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="text-2xl text-primary-muted">📊</div>
                <div className="text-[12px] text-primary-muted font-mono">
                  No trades today
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto space-y-2">
              {positionGroups.map((group) => (
                <TradeRow key={group.id} group={group} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TodaysTradesView);
