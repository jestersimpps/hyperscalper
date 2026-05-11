'use client';

import { useWebSocketStatusStore, type WebSocketStreamType } from '@/stores/useWebSocketStatusStore';

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

export default function StreamStatusIndicators() {
  const streams = useWebSocketStatusStore((state) => state.streams);

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
    <div className="hidden md:flex items-center gap-3 px-2 py-1 terminal-border">
      {renderStreamIndicator('candles', 'CANDLES')}
      {renderStreamIndicator('trades', 'TRADES')}
      {renderStreamIndicator('prices', 'PRICES')}
    </div>
  );
}
