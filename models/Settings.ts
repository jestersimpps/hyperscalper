export interface StochasticVariantConfig {
  enabled: boolean;
  period: number;
  smoothK: number;
  smoothD: number;
}

export interface StochasticSettings {
  showMultiVariant: boolean;
  showDivergence: boolean;
  divergenceVariant: 'fast9' | 'fast14' | 'fast40' | 'full60';
  overboughtLevel: number;
  oversoldLevel: number;
  variants: {
    fast9: StochasticVariantConfig;
    fast14: StochasticVariantConfig;
    fast40: StochasticVariantConfig;
    full60: StochasticVariantConfig;
  };
}

export interface EmaConfig {
  enabled: boolean;
  period: number;
}

export interface EmaSettings {
  ema1: EmaConfig;
  ema2: EmaConfig;
  ema3: EmaConfig;
}

export interface MacdTimeframeConfig {
  enabled: boolean;
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}

export interface MacdSettings {
  showMultiTimeframe: boolean;
  timeframes: {
    '1m': MacdTimeframeConfig;
    '5m': MacdTimeframeConfig;
    '15m': MacdTimeframeConfig;
    '1h': MacdTimeframeConfig;
  };
}

export interface IndicatorSettings {
  stochastic: StochasticSettings;
  ema: EmaSettings;
  macd: MacdSettings;
}

export interface StochasticScannerConfig {
  enabled: boolean;
  oversoldThreshold: number;
  overboughtThreshold: number;
  timeframes: ('1m' | '5m' | '15m' | '1h')[];
}

export interface EmaAlignmentScannerConfig {
  enabled: boolean;
  timeframes: ('1m' | '5m' | '15m' | '1h')[];
  lookbackBars: number;
  ema1Period: number;
  ema2Period: number;
  ema3Period: number;
}

export interface ChannelScannerConfig {
  enabled: boolean;
  timeframes: ('1m' | '5m')[];
  minTouches: number;
  pivotStrength: number;
  lookbackBars: number;
}

export interface DivergenceScannerConfig {
  enabled: boolean;
  scanBullish: boolean;
  scanBearish: boolean;
  scanHidden: boolean;
  pivotStrength: number;
  timeframes: ('1m' | '5m' | '15m' | '1h')[];
}

export interface MacdReversalScannerConfig {
  enabled: boolean;
  timeframes: ('1m' | '5m' | '15m' | '1h')[];
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  recentReversalLookback: number;
  minCandles: number;
}

export interface RsiReversalScannerConfig {
  enabled: boolean;
  timeframes: ('1m' | '5m' | '15m' | '1h')[];
  period: number;
  oversoldLevel: number;
  overboughtLevel: number;
  recentReversalLookback: number;
  minCandles: number;
}

export interface ScannerSettings {
  enabled: boolean;
  scanInterval: number;
  topMarkets: number;
  playSound: boolean;
  stochasticScanner: StochasticScannerConfig;
  emaAlignmentScanner: EmaAlignmentScannerConfig;
  channelScanner: ChannelScannerConfig;
  divergenceScanner: DivergenceScannerConfig;
  macdReversalScanner: MacdReversalScannerConfig;
  rsiReversalScanner: RsiReversalScannerConfig;
}

export interface OrderSettings {
  cloudPercentage: number;
  smallPercentage: number;
  bigPercentage: number;
}

export type ThemeName = 'dark' | 'hyper' | 'hyper-black' | 'midnight' | 'light' | 'dark-blue';

export interface ThemeSettings {
  selected: ThemeName;
  playTradeSound: boolean;
}

export interface ChartSettings {
  showPivotMarkers: boolean;
}

export interface AppSettings {
  indicators: IndicatorSettings;
  scanner: ScannerSettings;
  orders: OrderSettings;
  theme: ThemeSettings;
  chart: ChartSettings;
  pinnedSymbols: string[];
}

export const DEFAULT_STOCHASTIC_FAST9: StochasticVariantConfig = {
  enabled: true,
  period: 9,
  smoothK: 1,
  smoothD: 3,
};

export const DEFAULT_STOCHASTIC_FAST14: StochasticVariantConfig = {
  enabled: true,
  period: 14,
  smoothK: 1,
  smoothD: 3,
};

export const DEFAULT_STOCHASTIC_FAST40: StochasticVariantConfig = {
  enabled: true,
  period: 40,
  smoothK: 1,
  smoothD: 4,
};

export const DEFAULT_STOCHASTIC_FULL60: StochasticVariantConfig = {
  enabled: true,
  period: 60,
  smoothK: 10,
  smoothD: 10,
};

export const DEFAULT_MACD_CONFIG: MacdTimeframeConfig = {
  enabled: true,
  fastPeriod: 5,
  slowPeriod: 13,
  signalPeriod: 5,
};

export const DEFAULT_SETTINGS: AppSettings = {
  indicators: {
    stochastic: {
      showMultiVariant: true,
      showDivergence: true,
      divergenceVariant: 'fast14',
      overboughtLevel: 80,
      oversoldLevel: 20,
      variants: {
        fast9: DEFAULT_STOCHASTIC_FAST9,
        fast14: DEFAULT_STOCHASTIC_FAST14,
        fast40: DEFAULT_STOCHASTIC_FAST40,
        full60: DEFAULT_STOCHASTIC_FULL60,
      },
    },
    ema: {
      ema1: { enabled: true, period: 5 },
      ema2: { enabled: true, period: 13 },
      ema3: { enabled: true, period: 21 },
    },
    macd: {
      showMultiTimeframe: true,
      timeframes: {
        '1m': { ...DEFAULT_MACD_CONFIG, enabled: true },
        '5m': { ...DEFAULT_MACD_CONFIG, enabled: false },
        '15m': { ...DEFAULT_MACD_CONFIG, enabled: false },
        '1h': { ...DEFAULT_MACD_CONFIG, enabled: false },
      },
    },
  },
  scanner: {
    enabled: false,
    scanInterval: 1,
    topMarkets: 20,
    playSound: true,
    stochasticScanner: {
      enabled: false,
      oversoldThreshold: 20,
      overboughtThreshold: 80,
      timeframes: ['1m', '5m'],
    },
    emaAlignmentScanner: {
      enabled: false,
      timeframes: ['1m', '5m', '15m'],
      lookbackBars: 3,
      ema1Period: 5,
      ema2Period: 13,
      ema3Period: 21,
    },
    channelScanner: {
      enabled: false,
      timeframes: ['1m', '5m'],
      minTouches: 3,
      pivotStrength: 3,
      lookbackBars: 50,
    },
    divergenceScanner: {
      enabled: false,
      scanBullish: true,
      scanBearish: true,
      scanHidden: false,
      pivotStrength: 3,
      timeframes: ['1m', '5m'],
    },
    macdReversalScanner: {
      enabled: false,
      timeframes: ['1m', '5m', '15m', '1h'],
      fastPeriod: 5,
      slowPeriod: 13,
      signalPeriod: 5,
      recentReversalLookback: 3,
      minCandles: 50,
    },
    rsiReversalScanner: {
      enabled: false,
      timeframes: ['1m', '5m', '15m', '1h'],
      period: 14,
      oversoldLevel: 30,
      overboughtLevel: 70,
      recentReversalLookback: 3,
      minCandles: 50,
    },
  },
  orders: {
    cloudPercentage: 5,
    smallPercentage: 10,
    bigPercentage: 25,
  },
  theme: {
    selected: 'hyper',
    playTradeSound: false,
  },
  chart: {
    showPivotMarkers: true,
  },
  pinnedSymbols: [],
};
