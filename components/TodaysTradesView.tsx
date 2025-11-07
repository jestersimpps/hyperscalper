'use client';

import { memo, useMemo } from 'react';

function TodaysTradesView() {
  const currentDate = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  const totalPnl = 0;

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
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-2xl text-primary-muted">📊</div>
              <div className="text-[12px] text-primary-muted font-mono">
                TODAY'S TRADES VIEW
              </div>
              <div className="text-[10px] text-primary-muted/60 font-mono">
                (Implementation coming soon)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(TodaysTradesView);
