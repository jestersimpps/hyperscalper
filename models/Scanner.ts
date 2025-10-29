import type { TimeInterval } from '@/types';

export interface StochasticValue {
  k: number;
  d: number;
  timeframe: TimeInterval;
}

export type SignalType = 'bullish' | 'bearish';

export interface ScanResult {
  symbol: string;
  stochastics: StochasticValue[];
  matchedAt: number;
  signalType: SignalType;
  description: string;
}

export interface ScannerStatus {
  isRunning: boolean;
  isScanning: boolean;
  lastScanTime: number | null;
  error: string | null;
}
