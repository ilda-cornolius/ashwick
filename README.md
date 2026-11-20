# ASHWICK — Paper Bitcoin Desk

Paper (fake-money) Bitcoin trading terminal with live spot charts, RSI / support-resistance / volume tools, and Polymarket prediction odds for BTC-related markets.

## Run locally

Works on Apple Silicon and x86 — pure Vite + React + TypeScript (no native/x86-only deps).

```bash
cd paperwick
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## What each feed is

| Feed | Source | Used for |
|------|--------|----------|
| **BTC-USD spot** (primary chart & fills) | [Coinbase Exchange public API](https://api.exchange.coinbase.com) — `/products/BTC-USD/candles`, `/ticker`, `/stats` | Candlesticks / line chart, volume bars, paper order fills |
| **Polymarket BTC odds** | [Gamma API](https://gamma-api.polymarket.com) — `/public-search?q=bitcoin` | Prediction-market Yes probabilities & event volume (sentiment), **not** spot price |

No API keys required. Both endpoints are public and CORS-friendly.

## Features

- Paper portfolio ($100,000 starting cash) with buy/sell ticket, equity, unrealized P&amp;L, trade history
- Persistence via `localStorage` (`ashwick.portfolio.v1`)
- Chart intervals: 1h / 6h / 1d; candle or line mode
- Indicators: RSI(14), volume histogram, auto-detected support/resistance with markers
- Volume tracker panel (24h BTC volume + recent bar sparkline)
- Polymarket BTC markets panel with clear labeling vs spot

## Notes / limitations

- Polymarket prices are **prediction odds** (0–1 probability), not USD/BTC. The UI labels this explicitly.
- Spot candles come from Coinbase (Binance was geo-blocked in some environments).
- Paper fills use the latest Coinbase ticker with a tiny simulated fee (5 bps).
- Data refreshes about every 30 seconds.
