export interface StochasticTimeframeConfig {
  enabled: boolean;
  period: number;
  smoothK: number;
  smoothD: number;
}

export interface StochasticSettings {
  showMultiTimeframe: boolean;
  overboughtLevel: number;
  oversoldLevel: number;
  timeframes: {
    '1m': StochasticTimeframeConfig;
    '5m': StochasticTimeframeConfig;
    '15m': StochasticTimeframeConfig;
    '1h': StochasticTimeframeConfig;
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
  timeframes: ('1m' | '5m' | '15m' | '1h')[];
  oversoldThreshold: number;
  overboughtThreshold: number;
  period: number;
  smoothK: number;
  smoothD: number;
}

export interface EmaAlignmentScannerConfig {
  enabled: boolean;
  timeframes: ('1m' | '5m' | '15m' | '1h')[];
  lookbackBars: number;
}

export interface ScannerSettings {
  enabled: boolean;
  scanInterval: number;
  topMarkets: number;
  playSound: boolean;
  stochasticScanner: StochasticScannerConfig;
  emaAlignmentScanner: EmaAlignmentScannerConfig;
}

export interface OrderSettings {
  cloudPercentage: number;
  smallPercentage: number;
  bigPercentage: number;
}

export type ThemeName = 'dark' | 'hyper' | 'midnight' | 'light' | 'dark-blue';

export interface ThemeSettings {
  selected: ThemeName;
  playTradeSound: boolean;
}

export interface AppSettings {
  indicators: IndicatorSettings;
  scanner: ScannerSettings;
  orders: OrderSettings;
  theme: ThemeSettings;
}

export const DEFAULT_STOCHASTIC_CONFIG: StochasticTimeframeConfig = {
  enabled: true,
  period: 14,
  smoothK: 3,
  smoothD: 3,
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
      showMultiTimeframe: true,
      overboughtLevel: 80,
      oversoldLevel: 20,
      timeframes: {
        '1m': { ...DEFAULT_STOCHASTIC_CONFIG, enabled: true },
        '5m': { ...DEFAULT_STOCHASTIC_CONFIG, enabled: true },
        '15m': { ...DEFAULT_STOCHASTIC_CONFIG, enabled: true },
        '1h': { ...DEFAULT_STOCHASTIC_CONFIG, enabled: false },
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
    scanInterval: 2,
    topMarkets: 20,
    playSound: true,
    stochasticScanner: {
      enabled: false,
      timeframes: ['1m', '5m', '15m'],
      oversoldThreshold: 20,
      overboughtThreshold: 80,
      period: 14,
      smoothK: 3,
      smoothD: 3,
    },
    emaAlignmentScanner: {
      enabled: false,
      timeframes: ['1m', '5m', '15m'],
      lookbackBars: 3,
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
};
