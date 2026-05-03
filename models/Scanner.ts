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
  startRsiValue: number;
  endRsiValue: number;
  strength?: number;
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

export interface SupportResistanceValue {
  timeframe: TimeInterval;
  supportLevel: number;
  resistanceLevel: number;
  currentPrice: number;
  distanceToSupport: number;
  distanceToResistance: number;
  supportTouches: number;
  resistanceTouches: number;
  nearLevel: 'support' | 'resistance';
}

export interface AscendingTriangleComponents {
  flatness: number;
  slope: number;
  convergence: number;
  volume: number;
  ema: number;
  proximity: number;
}

export interface AscendingTriangleValue {
  timeframe: TimeInterval;
  score: number;
  components: AscendingTriangleComponents;
  ceiling: number;
  supportLineAtNow: number;
  supportSlope: number;
  supportR2: number;
  stopSuggestion: number;
  highPivotCount: number;
  lowPivotCount: number;
  atr: number;
  currentPrice: number;
}

export interface CupAndHandleComponents {
  rimSymmetry: number;
  cupRoundness: number;
  cupDepth: number;
  handlePullback: number;
  handleVolume: number;
  proximity: number;
}

export interface CupAndHandleValue {
  timeframe: TimeInterval;
  score: number;
  components: CupAndHandleComponents;
  resistance: number;
  leftRimPrice: number;
  rightRimPrice: number;
  cupBottomPrice: number;
  handleLowPrice: number;
  cupStartIndex: number;
  cupBottomIndex: number;
  rightRimIndex: number;
  handleEndIndex: number;
  stopSuggestion: number;
  atr: number;
  currentPrice: number;
}

export type SignalType = 'bullish' | 'bearish';
export type ScanType = 'stochastic' | 'emaAlignment' | 'channel' | 'divergence' | 'macdReversal' | 'rsiReversal' | 'volumeSpike' | 'supportResistance' | 'ascendingTriangle' | 'cupAndHandle';

export interface ScanResult {
  symbol: string;
  stochastics?: StochasticValue[];
  emaAlignments?: EmaAlignmentValue[];
  channels?: ChannelValue[];
  divergences?: DivergenceValue[];
  macdReversals?: MacdReversalValue[];
  rsiReversals?: RsiReversalValue[];
  volumeSpikes?: VolumeValue[];
  supportResistanceLevels?: SupportResistanceValue[];
  ascendingTriangles?: AscendingTriangleValue[];
  cupAndHandles?: CupAndHandleValue[];
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
