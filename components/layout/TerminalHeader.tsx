'use client';

import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useWebSocketStatusStore, type WebSocketStreamType } from '@/stores/useWebSocketStatusStore';

interface TerminalHeaderProps {
  coin: string;
}

export default function TerminalHeader({ coin }: TerminalHeaderProps) {
  const togglePanel = useSettingsStore((state) => state.togglePanel);
  const toggleMultiChartView = useSettingsStore((state) => state.toggleMultiChartView);
  const isMultiChartView = useSettingsStore((state) => state.isMultiChartView);
  const [currentTime, setCurrentTime] = useState('');

  const streams = useWebSocketStatusStore((state) => state.streams);

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
          <span className="ml-3 text-primary-muted text-[10px]">v1.0.0</span>
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
          <div className="flex gap-2">
            <button
              onClick={toggleMultiChartView}
              className={`transition-all text-2xl leading-none active:scale-90 cursor-pointer ${
                isMultiChartView ? 'text-primary' : 'text-primary-muted hover:text-primary'
              }`}
              title={isMultiChartView ? 'Single chart view' : 'Multi-timeframe view'}
            >
              ⊞
            </button>
            <button
              onClick={togglePanel}
              className="text-primary-muted hover:text-primary active:scale-90 cursor-pointer transition-all text-2xl leading-none"
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
