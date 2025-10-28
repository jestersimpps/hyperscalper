export const getCSSVariable = (variableName: string): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();

  return value;
};

export const getThemeColors = () => {
  return {
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
  };
};
