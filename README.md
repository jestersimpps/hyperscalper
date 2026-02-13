# HyperScalper

![HyperScalper Hero](public/landing/hero.png)

A professional real-time cryptocurrency trading terminal for Hyperliquid DEX with advanced technical analysis, multi-timeframe charting, and automated signal detection.

## Features

### Trading Terminal
- Real-time candlestick charts with TradingView lightweight-charts
- Multi-symbol support with live price tracking
- Position and order management with visual indicators
- One-click chart popups for multi-monitor setups
- Wallet change history tracking with 50/50 split panel view
- Real-time trade stream with grouping and filtering
- Support for multiple Hyperliquid addresses

### Technical Analysis
- **Indicators**: EMA (5/20/50), MACD, RSI, Stochastic Oscillator
- **Channels**: Donchian and Keltner channels
- **Support/Resistance**: Automatic detection with touch counting and distance calculation
- **Divergence Detection**: Regular and hidden divergences (MACD, RSI, Stochastic)
- **Pivot Points**: Automatic pivot high/low detection
- **Price Action**: Multi-variant signal detection across timeframes

### Scanner & Signals
- Real-time signal scanner across all symbols
- Bullish/bearish signal detection with confidence scoring
- Multi-timeframe analysis (1m, 5m, 15m, 1h, 4h, 1d)
- Divergence signal aggregation
- Mini price charts with signal visualization
- Inverted mode for shorting strategies

### Multi-Timeframe Analysis
- Synchronized multi-chart view (1m, 5m, 15m, 1h)
- Independent timeframe analysis
- Responsive grid layout
- Chart-specific settings and indicators

### Performance Optimizations
- Virtual scrolling for symbol and scanner lists
- RAF throttling for chart updates
- Debounced divergence detection
- Memoized calculations and components
- Optimized WebSocket subscriptions
- Efficient state management with Zustand

### UI/UX
- **Themes**: Terminal Green, Synthwave, Amber, Girly Pastels
- **Inverted Mode**: Flip colors for short-focused trading
- **Mobile Support**: Responsive design with touch-friendly interface
- **Tab Navigation**: Scanner, Symbols, All view modes
- **Keyboard Shortcuts**: Quick navigation and actions
- **Sound Notifications**: Customizable audio alerts
- **Price Blink Animations**: Visual feedback for price changes

### WebSocket Streams
- Live candle updates across all timeframes
- Real-time trade data with latency tracking
- Price ticker with 24h statistics
- Automatic reconnection and error handling
- Multi-subscription management

## Getting Started

### Prerequisites
- Node.js 18+
- Hyperliquid wallet address (read-only mode supported)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Application runs at [http://localhost:3001](http://localhost:3001)

### Production

```bash
npm run build
npm start
```

## Project Structure

```
hyperscalper/
├── app/
│   ├── [address]/
│   │   ├── [symbol]/          # Single symbol view
│   │   ├── multi-chart/       # Multi-timeframe view
│   │   ├── chart-popup/       # Popup windows
│   │   ├── watchlist/         # Watchlist page
│   │   └── trades/            # Trade history
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── layout/
│   │   ├── Sidepanel.tsx      # Symbol list & scanner
│   │   └── TerminalHeader.tsx # Header with controls
│   ├── scanner/               # Scanner components
│   ├── sidepanel/             # Symbol list components
│   ├── orders/                # Order management
│   ├── symbol/                # Symbol view
│   ├── ScalpingChart.tsx      # Main chart component
│   └── MultiTimeframeChart.tsx
├── stores/
│   ├── useSettingsStore.ts
│   ├── useScannerStore.ts
│   ├── usePositionStore.ts
│   ├── useOrderStore.ts
│   └── ...                    # 20+ Zustand stores
├── lib/
│   ├── indicators.ts          # Technical analysis
│   ├── websocket/             # WebSocket managers
│   ├── services/              # API services
│   ├── performance-utils.ts   # Optimization utilities
│   └── ...
├── hooks/                     # React hooks
├── models/                    # TypeScript interfaces
└── types/                     # Type definitions
```

## Technology Stack

- **Framework**: Next.js 16 with React 19
- **Language**: TypeScript 5
- **Styling**: TailwindCSS 4
- **Charts**: TradingView lightweight-charts 4.2
- **State**: Zustand 5
- **API**: @nktkas/hyperliquid SDK
- **WebSocket**: Native WebSocket with ws library
- **Virtualization**: @tanstack/react-virtual
- **Notifications**: react-hot-toast, sonner
- **Analytics**: Vercel Analytics

## Key Concepts

### Inverted Mode
Flips bullish/bearish colors and signals for traders focused on shorting. When enabled:
- Green becomes red and vice versa
- Support becomes resistance
- Bullish signals show as bearish
- All logic remains the same, only visual representation inverts

### Signal Detection
The scanner analyzes multiple factors:
- Stochastic crossovers (oversold/overbought)
- EMA alignment and crossovers
- MACD histogram and signal line crosses
- RSI extremes and divergences
- Volume spikes
- Channel breakouts/bounces
- Support/resistance proximity

### Performance Architecture
- Virtual scrolling renders only visible items (~5-10 vs 100+ DOM nodes)
- RAF throttling limits chart redraws to ~60fps
- Debounced divergence detection (1000ms) prevents constant recalculation
- Memoized components prevent unnecessary re-renders
- Optimized WebSocket subscription pooling

## Routes

- `/[address]/[symbol]` - Single symbol trading view
- `/[address]/multi-chart/[symbol]` - Multi-timeframe view
- `/[address]/watchlist` - Watchlist management
- `/[address]/trades` - Trade history
- `/[address]/chart-popup/[symbol]` - Popup chart window

## Settings

Access via settings panel (⚙️):
- **Chart**: Theme, inverted mode, indicators, channels
- **Scanner**: Signal filters, timeframes, divergence settings
- **Trading**: Position size, leverage, order types
- **UI**: Animations, sounds, mobile view preferences

## Keyboard Shortcuts

- `Ctrl/Cmd + K` - Quick symbol search
- `Ctrl/Cmd + M` - Toggle multi-chart view
- `Ctrl/Cmd + I` - Toggle inverted mode
- `Ctrl/Cmd + ,` - Open settings

## Contributing

This is a personal trading terminal project. Feel free to fork and customize for your own needs.

## License

Private use only.

## Author

Built by [Jo Vinkenroye](https://jovweb.dev)

## Disclaimer

This software is for educational and informational purposes only. Trading cryptocurrencies carries significant risk. Use at your own discretion. The authors are not responsible for any financial losses.
