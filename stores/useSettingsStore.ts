import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, DEFAULT_SETTINGS, StochasticSettings, EmaSettings } from '@/models/Settings';

type TabType = 'scanner' | 'indicators' | 'orders';

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
          showMultiTimeframe: storedSettings.indicators?.stochastic?.showMultiTimeframe ?? DEFAULT_SETTINGS.indicators.stochastic.showMultiTimeframe,
          overboughtLevel: storedSettings.indicators?.stochastic?.overboughtLevel ?? DEFAULT_SETTINGS.indicators.stochastic.overboughtLevel,
          oversoldLevel: storedSettings.indicators?.stochastic?.oversoldLevel ?? DEFAULT_SETTINGS.indicators.stochastic.oversoldLevel,
          timeframes: {
            '1m': {
              enabled: storedSettings.indicators?.stochastic?.timeframes?.['1m']?.enabled ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['1m'].enabled,
              period: storedSettings.indicators?.stochastic?.timeframes?.['1m']?.period ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['1m'].period,
              smoothK: storedSettings.indicators?.stochastic?.timeframes?.['1m']?.smoothK ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['1m'].smoothK,
              smoothD: storedSettings.indicators?.stochastic?.timeframes?.['1m']?.smoothD ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['1m'].smoothD,
            },
            '5m': {
              enabled: storedSettings.indicators?.stochastic?.timeframes?.['5m']?.enabled ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['5m'].enabled,
              period: storedSettings.indicators?.stochastic?.timeframes?.['5m']?.period ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['5m'].period,
              smoothK: storedSettings.indicators?.stochastic?.timeframes?.['5m']?.smoothK ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['5m'].smoothK,
              smoothD: storedSettings.indicators?.stochastic?.timeframes?.['5m']?.smoothD ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['5m'].smoothD,
            },
            '15m': {
              enabled: storedSettings.indicators?.stochastic?.timeframes?.['15m']?.enabled ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['15m'].enabled,
              period: storedSettings.indicators?.stochastic?.timeframes?.['15m']?.period ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['15m'].period,
              smoothK: storedSettings.indicators?.stochastic?.timeframes?.['15m']?.smoothK ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['15m'].smoothK,
              smoothD: storedSettings.indicators?.stochastic?.timeframes?.['15m']?.smoothD ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['15m'].smoothD,
            },
            '1h': {
              enabled: storedSettings.indicators?.stochastic?.timeframes?.['1h']?.enabled ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['1h'].enabled,
              period: storedSettings.indicators?.stochastic?.timeframes?.['1h']?.period ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['1h'].period,
              smoothK: storedSettings.indicators?.stochastic?.timeframes?.['1h']?.smoothK ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['1h'].smoothK,
              smoothD: storedSettings.indicators?.stochastic?.timeframes?.['1h']?.smoothD ?? DEFAULT_SETTINGS.indicators.stochastic.timeframes['1h'].smoothD,
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
      },
      scanner: storedSettings.scanner ?? DEFAULT_SETTINGS.scanner,
      orders: storedSettings.orders ?? DEFAULT_SETTINGS.orders,
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
