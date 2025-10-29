import { ThemeName } from '@/models/Settings';

export const applyTheme = (theme: ThemeName): void => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
};
