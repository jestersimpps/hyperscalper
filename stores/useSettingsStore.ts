import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, DEFAULT_SETTINGS, StochasticSettings } from '@/models/Settings';

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
  resetSettings: () => void;
}

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
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'hyperscalper-settings',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
