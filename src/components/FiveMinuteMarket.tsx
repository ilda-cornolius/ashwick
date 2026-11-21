import { useMemo, useState } from 'react'
import { formatProb, formatUsd } from '../lib/format'
import type {
  FiveMinuteBook,
  FiveMinuteMarketSnapshot,
  FiveMinuteSide,
} from '../types'

type Exposure = {
  upShares: number
  downShares: number
  cost: number
}

type Props = {
  market: FiveMinuteMarketSnapshot | null
  book: FiveMinuteBook
  secondsLeft: number
  exposure: Exposure
  onBuy: (side: FiveMinuteSide, usd: number) => boolean
  onReset: () => void
  flash: string | null
  error: string | null
  onClearError: () => void
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatWindow(start: number, end: number): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }
  const a = new Date(start * 1000).toLocaleTimeString(undefined, opts)
  const b = new Date(end * 1000).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${a} → ${b}`
}

export function FiveMinuteMarket({
  market,
  book,
  secondsLeft,
  exposure,
  onBuy,
  onReset,
  flash,
  error,
  onClearError,
}: Props) {
  const [stake, setStake] = useState('25')
  const stakeNum = Number(stake)
  const canTrade =
    !!market &&
    !market.closed &&
    market.acceptingOrders &&
    Number.isFinite(stakeNum) &&
    stakeNum > 0

  const progress = useMemo(() => {
    if (!market) return 0
    const total = market.windowEnd - market.windowStart
    return Math.min(100, ((total - secondsLeft) / total) * 100)
  }, [market, secondsLeft])

  const handleBuy = (side: FiveMinuteSide) => {
    if (!canTrade) return
    const ok = onBuy(side, stakeNum)
    if (ok) setStake('25')
  }

  return (
    <section className="panel five-min-panel">
      <div className="panel-head">
        <div>
          <h2>5-minute Up / Down</h2>
          <p className="muted five-min-sub">
            Polymarket-style short window · paper only
          </p>
        </div>
        <div className="five-min-pills">
          {market?.liveOdds ? (
            <span className="pill pill-blue">Live Gamma + CLOB</span>
          ) : (
            <span className="pill pill-warn">Practice · simulated</span>
          )}
          <button type="button" className="ghost-btn" onClick={onReset}>
            Reset bankroll
          </button>
        </div>
      </div>

      <p className="feed-note">
        {market?.liveOdds ? (
          <>
            Odds from Polymarket public <strong>Gamma</strong> /
            <strong> CLOB</strong> for slug{' '}
            <code>{market.slug}</code>. Buys are paper — no real PM orders.
            Settlement prefers Polymarket resolution; otherwise Coinbase spot
            open→close.
          </>
        ) : (
          <>
            Polymarket 5m market unavailable — showing{' '}
            <strong>practice / simulated Polymarket-style</strong> odds from
            Coinbase spot momentum. Windows still settle on Coinbase open vs
            close.
          </>
        )}
      </p>

      <div className="five-min-hero">
        <div className="five-min-timer">
          <span className="label">Time left</span>
          <strong className={secondsLeft <= 30 ? 'down' : ''}>
            {formatClock(secondsLeft)}
          </strong>
          <div className="timer-track" aria-hidden>
            <div className="timer-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="muted">
            {market
              ? formatWindow(market.windowStart, market.windowEnd)
              : 'Syncing window…'}
          </span>
        </div>

        <div className="five-min-bank">
          <span className="label">Practice cash</span>
          <strong>{formatUsd(book.cash)}</strong>
          <span className="muted">
            Open stake {formatUsd(exposure.cost)} · start{' '}
            {formatUsd(book.startingCash)}
          </span>
        </div>
      </div>

      <div className="five-min-odds">
        <button
          type="button"
          className="odds-card up"
          disabled={!canTrade}
          onClick={() => handleBuy('Up')}
        >
          <span className="label">Up (Yes)</span>
          <strong>{market ? formatProb(market.upPrice) : '—'}</strong>
          <span className="muted">
            {market ? `${(market.upPrice * 100).toFixed(1)}¢ · buy paper` : '…'}
          </span>
        </button>
        <button
          type="button"
          className="odds-card down"
          disabled={!canTrade}
          onClick={() => handleBuy('Down')}
        >
          <span className="label">Down (No)</span>
          <strong>{market ? formatProb(market.downPrice) : '—'}</strong>
          <span className="muted">
            {market
              ? `${(market.downPrice * 100).toFixed(1)}¢ · buy paper`
              : '…'}
          </span>
        </button>
      </div>

      <div className="five-min-stake">
        <label htmlFor="five-stake">Paper stake (USD)</label>
        <div className="stake-row">
          <input
            id="five-stake"
            className="input"
            inputMode="decimal"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
          />
          <div className="pct-row stake-presets">
            {[10, 25, 50, 100].map((n) => (
              <button key={n} type="button" onClick={() => setStake(String(n))}>
                ${n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(exposure.upShares > 0 || exposure.downShares > 0) && (
        <div className="stat-grid compact five-min-pos">
          <div>
            <span className="label">Open Up shares</span>
            <strong className="up">{exposure.upShares.toFixed(2)}</strong>
          </div>
          <div>
            <span className="label">Open Down shares</span>
            <strong className="down">{exposure.downShares.toFixed(2)}</strong>
          </div>
        </div>
      )}

      {(flash || error) && (
        <div className={`toast ${error ? 'err' : 'ok'}`} role="status">
          {error ?? flash}
          {error && (
            <button type="button" onClick={onClearError}>
              ×
            </button>
          )}
        </div>
      )}

      <div className="five-min-history">
        <div className="panel-head">
          <h3>Window history</h3>
          <span className="muted">{book.history.length} settled</span>
        </div>
        {book.history.length === 0 ? (
          <p className="empty">No settled 5m windows yet. Place a paper bet.</p>
        ) : (
          <ul className="five-hist-list">
            {book.history.slice(0, 12).map((h) => (
              <li key={h.windowStart}>
                <div className="trade-body">
                  <strong>
                    {new Date(h.windowStart * 1000).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}{' '}
                    · {h.outcome ?? '—'}
                  </strong>
                  <span className="muted">
                    {h.bets.length} bet{h.bets.length === 1 ? '' : 's'} ·{' '}
                    {h.source === 'polymarket' ? 'PM resolve' : 'spot settle'}
                    {h.openPrice != null && h.closePrice != null
                      ? ` · ${formatUsd(h.openPrice, 0)} → ${formatUsd(h.closePrice, 0)}`
                      : ''}
                  </span>
                </div>
                <span className={h.pnl >= 0 ? 'up' : 'down'}>
                  {h.pnl >= 0 ? '+' : ''}
                  {formatUsd(h.pnl)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
