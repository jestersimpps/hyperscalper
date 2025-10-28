# Theme Configuration

The application uses a centralized theme system for easy color management and theme switching.

## Changing the Theme

All theme colors are defined in a single location: `app/globals.css`

### Color Variables

The theme uses CSS custom properties (variables) defined in the `:root` selector:

```css
:root {
  --background-primary: #0f1a1f;
  --background-secondary: #0f1e1e;
  --border-frame: #273035;
  --primary: #44baba;
  --primary-muted: #537270;
  --primary-dark: #244140;
  --accent-blue: #3274aa;
  --accent-blue-dark: #29486b;
  --accent-rose: #c2968d;
  --accent-dark-blue: #22303d;
  --status-bullish: #26a69a;
  --status-bearish: #ef5350;
  --status-bearish-bg: #633737;
}
```

### Color Usage Guide

- **Background Colors**:
  - `--background-primary`: Main app background (currently: `#0f1a1f`)
  - `--background-secondary`: Alternative background for charts (currently: `#0f1e1e`)

- **Border Colors**:
  - `--border-frame`: Border color for UI frames and sections (currently: `#273035`)

- **Primary Colors**:
  - `--primary`: Main accent color (cyan/teal)
  - `--primary-muted`: Muted version for labels
  - `--primary-dark`: Dark version for borders/grid lines

- **Accent Colors**:
  - `--accent-blue`: Blue accent for indicators
  - `--accent-blue-dark`: Dark blue variant
  - `--accent-rose`: Rose/tan accent
  - `--accent-dark-blue`: Dark blue background

- **Status Colors**:
  - `--status-bullish`: Green for positive/up movements
  - `--status-bearish`: Red for negative/down movements
  - `--status-bearish-bg`: Dark red for backgrounds

### Using Theme Colors in Components

The colors are exposed as Tailwind CSS classes through the `@theme inline` directive:

```tsx
// Background colors
<div className="bg-bg-primary">...</div>
<div className="bg-bg-secondary">...</div>

// Border colors
<div className="border-border-frame">...</div>

// Text colors
<div className="text-primary">...</div>
<div className="text-primary-muted">...</div>
<div className="text-bullish">...</div>
<div className="text-bearish">...</div>

// Using CSS variables directly
<div style={{ color: 'var(--primary)' }}>...</div>
<div style={{ borderColor: 'var(--border-frame)' }}>...</div>
```

### Chart Colors

For TradingView Lightweight Charts, colors are read from CSS variables:

```typescript
const chart = createChart(container, {
  layout: {
    background: {
      color: getComputedStyle(document.documentElement)
        .getPropertyValue('--background-primary')
        .trim()
    },
    textColor: getComputedStyle(document.documentElement)
      .getPropertyValue('--primary-muted')
      .trim(),
  },
});
```

## Creating a New Theme

To create a new color theme:

1. Open `app/globals.css`
2. Modify the color values in the `:root` selector
3. Save the file - changes will hot-reload automatically
4. Optionally, create multiple theme variants by using CSS classes:

```css
:root {
  /* Default dark theme */
  --background-primary: #0f1a1f;
  /* ... other colors ... */
}

:root.light-theme {
  /* Light theme variant */
  --background-primary: #ffffff;
  --primary: #0088cc;
  /* ... override other colors ... */
}
```

## Theme Configuration File

The `config/theme.ts` file provides a TypeScript-typed theme object for reference:

```typescript
import { theme } from '@/config/theme';

// Access theme colors in TypeScript
const bgColor = theme.colors.background.primary;
const accentColor = theme.colors.accent.blue;
```

This file is useful for documentation and type-safety, but the actual theme is controlled via CSS variables in `globals.css`.
