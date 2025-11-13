'use client';

import { useSettingsStore } from '@/stores/useSettingsStore';

type MobileTabType = 'scanner' | 'symbols' | 'chart' | 'actions' | 'orders-positions';

interface TabConfig {
  id: MobileTabType;
  label: string;
}

const tabs: TabConfig[] = [
  { id: 'scanner', label: 'Scanner' },
  { id: 'symbols', label: 'Symbols' },
  { id: 'chart', label: 'Chart' },
  { id: 'actions', label: 'Actions' },
  { id: 'orders-positions', label: 'Orders' },
];

export const MobileTabBar = () => {
  const mobileActiveTab = useSettingsStore((state) => state.mobileActiveTab);
  const setMobileActiveTab = useSettingsStore((state) => state.setMobileActiveTab);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-bg-primary border-t-2 border-border-frame md:hidden z-50 max-w-full overflow-hidden">
      <div className="flex items-center justify-around h-14 w-full max-w-full">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMobileActiveTab(tab.id)}
            className={`flex-1 h-full flex items-center justify-center text-xs font-medium transition-colors ${
              mobileActiveTab === tab.id
                ? 'text-primary border-t-2 border-primary'
                : 'text-primary-muted hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};
