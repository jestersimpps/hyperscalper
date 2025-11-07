'use client';

import { memo, useMemo } from 'react';
import type { DailyPnlSummary } from '@/stores/useUserFillsStore';

interface MonthlyStatisticsProps {
  dailySummaries: DailyPnlSummary[];
}

function MonthlyStatistics({ dailySummaries }: MonthlyStatisticsProps) {
  const stats = useMemo(() => {
    if (dailySummaries.length === 0) {
      return {
        totalPnl: 0,
        totalTrades: 0,
        winningDays: 0,
        losingDays: 0,
        winRate: 0,
        averageDailyPnl: 0,
        bestDay: null as { date: string; pnl: number } | null,
        worstDay: null as { date: string; pnl: number } | null,
        totalFees: 0
      };
    }

    const totalPnl = dailySummaries.reduce((sum, day) => sum + day.totalPnl, 0);
    const totalTrades = dailySummaries.reduce((sum, day) => sum + day.fillCount, 0);
    const totalFees = dailySummaries.reduce((sum, day) => sum + day.totalFees, 0);

    const winningDays = dailySummaries.filter(day => day.totalPnl > 0).length;
    const losingDays = dailySummaries.filter(day => day.totalPnl < 0).length;
    const winRate = dailySummaries.length > 0 ? (winningDays / dailySummaries.length) * 100 : 0;

    const averageDailyPnl = dailySummaries.length > 0 ? totalPnl / dailySummaries.length : 0;

    const bestDay = dailySummaries.reduce((best, day) =>
      !best || day.totalPnl > best.totalPnl ? day : best
    );

    const worstDay = dailySummaries.reduce((worst, day) =>
      !worst || day.totalPnl < worst.totalPnl ? day : worst
    );

    const formatDate = (dateString: string): string => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return {
      totalPnl,
      totalTrades,
      winningDays,
      losingDays,
      winRate,
      averageDailyPnl,
      bestDay: { date: formatDate(bestDay.date), pnl: bestDay.totalPnl },
      worstDay: { date: formatDate(worstDay.date), pnl: worstDay.totalPnl },
      totalFees
    };
  }, [dailySummaries]);

  if (dailySummaries.length === 0) {
    return null;
  }

  return (
    <div className="text-[12px] space-y-1 font-mono">
      <div className="flex justify-between">
        <span className="text-primary-muted">MONTH P&L:</span>
        <span className={stats.totalPnl >= 0 ? 'text-bullish' : 'text-bearish'}>
          {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">TOTAL TRADES:</span>
        <span className="text-primary">{stats.totalTrades}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">TRADING DAYS:</span>
        <span className="text-primary">{dailySummaries.length}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">WIN RATE:</span>
        <span className={stats.winRate >= 50 ? 'text-bullish' : 'text-bearish'}>
          {stats.winRate.toFixed(1)}% ({stats.winningDays}W / {stats.losingDays}L)
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">AVG DAILY P&L:</span>
        <span className={stats.averageDailyPnl >= 0 ? 'text-bullish' : 'text-bearish'}>
          {stats.averageDailyPnl >= 0 ? '+' : ''}${stats.averageDailyPnl.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">BEST DAY:</span>
        <span className="text-bullish">
          {stats.bestDay ? `+$${stats.bestDay.pnl.toFixed(2)} (${stats.bestDay.date})` : '--'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">WORST DAY:</span>
        <span className="text-bearish">
          {stats.worstDay ? `${stats.worstDay.pnl >= 0 ? '+' : ''}$${stats.worstDay.pnl.toFixed(2)} (${stats.worstDay.date})` : '--'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-primary-muted">FEES PAID:</span>
        <span className="text-primary">${Math.abs(stats.totalFees).toFixed(2)}</span>
      </div>
    </div>
  );
}

export default memo(MonthlyStatistics);
