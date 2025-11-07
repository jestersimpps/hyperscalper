'use client';

import { memo, useMemo } from 'react';
import type { PositionGroup } from '@/lib/trade-grouping-utils';

interface StatisticsPanelProps {
  groups: PositionGroup[];
}

function StatisticsPanel({ groups }: StatisticsPanelProps) {
  const stats = useMemo(() => {
    if (groups.length === 0) {
      return {
        totalTrades: 0,
        winCount: 0,
        lossCount: 0,
        winRate: 0,
        averagePnl: 0,
        bestTrade: null as { coin: string; pnl: number } | null,
        worstTrade: null as { coin: string; pnl: number } | null,
        totalFees: 0
      };
    }

    const winCount = groups.filter(g => g.totalPnl > 0).length;
    const lossCount = groups.filter(g => g.totalPnl < 0).length;
    const winRate = (winCount / groups.length) * 100;

    const totalPnl = groups.reduce((sum, g) => sum + g.totalPnl, 0);
    const averagePnl = totalPnl / groups.length;

    const bestTrade = groups.reduce((best, g) =>
      !best || g.totalPnl > best.totalPnl ? g : best
    );

    const worstTrade = groups.reduce((worst, g) =>
      !worst || g.totalPnl < worst.totalPnl ? g : worst
    );

    const totalFees = groups.reduce((sum, g) => sum + g.totalFees, 0);

    return {
      totalTrades: groups.length,
      winCount,
      lossCount,
      winRate,
      averagePnl,
      bestTrade: { coin: bestTrade.coin, pnl: bestTrade.totalPnl },
      worstTrade: { coin: worstTrade.coin, pnl: worstTrade.totalPnl },
      totalFees
    };
  }, [groups]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 font-mono text-[10px]">
      {/* Win Rate and Trade Count */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="terminal-border p-1.5">
          <div className="text-primary-muted uppercase text-[8px] mb-0.5">Win Rate</div>
          <div className={`text-sm font-bold ${stats.winRate >= 50 ? 'text-bullish' : 'text-bearish'}`}>
            {stats.winRate.toFixed(1)}%
          </div>
          <div className="text-primary-muted text-[8px]">
            {stats.winCount}W / {stats.lossCount}L
          </div>
        </div>

        <div className="terminal-border p-1.5">
          <div className="text-primary-muted uppercase text-[8px] mb-0.5">Trades</div>
          <div className="text-sm font-bold text-primary">
            {stats.totalTrades}
          </div>
        </div>
      </div>

      {/* Average P&L */}
      <div className="terminal-border p-1.5">
        <div className="text-primary-muted uppercase text-[8px] mb-0.5">Avg P&L</div>
        <div className={`text-sm font-bold ${stats.averagePnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
          {stats.averagePnl >= 0 ? '+' : ''}${stats.averagePnl.toFixed(2)}
        </div>
      </div>

      {/* Best/Worst Trades */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="terminal-border p-1.5">
          <div className="text-primary-muted uppercase text-[8px] mb-0.5">Best</div>
          <div className="text-bullish font-bold text-[11px]">
            {stats.bestTrade ? `+$${stats.bestTrade.pnl.toFixed(2)}` : '--'}
          </div>
          <div className="text-primary-muted text-[8px]">
            {stats.bestTrade?.coin || '--'}
          </div>
        </div>

        <div className="terminal-border p-1.5">
          <div className="text-primary-muted uppercase text-[8px] mb-0.5">Worst</div>
          <div className="text-bearish font-bold text-[11px]">
            {stats.worstTrade ? `${stats.worstTrade.pnl >= 0 ? '+' : ''}$${stats.worstTrade.pnl.toFixed(2)}` : '--'}
          </div>
          <div className="text-primary-muted text-[8px]">
            {stats.worstTrade?.coin || '--'}
          </div>
        </div>
      </div>

      {/* Total Fees */}
      <div className="terminal-border p-1.5">
        <div className="text-primary-muted uppercase text-[8px] mb-0.5">Total Fees</div>
        <div className="text-sm font-bold text-primary">
          ${Math.abs(stats.totalFees).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

export default memo(StatisticsPanel);
