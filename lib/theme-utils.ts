export type ThemeColors = {
  backgroundPrimary: string;
  backgroundSecondary: string;
  borderFrame: string;
  primary: string;
  primaryMuted: string;
  primaryDark: string;
  accentBlue: string;
  accentBlueDark: string;
  accentRose: string;
  accentDarkBlue: string;
  statusBullish: string;
  statusBearish: string;
  statusBearishBg: string;
};

let cachedColors: ThemeColors | null = null;

export const getCSSVariable = (variableName: string): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();

  return value;
};

const readThemeColors = (): ThemeColors => ({
  backgroundPrimary: getCSSVariable('--background-primary'),
  backgroundSecondary: getCSSVariable('--background-secondary'),
  borderFrame: getCSSVariable('--border-frame'),
  primary: getCSSVariable('--primary'),
  primaryMuted: getCSSVariable('--primary-muted'),
  primaryDark: getCSSVariable('--primary-dark'),
  accentBlue: getCSSVariable('--accent-blue'),
  accentBlueDark: getCSSVariable('--accent-blue-dark'),
  accentRose: getCSSVariable('--accent-rose'),
  accentDarkBlue: getCSSVariable('--accent-dark-blue'),
  statusBullish: getCSSVariable('--status-bullish'),
  statusBearish: getCSSVariable('--status-bearish'),
  statusBearishBg: getCSSVariable('--status-bearish-bg'),
});

export const getThemeColors = (): ThemeColors => {
  if (typeof window === 'undefined') {
    return readThemeColors();
  }
  if (!cachedColors) {
    cachedColors = readThemeColors();
  }
  return cachedColors;
};

export const invalidateThemeColors = (): void => {
  cachedColors = null;
};
