'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { applyTheme } from '@/lib/theme-applier';

export default function ThemeApplier() {
  const theme = useSettingsStore((state) => state.settings.theme.selected);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return null;
}
