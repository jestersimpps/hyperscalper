# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Next.js dev server on port 3001
npm run build     # Production build
npm start         # Run production build on port 3001
npm run lint      # ESLint (Next vitals + TS config)
```

No test framework is configured. `test_hl.mjs` at the repo root is an ad-hoc Hyperliquid SDK probe, not a test suite.

The app reads `HYPERLIQUID_PRIVATE_KEY`, `HYPERLIQUID_WALLET_ADDRESS`, `HYPERLIQUID_TESTNET`, and `EXCHANGE_TYPE` from `.env.local`. Wallet address is also derivable from the URL (`/[address]/...`) so read-only browsing works without a key.

## Architecture

### Exchange abstraction (partial)
`lib/exchange-provider.interface.ts` + `lib/exchange-factory.ts` and `lib/websocket/` define a provider-agnostic surface (`hyperliquid | binance | bybit`), but only the Hyperliquid implementation exists — binance/bybit branches throw. Keep new exchange-facing code behind these interfaces, and expect calls to `HyperliquidService` / `HyperliquidProvider` / `HyperliquidWebSocketService` as the concrete path.

### WebSocket lifecycle
`lib/websocket/websocket-singleton.ts` owns a single `ExchangeWebSocketService` instance shared across the app. Consumers call `useWebSocketService()` and must invoke the returned `trackSubscription()` — the singleton ref-counts subscribers and disconnects 30s after the last one drops. Do not instantiate the service directly; doing so breaks the ref-count and leaks sockets.

### State: Zustand stores in `stores/`
~18 stores, each owning one concern (candles, orders, positions, scanner, settings, trades, watchlist, websocket status, etc.). Cross-store coordination happens through direct `useXStore.getState()` calls — stores import and poke each other rather than going through a central bus. `useGlobalPollingStore` is the orchestrator: it holds the `HyperliquidService` and drives three poll loops (fast/slow/candle) that fan updates into order/position/volatility/top-symbols/candle stores.

### Optimistic order updates
`docs/optimistic-ui-updates.md` describes the pending-vs-confirmed order model used by `useOrderStore` + `useTradingStore` + `ScalpingChart`. Orders added optimistically are rendered dashed/50% opacity; they're reconciled against global-poll results by fuzzy-matching price/size/side, with a 10s TTL for orphans. When touching order placement, cancel, or stop-loss-move flows, preserve this add → confirm/rollback pattern.

### Routing
App Router under `app/[address]/...`. Address is a path param and flows to child pages via URL; prefer `lib/hooks/use-address-from-url.ts` over re-parsing. Main routes: `[symbol]/` (single-symbol trading), `multi-chart/[symbol]/`, `chart-popup/[symbol]/`, `watchlist/`, `trades/`.

### Indicators and signals
`lib/indicators.ts` is the math layer (EMA/MACD/RSI/Stochastic/Donchian/Keltner/pivots/divergence/S&R). `lib/services/scanner.service.ts` + `useScannerStore` apply these across symbols and timeframes. Divergence detection is debounced (~1000ms); chart redraws are RAF-throttled — see `lib/performance-utils.ts` before adding new recalculation triggers.

### Inverted mode
A global "short-focused" flip driven by settings. Use `lib/inverted-utils.ts` rather than open-coding color/side swaps — it centralizes bullish↔bearish, support↔resistance, and signal polarity.

### Theming
All colors live as CSS variables in `app/globals.css` (see `THEME.md`). Tailwind exposes them via `@theme inline` (`bg-bg-primary`, `text-bullish`, etc.). Chart colors must be read at runtime via `getComputedStyle(document.documentElement).getPropertyValue('--…')` — lightweight-charts can't consume Tailwind classes. `config/theme.ts` is a TS mirror for type-safety only; it does not drive rendering.

## Conventions

- Path alias `@/*` → repo root. Prefer `@/lib/...`, `@/stores/...`, `@/models/...`.
- Models (`models/*.ts`) are interface-only; keep behavior out of them.
- Next.js config sets `trailingSlash: true` and `images.unoptimized: true` — links and asset paths should respect the trailing slash.
- Port 3001 is baked into `dev`/`start` scripts and `NEXT_PUBLIC_WS_URL`; changing it requires updating both.
