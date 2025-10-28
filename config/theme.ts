export const theme = {
  colors: {
    background: {
      primary: '#0f1a1f',
      secondary: '#0f1e1e',
    },
    border: {
      frame: '#273035',
    },
    primary: {
      DEFAULT: '#44baba',
      muted: '#537270',
      dark: '#244140',
    },
    accent: {
      blue: '#3274aa',
      blueDark: '#29486b',
      rose: '#c2968d',
      darkBlue: '#22303d',
    },
    status: {
      bullish: '#26a69a',
      bearish: '#ef5350',
      bearishBg: '#633737',
    },
  },
} as const;

export type Theme = typeof theme;
