import { useState } from 'react'
import { AppearanceControls } from './components/AppearanceControls'
import { FiveMinuteMarket } from './components/FiveMinuteMarket'
import { IndicatorBar } from './components/IndicatorBar'
import { OrderTicket } from './components/OrderTicket'
import { PolymarketPanel } from './components/PolymarketPanel'
import { PortfolioSummary } from './components/PortfolioSummary'
import { TradeHistory } from './components/TradeHistory'
import { TradingChart } from './components/TradingChart'
import { VolumeTracker } from './components/VolumeTracker'
import { useAppearance } from './hooks/useAppearance'
import { useFiveMinuteMarket } from './hooks/useFiveMinuteMarket'
import { useMarketData } from './hooks/useMarketData'
import { usePortfolio } from './hooks/usePortfolio'
import { formatUsd } from './lib/format'
import type {
  ChartInterval,
  IndicatorToggles,
  PredictionWindowMinutes,
} from './types'
import './App.css'

export default function App() {
  const [interval, setInterval] = useState<ChartInterval>('1h')
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle')
  const [toggles, setToggles] = useState<IndicatorToggles>({
    rsi: true,
    volume: true,
    supportResistance: true,
  })
  const [predictionWindow, setPredictionWindow] =
    useState<PredictionWindowMinutes>(5)
  const [levelsRevision, setLevelsRevision] = useState(0)

  const appearance = useAppearance()
  const market = useMarketData(interval)
  const { portfolio, placeOrder, reset, flash, error, clearError } =
    usePortfolio()
  const fiveMin = useFiveMinuteMarket(market.spotPrice, predictionWindow)

  const change24h =
    market.candles.length >= 25
      ? ((market.candles[market.candles.length - 1]!.close -
          market.candles[market.candles.length - 25]!.close) /
          market.candles[market.candles.length - 25]!.close) *
        100
      : null

  const refreshSupportLevels = () => {
    setToggles((t) => ({ ...t, supportResistance: true }))
    setLevelsRevision((n) => n + 1)
  }

  return (
    <div
      className={`app-shell theme-${appearance.prefs.mode}`}
      data-theme={appearance.prefs.mode}
    >
      <div
        className={`atmosphere${appearance.wallpaper ? ' has-wallpaper' : ''}`}
        aria-hidden
        style={
          appearance.wallpaper
            ? {
                backgroundImage: appearance.wallpaper,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      />

      <header className="topbar">
        <div className="brand-lockup">
          <span className="traffic-lights" aria-hidden>
            <i className="tl tl-close" />
            <i className="tl tl-min" />
            <i className="tl tl-zoom" />
          </span>
          <span className="brand-mark" aria-hidden />
          <div>
            <p className="brand-name">ASHWICK</p>
            <p className="brand-sub">Paper Bitcoin desk</p>
          </div>
        </div>

        <div className="live-strip">
          <div className="live-price">
            <span className="label">BTC-USD spot</span>
            <strong>
              {market.spotPrice != null ? formatUsd(market.spotPrice) : '—'}
            </strong>
            {change24h != null && (
              <span className={change24h >= 0 ? 'up' : 'down'}>
                {change24h >= 0 ? '+' : ''}
                {change24h.toFixed(2)}%
              </span>
            )}
          </div>
          <AppearanceControls
            mode={appearance.prefs.mode}
            wallpaperId={appearance.prefs.wallpaperId}
            hasCustom={!!appearance.prefs.customWallpaper}
            onMode={appearance.setMode}
            onWallpaper={appearance.setWallpaperId}
            onUpload={appearance.uploadWallpaper}
            onClearCustom={appearance.clearCustomWallpaper}
            error={appearance.error}
          />
          <a className="pill pill-five" href="#updown-dock">
            {predictionWindow}m Up/Down
          </a>
          <span className="pill pill-sim">Simulation · no real money</span>
        </div>
      </header>

      <main className="desk-main">
        <div className="chart-trade-row">
          <section className="hero-chart panel chart-panel chart-dominant">
            <div className="panel-head chart-head">
              <div>
                <h2>BTC / USD</h2>
                <p className="muted">
                  Primary price feed · Coinbase public API
                </p>
              </div>
              <div className="chart-head-actions">
                {market.status === 'loading' && (
                  <span className="pill">Loading…</span>
                )}
                {market.error && (
                  <span className="pill pill-warn">{market.error}</span>
                )}
              </div>
            </div>

            <IndicatorBar
              candles={market.candles}
              toggles={toggles}
              onToggle={(key) =>
                setToggles((t) => ({ ...t, [key]: !t[key] }))
              }
              chartType={chartType}
              onChartType={setChartType}
              interval={interval}
              onInterval={setInterval}
              onRefreshLevels={refreshSupportLevels}
            />

            <div className="chart-square">
              {market.candles.length > 0 ? (
                <TradingChart
                  candles={market.candles}
                  toggles={toggles}
                  chartType={chartType}
                  theme={appearance.prefs.mode}
                  levelsRevision={levelsRevision}
                />
              ) : (
                <div className="chart-placeholder">
                  {market.status === 'error'
                    ? 'Could not load candles.'
                    : 'Fetching candle history…'}
                </div>
              )}
            </div>

            <div className="chart-updown-dock" id="updown-dock">
              <FiveMinuteMarket
                market={fiveMin.market}
                book={fiveMin.book}
                secondsLeft={fiveMin.secondsLeft}
                mark={fiveMin.mark}
                durationMinutes={predictionWindow}
                onDuration={setPredictionWindow}
                onBuy={fiveMin.buy}
                onSell={fiveMin.sell}
                onReset={fiveMin.reset}
                flash={fiveMin.flash}
                error={fiveMin.error}
                onClearError={fiveMin.clearError}
                compact
              />
            </div>
          </section>

          <aside className="hero-ticket">
            <OrderTicket
              spotPrice={market.spotPrice}
              cash={portfolio.cash}
              btcHeld={portfolio.position.quantity}
              onSubmit={(side, qty) => {
                if (market.spotPrice == null) return false
                return placeOrder(side, qty, market.spotPrice)
              }}
              disabled={market.spotPrice == null}
            />
            {(flash || error) && (
              <div className={`toast ${error ? 'err' : 'ok'}`} role="status">
                {error ?? flash}
                {error && (
                  <button type="button" onClick={clearError}>
                    ×
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>

      <section className="desk-grid">
        <PortfolioSummary
          portfolio={portfolio}
          spotPrice={market.spotPrice}
          onReset={reset}
        />
        <VolumeTracker
          candles={market.candles}
          volume24hBtc={market.volume24h}
          spotPrice={market.spotPrice}
        />
        <PolymarketPanel
          events={market.polymarkets}
          loading={market.status === 'loading'}
        />
        <TradeHistory trades={portfolio.trades} />
      </section>

      <footer className="site-foot">
        <p>
          ASHWICK is a simulation. Spot candles &amp; ticker:{' '}
          <code>api.exchange.coinbase.com</code>. Prediction markets &amp;
          Up/Down (5m live / 30m when available, else simulated):{' '}
          <code>gamma-api.polymarket.com</code> +{' '}
          <code>clob.polymarket.com</code>. Portfolios persist in localStorage.
        </p>
      </footer>
    </div>
  )
}
