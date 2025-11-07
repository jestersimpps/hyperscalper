'use client';

import { memo, useMemo, useEffect } from 'react';
import { useUserFillsStore } from '@/stores/useUserFillsStore';
import { useHyperliquidService } from '@/lib/hooks/use-hyperliquid-service';
import { groupFillsByPosition } from '@/lib/trade-grouping-utils';
import type { DailyPnlSummary } from '@/stores/useUserFillsStore';
import MiniPnlChart from '@/components/trades/MiniPnlChart';
import MonthlyCumulativePnlChart from '@/components/trades/MonthlyCumulativePnlChart';
import MonthlyStatistics from '@/components/trades/MonthlyStatistics';
import SymbolPnlDonut from '@/components/trades/SymbolPnlDonut';

interface MonthlyCalendarViewProps {
  onDayClick: (date: Date) => void;
}

function MonthlyCalendarView({ onDayClick }: MonthlyCalendarViewProps) {
  const service = useHyperliquidService();
  const selectedMonth = useUserFillsStore((state) => state.selectedMonth);
  const dailySummaries = useUserFillsStore((state) => state.dailySummaries);
  const monthlyFills = useUserFillsStore((state) => state.monthlyFills);
  const loading = useUserFillsStore((state) => state.loading);
  const error = useUserFillsStore((state) => state.error);
  const setService = useUserFillsStore((state) => state.setService);
  const fetchMonthFills = useUserFillsStore((state) => state.fetchMonthFills);
  const goToPreviousMonth = useUserFillsStore((state) => state.goToPreviousMonth);
  const goToNextMonth = useUserFillsStore((state) => state.goToNextMonth);
  const goToThisMonth = useUserFillsStore((state) => state.goToThisMonth);

  useEffect(() => {
    if (service) {
      setService(service);
    }
  }, [service, setService]);

  useEffect(() => {
    if (service) {
      fetchMonthFills();
    }
  }, [service, selectedMonth, fetchMonthFills]);

  const isCurrentMonth = useMemo(() => {
    const today = new Date();
    return selectedMonth.getMonth() === today.getMonth() &&
           selectedMonth.getFullYear() === today.getFullYear();
  }, [selectedMonth]);

  const isNextDisabled = useMemo(() => {
    return isCurrentMonth;
  }, [isCurrentMonth]);

  const monthDisplay = useMemo(() => {
    return selectedMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    }).toUpperCase();
  }, [selectedMonth]);

  const monthlyPositionGroups = useMemo(() => {
    return groupFillsByPosition(monthlyFills);
  }, [monthlyFills]);

  const calendarDays = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: Array<{ date: Date | null; summary: DailyPnlSummary | null }> = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: null, summary: null });
    }

    const summaryMap = new Map<string, DailyPnlSummary>();
    dailySummaries.forEach(summary => {
      summaryMap.set(summary.date, summary);
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = date.toISOString().split('T')[0];
      const summary = summaryMap.get(dateKey) || null;
      days.push({ date, summary });
    }

    return days;
  }, [selectedMonth, dailySummaries]);

  const handlePreviousMonth = () => {
    goToPreviousMonth();
  };

  const handleNextMonth = () => {
    if (!isNextDisabled) {
      goToNextMonth();
    }
  };

  const handleThisMonth = () => {
    goToThisMonth();
  };

  const handleDayClick = (date: Date | null) => {
    if (date) {
      onDayClick(date);
    }
  };

  const isFutureDate = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="terminal-border p-1.5 mb-2 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="text-[10px] text-primary-muted uppercase tracking-wider">
            █ MONTHLY VIEW
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <button
              onClick={handlePreviousMonth}
              className="text-primary hover:text-primary-bright px-1 transition-colors"
            >
              ← PREV
            </button>
            <span className="text-primary-muted">|</span>
            <button
              onClick={handleThisMonth}
              className={`px-1 transition-colors ${isCurrentMonth ? 'text-primary-muted cursor-default' : 'text-primary hover:text-primary-bright'}`}
              disabled={isCurrentMonth}
            >
              THIS MONTH
            </button>
            <span className="text-primary-muted">|</span>
            <button
              onClick={handleNextMonth}
              className={`px-1 transition-colors ${isNextDisabled ? 'text-primary-muted cursor-not-allowed' : 'text-primary hover:text-primary-bright'}`}
              disabled={isNextDisabled}
            >
              NEXT →
            </button>
          </div>
        </div>
        <div className="text-center text-sm text-primary font-bold mt-1">
          {monthDisplay}
        </div>
      </div>

      {!loading && !error && dailySummaries.length > 0 && (
        <div className="terminal-border p-1.5 mb-2 flex-shrink-0" style={{ height: '500px' }}>
          <div className="flex gap-2 h-full">
            <div className="flex-1 flex flex-col">
              <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">
                █ CUMULATIVE P&L
              </div>
              <div className="flex-1 min-h-0">
                <MonthlyCumulativePnlChart dailySummaries={dailySummaries} />
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">
                █ MONTHLY STATISTICS
              </div>
              <MonthlyStatistics dailySummaries={dailySummaries} />
            </div>
            <div className="flex-1 flex flex-col">
              <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">
                █ P&L BY SYMBOL
              </div>
              <div className="flex-1 min-h-0">
                <SymbolPnlDonut groups={monthlyPositionGroups} />
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="terminal-border p-1.5 flex-1 flex items-center justify-center">
          <div className="text-[12px] text-primary-muted font-mono animate-pulse">
            Loading month data...
          </div>
        </div>
      ) : error ? (
        <div className="terminal-border p-1.5 flex-1 flex items-center justify-center">
          <div className="text-[12px] text-bearish font-mono">
            Error: {error}
          </div>
        </div>
      ) : (
        <div className="terminal-border p-1.5 flex-1 overflow-auto">
          <div className="grid grid-cols-7 gap-1">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
              <div
                key={day}
                className="text-[10px] text-primary-muted text-center font-bold py-1"
              >
                {day}
              </div>
            ))}

            {calendarDays.map((dayData, index) => {
              const { date, summary } = dayData;
              const isFuture = isFutureDate(date);
              const hasData = summary && summary.fillCount > 0;
              const pnl = summary?.totalPnl || 0;

              return (
                <div
                  key={index}
                  className={`
                    terminal-border p-1 flex flex-col min-h-[120px]
                    ${date ? 'cursor-pointer hover:bg-bg-secondary' : 'bg-bg-secondary cursor-default'}
                    ${isFuture ? 'opacity-50' : ''}
                  `}
                  onClick={() => !isFuture && handleDayClick(date)}
                >
                  {date && (
                    <>
                      <div className="text-[10px] text-primary-muted text-right font-bold mb-1">
                        {date.getDate()}
                      </div>
                      {hasData && summary ? (
                        <div className="flex-1 flex gap-1">
                          <div className="w-1/2 flex flex-col gap-0.5 text-[8px] font-mono">
                            <div className={`text-[12px] font-bold text-center ${pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-primary-muted">Trades:</span>
                              <span className="text-primary">{summary.fillCount}</span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-primary-muted">W/R:</span>
                              <span className={summary.winRate >= 50 ? 'text-bullish' : 'text-bearish'}>
                                {summary.winRate.toFixed(0)}%
                              </span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-primary-muted">W/L:</span>
                              <span className="text-primary">{summary.winCount}/{summary.lossCount}</span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-primary-muted">Avg:</span>
                              <span className={summary.averagePnl >= 0 ? 'text-bullish' : 'text-bearish'}>
                                {summary.averagePnl >= 0 ? '+' : ''}{summary.averagePnl.toFixed(2)}
                              </span>
                            </div>

                            {summary.bestTrade && (
                              <div className="flex justify-between items-center">
                                <span className="text-primary-muted">Best:</span>
                                <span className="text-bullish truncate ml-1">
                                  +{summary.bestTrade.pnl.toFixed(2)}
                                </span>
                              </div>
                            )}

                            {summary.worstTrade && (
                              <div className="flex justify-between items-center">
                                <span className="text-primary-muted">Worst:</span>
                                <span className="text-bearish truncate ml-1">
                                  {summary.worstTrade.pnl.toFixed(2)}
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between items-center">
                              <span className="text-primary-muted">Fees:</span>
                              <span className="text-primary">{Math.abs(summary.totalFees).toFixed(2)}</span>
                            </div>
                          </div>

                          {summary.chartData && summary.chartData.length > 0 && (
                            <div className="w-1/2 h-[90px] flex items-center">
                              <MiniPnlChart chartData={summary.chartData} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <span className="text-[9px] text-primary-muted">No trades</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(MonthlyCalendarView);
