import type { TimeInterval } from '@/types';

export interface StochasticValue {
  k: number;
  d: number;
  timeframe: TimeInterval;
}

export interface EmaAlignmentValue {
  ema1: number;
  ema2: number;
  ema3: number;
  timeframe: TimeInterval;
  alignmentType: 'bullish' | 'bearish';
  barsAgo: number;
}

export type SignalType = 'bullish' | 'bearish';
export type ScanType = 'stochastic' | 'emaAlignment';

export interface ScanResult {
  symbol: string;
  stochastics?: StochasticValue[];
  emaAlignments?: EmaAlignmentValue[];
  matchedAt: number;
  signalType: SignalType;
  description: string;
  scanType: ScanType;
}

export interface ScannerStatus {
  isRunning: boolean;
  isScanning: boolean;
  lastScanTime: number | null;
  error: string | null;
}
