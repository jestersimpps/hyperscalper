'use client';

import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface TerminalHeaderProps {
  coin: string;
}

export default function TerminalHeader({ coin }: TerminalHeaderProps) {
  const togglePanel = useSettingsStore((state) => state.togglePanel);
  const toggleMultiChartView = useSettingsStore((state) => state.toggleMultiChartView);
  const isMultiChartView = useSettingsStore((state) => state.isMultiChartView);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleString());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="terminal-border p-1.5 mb-2">
      <div className="flex justify-between items-center">
        <div className="terminal-text">
          <span className="text-primary text-sm font-bold tracking-wider">█ HYPERLIQUID TERMINAL</span>
          <span className="ml-3 text-primary-muted text-[10px]">v1.0.0</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-[10px]">
            <div className="text-primary font-bold">{coin}/USD</div>
            <div className="text-primary-muted">{currentTime || '--'}</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleMultiChartView}
              className={`transition-colors text-2xl leading-none ${
                isMultiChartView ? 'text-primary' : 'text-primary-muted hover:text-primary'
              }`}
              title={isMultiChartView ? 'Single chart view' : 'Multi-timeframe view'}
            >
              ⊞
            </button>
            <button
              onClick={togglePanel}
              className="text-primary-muted hover:text-primary transition-colors text-2xl leading-none"
              title="Open settings"
            >
              ⚙
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
