'use client';

import { memo, useMemo, useEffect, useState } from 'react';
import { useUserFillsStore } from '@/stores/useUserFillsStore';
import { groupFillsByPosition } from '@/lib/trade-grouping-utils';
import TradeRow from '@/components/trades/TradeRow';
import PnlChart from '@/components/trades/PnlChart';
import SymbolPnlDonut from '@/components/trades/SymbolPnlDonut';
import StatisticsPanel from '@/components/trades/StatisticsPanel';
import MonthlyCalendarView from '@/components/trades/MonthlyCalendarView';

type ViewTab = 'daily' | 'monthly';

function TodaysTradesView() {
  const [activeTab, setActiveTab] = useState<ViewTab>('daily');

  const fills = useUserFillsStore((state) => state.fills);
  const loading = useUserFillsStore((state) => state.loading);
  const error = useUserFillsStore((state) => state.error);
  const selectedDate = useUserFillsStore((state) => state.selectedDate);
  const setSelectedDate = useUserFillsStore((state) => state.setSelectedDate);
  const fetchSelectedDateFills = useUserFillsStore((state) => state.fetchSelectedDateFills);
  const goToPreviousDay = useUserFillsStore((state) => state.goToPreviousDay);
  const goToNextDay = useUserFillsStore((state) => state.goToNextDay);
  const goToToday = useUserFillsStore((state) => state.goToToday);

  useEffect(() => {
    fetchSelectedDateFills();
  }, [selectedDate, fetchSelectedDateFills]);

  const isToday = useMemo(() => {
    const today = new Date();
    return selectedDate.toDateString() === today.toDateString();
  }, [selectedDate]);

  const isNextDisabled = useMemo(() => {
    return isToday;
  }, [isToday]);

  const displayDate = useMemo(() => {
    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, [selectedDate]);

  const handlePreviousDay = () => {
    goToPreviousDay();
  };

  const handleNextDay = () => {
    if (!isNextDisabled) {
      goToNextDay();
    }
  };

  const handleToday = () => {
    goToToday();
  };

  const handleDayClickFromMonthly = (date: Date) => {
    setSelectedDate(date);
    setActiveTab('daily');
  };

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
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('daily')}
              className={`text-[10px] font-mono px-2 py-1 transition-colors ${
                activeTab === 'daily'
                  ? 'text-primary-bright border-b-2 border-primary-bright'
                  : 'text-primary-muted hover:text-primary'
              }`}
            >
              DAILY
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`text-[10px] font-mono px-2 py-1 transition-colors ${
                activeTab === 'monthly'
                  ? 'text-primary-bright border-b-2 border-primary-bright'
                  : 'text-primary-muted hover:text-primary'
              }`}
            >
              MONTHLY
            </button>
          </div>
        </div>

        {activeTab === 'daily' ? (
          <>
            <div className="terminal-border p-1.5">
              <div className="flex justify-between items-center">
                <div className="terminal-text">
                  <span className="text-primary text-sm font-bold tracking-wider">
                    █ {isToday ? "TODAY'S TRADES" : `TRADES - ${displayDate.toUpperCase()}`}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    <button
                      onClick={handlePreviousDay}
                      className="text-primary hover:text-primary-bright px-1 transition-colors"
                    >
                      ← PREV
                    </button>
                    <span className="text-primary-muted">|</span>
                    <button
                      onClick={handleToday}
                      className={`px-1 transition-colors ${isToday ? 'text-primary-muted cursor-default' : 'text-primary hover:text-primary-bright'}`}
                      disabled={isToday}
                    >
                      TODAY
                    </button>
                    <span className="text-primary-muted">|</span>
                    <button
                      onClick={handleNextDay}
                      className={`px-1 transition-colors ${isNextDisabled ? 'text-primary-muted cursor-not-allowed' : 'text-primary hover:text-primary-bright'}`}
                      disabled={isNextDisabled}
                    >
                      NEXT →
                    </button>
                  </div>
                  {isToday && (
                    <div className="text-right text-[10px]">
                      <div className="text-primary-muted">{displayDate}</div>
                    </div>
                  )}
                  <div className="text-right text-[10px]">
                    <div className="text-primary-muted">TOTAL P&L:</div>
                    <div className={totalPnl >= 0 ? 'text-bullish' : 'text-bearish'}>
                      {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USD
                    </div>
                  </div>
                </div>
              </div>
            </div>

        {loading ? (
          <div className="terminal-border p-1.5 flex flex-col flex-1 min-h-0">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="text-[12px] text-primary-muted font-mono animate-pulse">
                  Loading trades...
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="terminal-border p-1.5 flex flex-col flex-1 min-h-0">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="text-[12px] text-bearish font-mono">
                  Error: {error}
                </div>
              </div>
            </div>
          </div>
        ) : positionGroups.length === 0 ? (
          <div className="terminal-border p-1.5 flex flex-col flex-1 min-h-0">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="text-2xl text-primary-muted">📊</div>
                <div className="text-[12px] text-primary-muted font-mono">
                  No trades today
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 flex-1 min-h-0">
            {/* Left column - 50% */}
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              {/* Top: Donut Chart and Statistics side by side */}
              <div className="flex gap-2" style={{ height: '250px' }}>
                {/* Donut chart */}
                <div className="terminal-border p-1.5 flex-1 flex flex-col">
                  <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">
                    █ P&L BY SYMBOL
                  </div>
                  <div className="flex-1 min-h-0">
                    <SymbolPnlDonut groups={positionGroups} />
                  </div>
                </div>

                {/* Statistics panel */}
                <div className="terminal-border p-1.5 flex-1 flex flex-col">
                  <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">
                    █ STATISTICS
                  </div>
                  <StatisticsPanel groups={positionGroups} totalPnl={totalPnl} />
                </div>
              </div>

              {/* Bottom: Cumulative P&L Chart */}
              <div className="terminal-border p-1.5 flex-1 flex flex-col min-h-0">
                <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">
                  █ CUMULATIVE P&L
                </div>
                <div className="flex-1 min-h-0">
                  <PnlChart groups={positionGroups} />
                </div>
              </div>
            </div>

            {/* Right column - 50% - Full height positions list */}
            <div className="terminal-border p-1.5 flex-1 flex flex-col min-h-0">
              <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">
                █ POSITIONS
              </div>
              <div className="overflow-y-auto space-y-2">
                {positionGroups.map((group) => (
                  <TradeRow key={group.id} group={group} />
                ))}
              </div>
            </div>
          </div>
        )}
          </>
        ) : (
          <MonthlyCalendarView onDayClick={handleDayClickFromMonthly} />
        )}
      </div>
    </div>
  );
}

export default memo(TodaysTradesView);
