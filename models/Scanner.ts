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

export interface ChannelValue {
  type: 'horizontal' | 'ascending' | 'descending';
  upperPrice: number;
  lowerPrice: number;
  currentPrice: number;
  distanceToUpper: number;
  distanceToLower: number;
  angle: number;
  touches: number;
  strength: number;
  timeframe: TimeInterval;
}

export interface DivergenceValue {
  type: 'bullish' | 'bearish' | 'hidden-bullish' | 'hidden-bearish';
  startTime: number;
  endTime: number;
  startPriceValue: number;
  endPriceValue: number;
  startStochValue: number;
  endStochValue: number;
  variant: 'ultraFast' | 'fast' | 'medium' | 'slow';
}

export interface MacdReversalValue {
  direction: 'bullish' | 'bearish';
  timeframe: TimeInterval;
  time: number;
  price: number;
  macdValue: number;
  signalValue: number;
}

export interface RsiReversalValue {
  direction: 'bullish' | 'bearish';
  timeframe: TimeInterval;
  time: number;
  price: number;
  rsiValue: number;
  zone: 'oversold' | 'overbought';
}

export interface VolumeValue {
  timeframe: TimeInterval;
  volumeRatio: number;
  priceChangePercent: number;
  avgVolume: number;
  currentVolume: number;
}

export type SignalType = 'bullish' | 'bearish';
export type ScanType = 'stochastic' | 'emaAlignment' | 'channel' | 'divergence' | 'macdReversal' | 'rsiReversal' | 'volumeSpike';

export interface ScanResult {
  symbol: string;
  stochastics?: StochasticValue[];
  emaAlignments?: EmaAlignmentValue[];
  channels?: ChannelValue[];
  divergences?: DivergenceValue[];
  macdReversals?: MacdReversalValue[];
  rsiReversals?: RsiReversalValue[];
  volumeSpikes?: VolumeValue[];
  matchedAt: number;
  signalType: SignalType;
  description: string;
  scanType: ScanType;
  closePrices?: number[];
}

export interface ScannerStatus {
  isRunning: boolean;
  isScanning: boolean;
  lastScanTime: number | null;
  error: string | null;
}
