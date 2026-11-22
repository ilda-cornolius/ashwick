# ASHWICK — Paper Bitcoin Desk

Paper (fake-money) Bitcoin trading terminal with live spot charts, RSI / support-resistance / volume tools, Polymarket prediction odds, and **5-minute Up/Down** practice windows (Polymarket-style).

## Run locally

Works on Apple Silicon and x86 — pure Vite + React + TypeScript (no native/x86-only deps).

```bash
cd /Users/ilda/ASHWICK
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

Production build:

```bash
npm run build
npm run preview
```

## What each feed is

| Feed | Source | Used for |
|------|--------|----------|
| **BTC-USD spot** (primary chart & fills) | [Coinbase Exchange public API](https://api.exchange.coinbase.com) — `/products/BTC-USD/candles`, `/ticker`, `/stats` | Candlesticks / line chart, volume bars, paper BTC order fills, 5m open/close settlement fallback |
| **Polymarket BTC odds** | [Gamma API](https://gamma-api.polymarket.com) — `/public-search?q=bitcoin` | Longer-horizon prediction-market Yes probabilities (sentiment), **not** spot price |
| **5m BTC Up/Down** | Gamma `events/slug/btc-updown-5m-{unix}` + CLOB `/midpoints` | Live short-duration Up/Down odds, countdown, paper Yes/No buys. If Gamma is unavailable, odds are **simulated** from Coinbase momentum and clearly labeled. |

No API keys required. Endpoints are public and CORS-friendly.

## How to practice 5-minute Up/Down

1. Open `http://127.0.0.1:5173` — the **5m Up/Down** panel is in the **left column of the first viewport** (next to the chart and order ticket). Top bar also has a green **5m Up/Down** jump link.
2. Watch the countdown for the current UTC-aligned 5-minute window (`btc-updown-5m-<floor(now/300)*300>`).
3. Live mode shows a **Live odds** pill and real Polymarket Up/Down cents. Simulated mode shows **Simulated**.
4. Enter a USD stake and click **Up (Yes)** or **Down (No)** — paper shares only; nothing is sent to Polymarket’s order book. **Window activity** shows Polymarket volume / CLOB book depth (or a labeled spot-move proxy in simulated mode).
5. Open positions show **mark value** and unrealized P&amp;L from live odds. Use **Sell Up** / **Sell Down** to exit early at current cents, or wait for expiry settle ($1 per winning share).
6. Review **Window history** for settled and early-exit P&amp;L. Practice cash starts at $10,000 (`ashwick.fiveMinute.v1` in localStorage) and is separate from the BTC spot portfolio.

## Features

- Paper portfolio ($100,000 starting cash) with buy/sell ticket, equity, unrealized P&amp;L, trade history
- Persistence via `localStorage` (`ashwick.portfolio.v1`, `ashwick.fiveMinute.v1`, `ashwick.appearance.v1`)
- Chart intervals: 1h / 6h / 1d; candle or line mode
- Indicators: RSI(14), volume histogram, auto-detected support/resistance with markers
- Volume tracker panel (24h BTC volume + recent bar sparkline)
- Polymarket BTC markets panel with clear labeling vs spot
- 5-minute Up/Down practice: live odds when available, countdown, paper buys, settlement, history
- **Appearance:** top-bar theme switcher **Dark desk / Aero glass / macOS Glass** + **Wallpaper** (Big Sur / Sierra / Sonoma / Harbor or upload). macOS Glass uses system `-apple-system` / SF Pro when present, vibrancy-style `backdrop-filter`, and traffic-light chrome. Persists in `ashwick.appearance.v1`.

## Notes / limitations

- Polymarket event prices are **prediction odds** (0–1 probability), not USD/BTC. The UI labels this explicitly.
- 5m paper trades never hit the real CLOB — odds are read-only; fills are local simulation.
- Spot candles come from Coinbase (Binance was geo-blocked in some environments).
- Paper BTC fills use the latest Coinbase ticker with a tiny simulated fee (5 bps).
- Spot data refreshes about every 30 seconds; 5m odds about every 5 seconds.
