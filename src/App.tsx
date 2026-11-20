import { useState } from 'react'
import { IndicatorBar } from './components/IndicatorBar'
import { OrderTicket } from './components/OrderTicket'
import { PolymarketPanel } from './components/PolymarketPanel'
import { PortfolioSummary } from './components/PortfolioSummary'
import { TradeHistory } from './components/TradeHistory'
import { TradingChart } from './components/TradingChart'
import { VolumeTracker } from './components/VolumeTracker'
import { useMarketData } from './hooks/useMarketData'
import { usePortfolio } from './hooks/usePortfolio'
import { formatUsd } from './lib/format'
import type { ChartInterval, IndicatorToggles } from './types'
import './App.css'

export default function App() {
  const [interval, setInterval] = useState<ChartInterval>('1h')
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle')
  const [toggles, setToggles] = useState<IndicatorToggles>({
    rsi: true,
    volume: true,
    supportResistance: true,
  })

  const market = useMarketData(interval)
  const { portfolio, placeOrder, reset, flash, error, clearError } = usePortfolio()

  const change24h =
    market.candles.length >= 25
      ? ((market.candles[market.candles.length - 1]!.close -
          market.candles[market.candles.length - 25]!.close) /
          market.candles[market.candles.length - 25]!.close) *
        100
      : null

  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden />

      <header className="topbar">
        <div className="brand-lockup">
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
          <span className="pill pill-sim">Simulation · no real money</span>
        </div>
      </header>

      <main className="hero-stage">
        <section className="hero-copy">
          <h1>
            Trade Bitcoin
            <br />
            without the risk.
          </h1>
          <p>
            ASHWICK is a paper desk for BTC: live spot charts from Coinbase,
            Polymarket prediction odds for sentiment, RSI and support levels,
            and a full virtual portfolio that survives refresh.
          </p>
          <div className="feed-legend">
            <span>
              <i className="dot spot" /> Spot chart · Coinbase Exchange
            </span>
            <span>
              <i className="dot pm" /> Odds · Polymarket Gamma
            </span>
          </div>
        </section>

        <section className="hero-chart panel chart-panel">
          <div className="panel-head chart-head">
            <div>
              <h2>BTC / USD</h2>
              <p className="muted">Primary price feed · Coinbase public API</p>
            </div>
            {market.status === 'loading' && <span className="pill">Loading…</span>}
            {market.error && <span className="pill pill-warn">{market.error}</span>}
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
          />

          {market.candles.length > 0 ? (
            <TradingChart
              candles={market.candles}
              toggles={toggles}
              chartType={chartType}
            />
          ) : (
            <div className="chart-placeholder">
              {market.status === 'error'
                ? 'Could not load candles.'
                : 'Fetching candle history…'}
            </div>
          )}
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
          <code>api.exchange.coinbase.com</code>. Prediction markets:{' '}
          <code>gamma-api.polymarket.com</code>. Portfolio persists in
          localStorage.
        </p>
      </footer>
    </div>
  )
}
