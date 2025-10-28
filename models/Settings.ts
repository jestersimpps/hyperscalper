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

export interface MacdSettings {
  enabled: boolean;
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}

export interface IndicatorSettings {
  stochastic: StochasticSettings;
  ema: EmaSettings;
  macd: MacdSettings;
}

export interface ScannerSettings {
  // TODO: Add scanner settings
}

export interface OrderSettings {
  // TODO: Add order settings
}

export interface AppSettings {
  indicators: IndicatorSettings;
  scanner: ScannerSettings;
  orders: OrderSettings;
}

export const DEFAULT_STOCHASTIC_CONFIG: StochasticTimeframeConfig = {
  enabled: true,
  period: 14,
  smoothK: 3,
  smoothD: 3,
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
      enabled: true,
      fastPeriod: 5,
      slowPeriod: 13,
      signalPeriod: 5,
    },
  },
  scanner: {},
  orders: {},
};
