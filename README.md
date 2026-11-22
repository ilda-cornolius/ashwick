# ASHWICK — Paper Bitcoin Desk

Paper (fake-money) Bitcoin trading terminal with live spot charts, RSI / support-resistance / volume tools, Polymarket prediction odds, and **Up/Down** practice windows (5m live Polymarket when available; 30m simulated when Polymarket has no series).

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

## Layout

1. **BTC / USD chart** (top-left of the desk) — indicators, candles, S/R.
2. **Up/Down buy & sell** docked **directly under the chart square** in the same panel (watch price while pressing Buy Up / Buy Down / Sell).
3. **Prediction window toggle:** **5 min** / **30 min**.
4. **Spot order ticket** beside the chart column.
5. Portfolio, volume, Polymarket events, and trade history remain in the desk grid below.
6. Themes (Dark desk / Aero glass / macOS Glass) + wallpaper stay in the top bar.

## What each feed is

| Feed | Source | Used for |
|------|--------|----------|
| **BTC-USD spot** (primary chart & fills) | [Coinbase Exchange public API](https://api.exchange.coinbase.com) — `/products/BTC-USD/candles`, `/ticker`, `/stats` | Candlesticks / line chart, volume bars, paper BTC order fills, Up/Down open/close settlement fallback |
| **Polymarket BTC odds** | [Gamma API](https://gamma-api.polymarket.com) — `/public-search?q=bitcoin` | Longer-horizon prediction-market Yes probabilities (sentiment), **not** spot price |
| **5m BTC Up/Down** | Gamma `events/slug/btc-updown-5m-{unix}` + CLOB `/midpoints` | Live short-duration Up/Down odds when the series is active |
| **30m BTC Up/Down** | Same slug pattern `btc-updown-30m-{unix}` when Polymarket lists it; otherwise **simulated** from Coinbase momentum and clearly labeled | Practice window with countdown, paper Yes/No buys |

No API keys required. Endpoints are public and CORS-friendly.

## How to practice Up/Down

1. Open `http://127.0.0.1:5173` — Up/Down sits **under the BTC chart**. Top bar jump link scrolls to `#updown-dock`.
2. Choose **5 min** or **30 min**.
3. Live mode shows a **Live odds** pill. Simulated mode shows **Simulated** (30m currently falls back here — Polymarket has no active 30m BTC Up/Down series).
4. Enter a USD stake and click **Buy Up** / **Buy Down**. Open positions show mark value; use **Sell Up** / **Sell Down** to exit early, or wait for expiry settle.
5. Practice cash starts at $10,000 (`ashwick.fiveMinute.v1`) and is separate from the BTC spot portfolio.

## Support / resistance

- Toggle **S/R** in the indicator bar.
- **Refresh levels** (chart header and indicator bar) re-runs `detectSupportResistance` and redraws levels on the chart.

## Features

- Paper portfolio ($100,000 starting cash) with buy/sell ticket, equity, unrealized P&amp;L, trade history
- Persistence via `localStorage` (`ashwick.portfolio.v1`, `ashwick.fiveMinute.v1`, `ashwick.appearance.v1`)
- Chart intervals: 1h / 6h / 1d; candle or line mode
- Indicators: RSI(14), volume histogram, auto-detected support/resistance with refresh
- Volume tracker panel (24h BTC volume + recent bar sparkline)
- Polymarket BTC markets panel with clear labeling vs spot
- Up/Down practice: 5m / 30m windows, live odds when available, countdown, paper buys, settlement, history
- **Appearance:** top-bar theme switcher **Dark desk / Aero glass / macOS Glass** + **Wallpaper** (Big Sur / Sierra / Sonoma / Harbor or upload). Persists in `ashwick.appearance.v1`.

## Notes / limitations

- Polymarket event prices are **prediction odds** (0–1 probability), not USD/BTC. The UI labels this explicitly.
- Up/Down paper trades never hit the real CLOB — odds are read-only; fills are local simulation.
- Spot candles come from Coinbase (Binance was geo-blocked in some environments).
- Paper BTC fills use the latest Coinbase ticker with a tiny simulated fee (5 bps).
- Spot data refreshes about every 30 seconds; Up/Down odds about every 5 seconds.
