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

export interface IndicatorSettings {
  stochastic: StochasticSettings;
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
  },
  scanner: {},
  orders: {},
};
