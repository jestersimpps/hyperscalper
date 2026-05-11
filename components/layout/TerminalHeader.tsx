'use client';

import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface TerminalHeaderProps {
  coin: string;
  onRefreshCharts?: () => void;
  onAutoZoom?: () => void;
  onZoomTo50?: () => void;
}

export default function TerminalHeader({ coin, onRefreshCharts, onAutoZoom, onZoomTo50 }: TerminalHeaderProps) {
  const [currentTime, setCurrentTime] = useState('');

  const isMultiChartView = useSettingsStore((state) => state.isMultiChartView);
  const toggleMultiChartView = useSettingsStore((state) => state.toggleMultiChartView);
  const showForecast = useSettingsStore((state) => state.settings.chart.showForecast);
  const updateChartSettings = useSettingsStore((state) => state.updateChartSettings);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleString());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="terminal-border p-1.5">
      <div className="flex justify-between items-center">
        <div className="terminal-text">
          <span className="text-primary text-sm font-bold tracking-wider">█ {coin}/USD</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-[10px]">
            <div className="text-primary-muted">{currentTime || '--'}</div>
          </div>
          {onRefreshCharts && (
            <button
              onClick={onRefreshCharts}
              className="hidden md:block px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 active:bg-primary/30 active:scale-95 text-primary border border-primary rounded cursor-pointer transition-all"
              title="Refresh 1m chart data and resubscribe to websocket"
            >
              ↻ REFRESH
            </button>
          )}
          {onAutoZoom && (
            <button
              onClick={onAutoZoom}
              className="hidden md:block px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 active:bg-primary/30 active:scale-95 text-primary border border-primary rounded cursor-pointer transition-all"
              title="Auto zoom chart to fit all data"
            >
              ⊡ FIT
            </button>
          )}
          {onZoomTo50 && (
            <button
              onClick={onZoomTo50}
              className="hidden md:block px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 active:bg-primary/30 active:scale-95 text-primary border border-primary rounded cursor-pointer transition-all"
              title="Zoom to last 50 candles"
            >
              ⊡ 50
            </button>
          )}
          <button
            onClick={() => updateChartSettings({ showForecast: !showForecast })}
            className={`hidden md:block px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-all rounded-sm ${
              showForecast
                ? 'bg-primary/20 text-primary border-2 border-primary'
                : 'bg-bg-secondary text-primary-muted border-2 border-frame hover:text-primary hover:bg-primary/10'
            }`}
            title="Toggle predicted price fan (median + 1σ/2σ bands) extending forward from the last candle"
          >
            Forecast
          </button>
          <button
            onClick={toggleMultiChartView}
            className={`hidden md:block px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-all rounded-sm ${
              isMultiChartView
                ? 'bg-primary/20 text-primary border-2 border-primary'
                : 'bg-bg-secondary text-primary-muted border-2 border-frame hover:text-primary hover:bg-primary/10'
            }`}
          >
            Multi-Timeframe
          </button>
        </div>
      </div>
    </div>
  );
}
