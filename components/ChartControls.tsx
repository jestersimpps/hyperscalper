'use client';

import type { TimeInterval } from '@/types';

interface ChartControlsProps {
  currentInterval: TimeInterval;
  onIntervalChange: (interval: TimeInterval) => void;
}

const INTERVALS: { value: TimeInterval; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
];

export default function ChartControls({ currentInterval, onIntervalChange }: ChartControlsProps) {
  return (
    <div className="flex gap-2 mb-4">
      {INTERVALS.map((interval) => (
        <button
          key={interval.value}
          onClick={() => onIntervalChange(interval.value)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            currentInterval === interval.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {interval.label}
        </button>
      ))}
    </div>
  );
}
