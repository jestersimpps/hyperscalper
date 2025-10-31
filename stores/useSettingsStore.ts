import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, DEFAULT_SETTINGS, StochasticSettings, EmaSettings, MacdSettings, ScannerSettings, OrderSettings, ThemeSettings } from '@/models/Settings';

type TabType = 'scanner' | 'indicators' | 'orders' | 'ui';

interface SettingsStore {
  isPanelOpen: boolean;
  activeTab: TabType;
  settings: AppSettings;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setActiveTab: (tab: TabType) => void;
  updateStochasticSettings: (settings: Partial<StochasticSettings>) => void;
  updateEmaSettings: (settings: Partial<EmaSettings>) => void;
  updateMacdSettings: (settings: Partial<MacdSettings>) => void;
  updateScannerSettings: (settings: Partial<ScannerSettings>) => void;
  updateOrderSettings: (settings: Partial<OrderSettings>) => void;
  updateThemeSettings: (settings: Partial<ThemeSettings>) => void;
  resetSettings: () => void;
}

const mergeSettings = (storedSettings: any): AppSettings => {
  if (!storedSettings || typeof storedSettings !== 'object') {
    return DEFAULT_SETTINGS;
  }

  try {
    return {
      indicators: {
        stochastic: {
          showMultiVariant: storedSettings.indicators?.stochastic?.showMultiVariant ?? storedSettings.indicators?.stochastic?.showMultiTimeframe ?? DEFAULT_SETTINGS.indicators.stochastic.showMultiVariant,
          overboughtLevel: storedSettings.indicators?.stochastic?.overboughtLevel ?? DEFAULT_SETTINGS.indicators.stochastic.overboughtLevel,
          oversoldLevel: storedSettings.indicators?.stochastic?.oversoldLevel ?? DEFAULT_SETTINGS.indicators.stochastic.oversoldLevel,
          variants: {
            fast9: {
              enabled: storedSettings.indicators?.stochastic?.variants?.fast9?.enabled ?? DEFAULT_SETTINGS.indicators.stochastic.variants.fast9.enabled,
              period: storedSettings.indicators?.stochastic?.variants?.fast9?.period ?? DEFAULT_SETTINGS.indicators.stochastic.variants.fast9.period,
              smoothK: storedSettings.indicators?.stochastic?.variants?.fast9?.smoothK ?? DEFAULT_SETTINGS.indicators.stochastic.variants.fast9.smoothK,
              smoothD: storedSettings.indicators?.stochastic?.variants?.fast9?.smoothD ?? DEFAULT_SETTINGS.indicators.stochastic.variants.fast9.smoothD,
            },
            fast14: {
              enabled: storedSettings.indicators?.stochastic?.variants?.fast14?.enabled ?? DEFAULT_SETTINGS.indicators.stochastic.variants.fast14.enabled,
              period: storedSettings.indicators?.stochastic?.variants?.fast14?.period ?? DEFAULT_SETTINGS.indicators.stochastic.variants.fast14.period,
              smoothK: storedSettings.indicators?.stochastic?.variants?.fast14?.smoothK ?? DEFAULT_SETTINGS.indicators.stochastic.variants.fast14.smoothK,
              smoothD: storedSettings.indicators?.stochastic?.variants?.fast14?.smoothD ?? DEFAULT_SETTINGS.indicators.stochastic.variants.fast14.smoothD,
            },
            fast40: {
              enabled: storedSettings.indicators?.stochastic?.variants?.fast40?.enabled ?? DEFAULT_SETTINGS.indicators.stochastic.variants.fast40.enabled,
              period: storedSettings.indicators?.stochastic?.variants?.fast40?.period ?? DEFAULT_SETTINGS.indicators.stochastic.variants.fast40.period,
              smoothK: storedSettings.indicators?.stochastic?.variants?.fast40?.smoothK ?? DEFAULT_SETTINGS.indicators.stochastic.variants.fast40.smoothK,
              smoothD: storedSettings.indicators?.stochastic?.variants?.fast40?.smoothD ?? DEFAULT_SETTINGS.indicators.stochastic.variants.fast40.smoothD,
            },
            full60: {
              enabled: storedSettings.indicators?.stochastic?.variants?.full60?.enabled ?? DEFAULT_SETTINGS.indicators.stochastic.variants.full60.enabled,
              period: storedSettings.indicators?.stochastic?.variants?.full60?.period ?? DEFAULT_SETTINGS.indicators.stochastic.variants.full60.period,
              smoothK: storedSettings.indicators?.stochastic?.variants?.full60?.smoothK ?? DEFAULT_SETTINGS.indicators.stochastic.variants.full60.smoothK,
              smoothD: storedSettings.indicators?.stochastic?.variants?.full60?.smoothD ?? DEFAULT_SETTINGS.indicators.stochastic.variants.full60.smoothD,
            },
          },
        },
        ema: {
          ema1: {
            enabled: storedSettings.indicators?.ema?.ema1?.enabled ?? DEFAULT_SETTINGS.indicators.ema.ema1.enabled,
            period: storedSettings.indicators?.ema?.ema1?.period ?? DEFAULT_SETTINGS.indicators.ema.ema1.period,
          },
          ema2: {
            enabled: storedSettings.indicators?.ema?.ema2?.enabled ?? DEFAULT_SETTINGS.indicators.ema.ema2.enabled,
            period: storedSettings.indicators?.ema?.ema2?.period ?? DEFAULT_SETTINGS.indicators.ema.ema2.period,
          },
          ema3: {
            enabled: storedSettings.indicators?.ema?.ema3?.enabled ?? DEFAULT_SETTINGS.indicators.ema.ema3.enabled,
            period: storedSettings.indicators?.ema?.ema3?.period ?? DEFAULT_SETTINGS.indicators.ema.ema3.period,
          },
        },
        macd: (() => {
          const storedMacd = storedSettings.indicators?.macd;

          // Check if we have the new timeframe structure
          if (storedMacd?.timeframes) {
            return {
              showMultiTimeframe: storedMacd.showMultiTimeframe ?? DEFAULT_SETTINGS.indicators.macd.showMultiTimeframe,
              timeframes: {
                '1m': {
                  enabled: storedMacd.timeframes['1m']?.enabled ?? DEFAULT_SETTINGS.indicators.macd.timeframes['1m'].enabled,
                  fastPeriod: storedMacd.timeframes['1m']?.fastPeriod ?? DEFAULT_SETTINGS.indicators.macd.timeframes['1m'].fastPeriod,
                  slowPeriod: storedMacd.timeframes['1m']?.slowPeriod ?? DEFAULT_SETTINGS.indicators.macd.timeframes['1m'].slowPeriod,
                  signalPeriod: storedMacd.timeframes['1m']?.signalPeriod ?? DEFAULT_SETTINGS.indicators.macd.timeframes['1m'].signalPeriod,
                },
                '5m': {
                  enabled: storedMacd.timeframes['5m']?.enabled ?? DEFAULT_SETTINGS.indicators.macd.timeframes['5m'].enabled,
                  fastPeriod: storedMacd.timeframes['5m']?.fastPeriod ?? DEFAULT_SETTINGS.indicators.macd.timeframes['5m'].fastPeriod,
                  slowPeriod: storedMacd.timeframes['5m']?.slowPeriod ?? DEFAULT_SETTINGS.indicators.macd.timeframes['5m'].slowPeriod,
                  signalPeriod: storedMacd.timeframes['5m']?.signalPeriod ?? DEFAULT_SETTINGS.indicators.macd.timeframes['5m'].signalPeriod,
                },
                '15m': {
                  enabled: storedMacd.timeframes['15m']?.enabled ?? DEFAULT_SETTINGS.indicators.macd.timeframes['15m'].enabled,
                  fastPeriod: storedMacd.timeframes['15m']?.fastPeriod ?? DEFAULT_SETTINGS.indicators.macd.timeframes['15m'].fastPeriod,
                  slowPeriod: storedMacd.timeframes['15m']?.slowPeriod ?? DEFAULT_SETTINGS.indicators.macd.timeframes['15m'].slowPeriod,
                  signalPeriod: storedMacd.timeframes['15m']?.signalPeriod ?? DEFAULT_SETTINGS.indicators.macd.timeframes['15m'].signalPeriod,
                },
                '1h': {
                  enabled: storedMacd.timeframes['1h']?.enabled ?? DEFAULT_SETTINGS.indicators.macd.timeframes['1h'].enabled,
                  fastPeriod: storedMacd.timeframes['1h']?.fastPeriod ?? DEFAULT_SETTINGS.indicators.macd.timeframes['1h'].fastPeriod,
                  slowPeriod: storedMacd.timeframes['1h']?.slowPeriod ?? DEFAULT_SETTINGS.indicators.macd.timeframes['1h'].slowPeriod,
                  signalPeriod: storedMacd.timeframes['1h']?.signalPeriod ?? DEFAULT_SETTINGS.indicators.macd.timeframes['1h'].signalPeriod,
                },
              },
            };
          }

          // Migrate old structure to new structure
          if (storedMacd && 'enabled' in storedMacd) {
            console.log('Migrating old MACD settings to new multi-timeframe structure');
            return {
              showMultiTimeframe: false,
              timeframes: {
                '1m': {
                  enabled: storedMacd.enabled ?? true,
                  fastPeriod: storedMacd.fastPeriod ?? 5,
                  slowPeriod: storedMacd.slowPeriod ?? 13,
                  signalPeriod: storedMacd.signalPeriod ?? 5,
                },
                '5m': { ...DEFAULT_SETTINGS.indicators.macd.timeframes['5m'] },
                '15m': { ...DEFAULT_SETTINGS.indicators.macd.timeframes['15m'] },
                '1h': { ...DEFAULT_SETTINGS.indicators.macd.timeframes['1h'] },
              },
            };
          }

          // Use defaults
          return DEFAULT_SETTINGS.indicators.macd;
        })(),
      },
      scanner: {
        enabled: storedSettings.scanner?.enabled ?? DEFAULT_SETTINGS.scanner.enabled,
        scanInterval: storedSettings.scanner?.scanInterval ?? DEFAULT_SETTINGS.scanner.scanInterval,
        topMarkets: storedSettings.scanner?.topMarkets ?? DEFAULT_SETTINGS.scanner.topMarkets,
        playSound: storedSettings.scanner?.playSound ?? DEFAULT_SETTINGS.scanner.playSound,
        stochasticScanner: {
          enabled: storedSettings.scanner?.stochasticScanner?.enabled ?? DEFAULT_SETTINGS.scanner.stochasticScanner.enabled,
          oversoldThreshold: storedSettings.scanner?.stochasticScanner?.oversoldThreshold ?? DEFAULT_SETTINGS.scanner.stochasticScanner.oversoldThreshold,
          overboughtThreshold: storedSettings.scanner?.stochasticScanner?.overboughtThreshold ?? DEFAULT_SETTINGS.scanner.stochasticScanner.overboughtThreshold,
        },
        emaAlignmentScanner: {
          enabled: storedSettings.scanner?.emaAlignmentScanner?.enabled ?? DEFAULT_SETTINGS.scanner.emaAlignmentScanner.enabled,
          timeframes: storedSettings.scanner?.emaAlignmentScanner?.timeframes ?? DEFAULT_SETTINGS.scanner.emaAlignmentScanner.timeframes,
          lookbackBars: storedSettings.scanner?.emaAlignmentScanner?.lookbackBars ?? DEFAULT_SETTINGS.scanner.emaAlignmentScanner.lookbackBars,
        },
        channelScanner: {
          enabled: storedSettings.scanner?.channelScanner?.enabled ?? DEFAULT_SETTINGS.scanner.channelScanner.enabled,
          timeframes: storedSettings.scanner?.channelScanner?.timeframes ?? DEFAULT_SETTINGS.scanner.channelScanner.timeframes,
          minTouches: storedSettings.scanner?.channelScanner?.minTouches ?? DEFAULT_SETTINGS.scanner.channelScanner.minTouches,
          pivotStrength: storedSettings.scanner?.channelScanner?.pivotStrength ?? DEFAULT_SETTINGS.scanner.channelScanner.pivotStrength,
          lookbackBars: storedSettings.scanner?.channelScanner?.lookbackBars ?? DEFAULT_SETTINGS.scanner.channelScanner.lookbackBars,
        },
      },
      orders: {
        cloudPercentage: storedSettings.orders?.cloudPercentage ?? DEFAULT_SETTINGS.orders.cloudPercentage,
        smallPercentage: storedSettings.orders?.smallPercentage ?? DEFAULT_SETTINGS.orders.smallPercentage,
        bigPercentage: storedSettings.orders?.bigPercentage ?? DEFAULT_SETTINGS.orders.bigPercentage,
      },
      theme: {
        selected: storedSettings.theme?.selected ?? DEFAULT_SETTINGS.theme.selected,
        playTradeSound: storedSettings.theme?.playTradeSound ?? DEFAULT_SETTINGS.theme.playTradeSound,
      },
    };
  } catch (error) {
    console.error('Error merging settings, using defaults:', error);
    return DEFAULT_SETTINGS;
  }
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      isPanelOpen: false,
      activeTab: 'scanner',
      settings: DEFAULT_SETTINGS,
      openPanel: () => set({ isPanelOpen: true }),
      closePanel: () => set({ isPanelOpen: false }),
      togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
      setActiveTab: (tab) => set({ activeTab: tab }),
      updateStochasticSettings: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            indicators: {
              ...state.settings.indicators,
              stochastic: {
                ...state.settings.indicators.stochastic,
                ...updates,
              },
            },
          },
        })),
      updateEmaSettings: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            indicators: {
              ...state.settings.indicators,
              ema: {
                ...state.settings.indicators.ema,
                ...updates,
              },
            },
          },
        })),
      updateMacdSettings: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            indicators: {
              ...state.settings.indicators,
              macd: {
                ...state.settings.indicators.macd,
                ...updates,
              },
            },
          },
        })),
      updateScannerSettings: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            scanner: {
              ...state.settings.scanner,
              ...updates,
            },
          },
        })),
      updateOrderSettings: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            orders: {
              ...state.settings.orders,
              ...updates,
            },
          },
        })),
      updateThemeSettings: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            theme: {
              ...state.settings.theme,
              ...updates,
            },
          },
        })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'hyperscalper-settings',
      partialize: (state) => ({ settings: state.settings }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { settings?: any };
        return {
          ...currentState,
          settings: mergeSettings(persisted?.settings),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('Settings loaded from localStorage');
        }
      },
    }
  )
);
