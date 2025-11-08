'use client';

import { useState, useEffect } from 'react';
import { useWebSocketStatusStore, type WebSocketStreamType } from '@/stores/useWebSocketStatusStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface TerminalHeaderProps {
  coin: string;
}

export default function TerminalHeader({ coin }: TerminalHeaderProps) {
  const [currentTime, setCurrentTime] = useState('');

  const streams = useWebSocketStatusStore((state) => state.streams);
  const isMultiChartView = useSettingsStore((state) => state.isMultiChartView);
  const toggleMultiChartView = useSettingsStore((state) => state.toggleMultiChartView);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleString());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-bullish';
      case 'connecting':
        return 'text-accent-orange';
      case 'error':
        return 'text-bearish';
      default:
        return 'text-primary-muted';
    }
  };

  const getStatusSymbol = (status: string) => {
    switch (status) {
      case 'connected':
        return '●';
      case 'connecting':
        return '◐';
      case 'error':
        return '✕';
      default:
        return '○';
    }
  };

  const renderStreamIndicator = (streamType: WebSocketStreamType, label: string) => {
    const stream = streams[streamType];
    const colorClass = getStatusColor(stream.status);
    const symbol = getStatusSymbol(stream.status);
    const count = stream.subscriptionCount;

    return (
      <div
        className={`flex items-center gap-1 ${colorClass}`}
        title={`${label}: ${stream.status} (${count} ${count === 1 ? 'subscription' : 'subscriptions'})`}
      >
        <span className="text-[10px]">{symbol}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
      </div>
    );
  };

  return (
    <div className="terminal-border p-1.5 mb-2">
      <div className="flex justify-between items-center">
        <div className="terminal-text">
          <span className="text-primary text-sm font-bold tracking-wider">█ {coin}/USD</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-[10px]">
            <div className="text-primary-muted">{currentTime || '--'}</div>
          </div>
          <div className="flex items-center gap-3 px-2 py-1 terminal-border">
            {renderStreamIndicator('candles', 'CANDLES')}
            {renderStreamIndicator('trades', 'TRADES')}
            {renderStreamIndicator('orderbook', 'BOOK')}
            {renderStreamIndicator('prices', 'PRICES')}
          </div>
          <button
            onClick={toggleMultiChartView}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-all rounded-sm ${
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
