'use client';

import { memo, useMemo } from 'react';
import type { PositionGroup } from '@/lib/trade-grouping-utils';

interface StatisticsPanelProps {
  groups: PositionGroup[];
  totalPnl: number;
}

function StatisticsPanel({ groups, totalPnl }: StatisticsPanelProps) {
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
  }, [groups, totalPnl]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="text-[12px] space-y-1 font-mono">
      <div className="flex justify-between">
        <span className="text-primary-muted">TOTAL P&L:</span>
        <span className={totalPnl >= 0 ? 'text-bullish' : 'text-bearish'}>
          {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USD
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">TRADES:</span>
        <span className="text-primary">{stats.totalTrades}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">WIN RATE:</span>
        <span className={stats.winRate >= 50 ? 'text-bullish' : 'text-bearish'}>
          {stats.winRate.toFixed(1)}% ({stats.winCount}W / {stats.lossCount}L)
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">AVG P&L:</span>
        <span className={stats.averagePnl >= 0 ? 'text-bullish' : 'text-bearish'}>
          {stats.averagePnl >= 0 ? '+' : ''}${stats.averagePnl.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">BEST TRADE:</span>
        <span className="text-bullish">
          {stats.bestTrade ? `+$${stats.bestTrade.pnl.toFixed(2)} (${stats.bestTrade.coin})` : '--'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">WORST TRADE:</span>
        <span className="text-bearish">
          {stats.worstTrade ? `${stats.worstTrade.pnl >= 0 ? '+' : ''}$${stats.worstTrade.pnl.toFixed(2)} (${stats.worstTrade.coin})` : '--'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">FEES PAID:</span>
        <span className="text-primary">${Math.abs(stats.totalFees).toFixed(2)}</span>
      </div>
    </div>
  );
}

export default memo(StatisticsPanel);
