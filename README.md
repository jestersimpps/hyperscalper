# BTC-USD Real-Time Chart

A Next.js frontend application displaying real-time BTC-USD perpetual futures candlestick charts using Hyperliquid API.

## Features

- Real-time candlestick charts with live WebSocket updates
- Multiple timeframe support (1m, 5m, 15m, 1h, 4h, 1d)
- Volume histogram display
- 24-hour market statistics (price, change, volume, high/low)
- Responsive dark theme design
- Powered by TradingView's lightweight-charts library

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Hyperliquid API credentials (uses parent directory's .env)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will be available at [http://localhost:3001](http://localhost:3001)

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/
│   ├── api/
│   │   ├── candles/     # Historical candle data endpoint
│   │   └── stream/      # Server-Sent Events for real-time updates
│   ├── layout.tsx
│   └── page.tsx         # Main chart page
├── components/
│   ├── CandlestickChart.tsx  # Main chart component
│   ├── ChartControls.tsx     # Interval selector
│   └── MarketStats.tsx       # Market statistics display
├── types/
│   └── index.ts         # TypeScript interfaces
└── .env.local           # Environment variables
```

## Technology Stack

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **lightweight-charts** - Candlestick charting
- **@nktkas/hyperliquid** - Hyperliquid API client
- **Server-Sent Events** - Real-time data streaming

## API Routes

### GET /api/candles
Fetches historical candlestick data

Query Parameters:
- `coin`: Trading pair (default: BTC)
- `interval`: Time interval (1m, 5m, 15m, 1h, 4h, 1d)
- `startTime`: Optional start timestamp
- `endTime`: Optional end timestamp

### GET /api/stream
Server-Sent Events stream for real-time candle updates

Query Parameters:
- `coin`: Trading pair (default: BTC)
- `interval`: Time interval

## Environment Variables

Copy `.env.local` or set the following:

```env
HYPERLIQUID_PRIVATE_KEY=your_private_key
HYPERLIQUID_WALLET_ADDRESS=your_wallet_address
HYPERLIQUID_TESTNET=false
```

## Notes

- This is a completely separate project from the trading bot in the parent directory
- Runs on port 3001 to avoid conflicts with the main project (port 3000)
- API keys are kept server-side for security
- Real-time updates use Server-Sent Events instead of WebSocket for easier Next.js integration
