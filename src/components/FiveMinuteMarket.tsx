import { useMemo, useState } from 'react'
import { formatCompact, formatProb, formatUsd } from '../lib/format'
import type {
  FiveMinuteBook,
  FiveMinuteMarketSnapshot,
  FiveMinuteSide,
  PredictionWindowMinutes,
} from '../types'

type Mark = {
  upShares: number
  downShares: number
  upCost: number
  downCost: number
  cost: number
  upMark: number
  downMark: number
  markValue: number
  unrealized: number
}

type Props = {
  market: FiveMinuteMarketSnapshot | null
  book: FiveMinuteBook
  secondsLeft: number
  mark: Mark
  durationMinutes: PredictionWindowMinutes
  onDuration: (m: PredictionWindowMinutes) => void
  onBuy: (side: FiveMinuteSide, usd: number) => boolean
  onSell: (side: FiveMinuteSide) => boolean
  onReset: () => void
  flash: string | null
  error: string | null
  onClearError: () => void
  /** Slim layout docked under the chart */
  compact?: boolean
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

function volumeLine(market: FiveMinuteMarketSnapshot | null): string {
  if (!market) return 'Vol —'
  if (market.volumeSource === 'polymarket' && market.volume != null) {
    const liq =
      market.liquidity != null ? ` · Liq ${formatCompact(market.liquidity)}` : ''
    return `Vol ${formatCompact(market.volume)}${liq}`
  }
  if (market.volumeSource === 'clob-book' && market.bookDepth != null) {
    return `CLOB depth ${market.bookDepth.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })} sh`
  }
  if (market.volumeSource === 'proxy' && market.volume != null) {
    return `Vol proxy ${formatCompact(market.volume)} · spot move`
  }
  if (market.bookDepth != null) {
    return `CLOB depth ${market.bookDepth.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })} sh`
  }
  return 'Vol unavailable'
}

export function FiveMinuteMarket({
  market,
  book,
  secondsLeft,
  mark,
  durationMinutes,
  onDuration,
  onBuy,
  onSell,
  onReset,
  flash,
  error,
  onClearError,
  compact = false,
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

  const hasOpen = mark.upShares > 0 || mark.downShares > 0
  const label = `${durationMinutes}m`

  const handleBuy = (side: FiveMinuteSide) => {
    if (!canTrade) return
    const ok = onBuy(side, stakeNum)
    if (ok) setStake('25')
  }

  return (
    <section
      className={`panel five-min-panel${compact ? ' five-min-compact' : ''}`}
    >
      <div className="panel-head five-min-head">
        <div>
          <h2>Up/Down</h2>
          <p className="muted five-min-sub">
            Prediction window · paper practice
          </p>
        </div>
        <div className="five-min-pills">
          <div
            className="toolbar-group duration-toggle"
            role="group"
            aria-label="Prediction window length"
          >
            {([5, 30] as PredictionWindowMinutes[]).map((m) => (
              <button
                key={m}
                type="button"
                className={durationMinutes === m ? 'active' : ''}
                onClick={() => onDuration(m)}
              >
                {m} min
              </button>
            ))}
          </div>
          {market?.liveOdds ? (
            <span className="pill pill-blue">Live odds</span>
          ) : (
            <span className="pill pill-warn">
              Simulated{durationMinutes === 30 ? ' · no PM 30m' : ''}
            </span>
          )}
          <button type="button" className="ghost-btn" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      <p className="feed-note">
        {market?.liveOdds ? (
          <>
            Live <strong>Gamma + CLOB</strong> {label} odds
            {compact ? '.' : <> for <code>{market.slug}</code>.</>} Buy or sell
            paper before the window ends — auto-settles at expiry.
          </>
        ) : (
          <>
            <strong>Practice / simulated {label}</strong> window
            {durationMinutes === 30
              ? ' (Polymarket has no active 30m BTC Up/Down series yet)'
              : ' from Coinbase spot'}
            . Settles on open→close.
          </>
        )}
      </p>

      {/* Buy + Sell on one row; open mark sits beside Buy and under Sell. */}
      <div className="five-min-odds" aria-label={`${label} Up Down buy and sell`}>
        <div className="odds-side">
          <div className="odds-buy-row">
            <button
              type="button"
              className="odds-card up"
              disabled={!canTrade}
              onClick={() => handleBuy('Up')}
            >
              <span className="label">Buy Up</span>
              <strong>{market ? formatProb(market.upPrice) : '—'}</strong>
              <span className="muted">
                {market ? `${(market.upPrice * 100).toFixed(1)}¢ · paper` : '…'}
              </span>
            </button>
            <div className="odds-position" aria-live="polite">
              <span className="label">Open Up</span>
              {mark.upShares > 0 ? (
                <>
                  <strong className="up">{mark.upShares.toFixed(2)} sh</strong>
                  <span className="muted">
                    Mark {formatUsd(mark.upMark)} · cost {formatUsd(mark.upCost)}
                  </span>
                  <span
                    className={
                      mark.upMark - mark.upCost >= 0 ? 'up' : 'down'
                    }
                  >
                    {mark.upMark - mark.upCost >= 0 ? '+' : ''}
                    {formatUsd(mark.upMark - mark.upCost)}
                  </span>
                </>
              ) : (
                <span className="muted">No open Up</span>
              )}
            </div>
          </div>
          <div className="odds-sell-col">
            <button
              type="button"
              className="sell-btn odds-sell"
              disabled={!market || market.closed || mark.upShares <= 0}
              onClick={() => onSell('Up')}
            >
              Sell Up
            </button>
            <div className="odds-position odds-position-under" aria-live="polite">
              {mark.upShares > 0 ? (
                <>
                  <span className="label">Mark</span>
                  <strong>{formatUsd(mark.upMark)}</strong>
                  <span className="muted">
                    {mark.upShares.toFixed(2)} sh
                    {market ? ` · @ ${(market.upPrice * 100).toFixed(1)}¢` : ''}
                  </span>
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
          </div>
        </div>
        <div className="odds-side">
          <div className="odds-buy-row">
            <button
              type="button"
              className="odds-card down"
              disabled={!canTrade}
              onClick={() => handleBuy('Down')}
            >
              <span className="label">Buy Down</span>
              <strong>{market ? formatProb(market.downPrice) : '—'}</strong>
              <span className="muted">
                {market
                  ? `${(market.downPrice * 100).toFixed(1)}¢ · paper`
                  : '…'}
              </span>
            </button>
            <div className="odds-position" aria-live="polite">
              <span className="label">Open Down</span>
              {mark.downShares > 0 ? (
                <>
                  <strong className="down">
                    {mark.downShares.toFixed(2)} sh
                  </strong>
                  <span className="muted">
                    Mark {formatUsd(mark.downMark)} · cost{' '}
                    {formatUsd(mark.downCost)}
                  </span>
                  <span
                    className={
                      mark.downMark - mark.downCost >= 0 ? 'up' : 'down'
                    }
                  >
                    {mark.downMark - mark.downCost >= 0 ? '+' : ''}
                    {formatUsd(mark.downMark - mark.downCost)}
                  </span>
                </>
              ) : (
                <span className="muted">No open Down</span>
              )}
            </div>
          </div>
          <div className="odds-sell-col">
            <button
              type="button"
              className="sell-btn odds-sell"
              disabled={!market || market.closed || mark.downShares <= 0}
              onClick={() => onSell('Down')}
            >
              Sell Down
            </button>
            <div className="odds-position odds-position-under" aria-live="polite">
              {mark.downShares > 0 ? (
                <>
                  <span className="label">Mark</span>
                  <strong>{formatUsd(mark.downMark)}</strong>
                  <span className="muted">
                    {mark.downShares.toFixed(2)} sh
                    {market
                      ? ` · @ ${(market.downPrice * 100).toFixed(1)}¢`
                      : ''}
                  </span>
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
          </div>
        </div>
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

      <div className="five-min-hero">
        <div className="five-min-timer">
          <span className="label">Time left · {label}</span>
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
            {hasOpen
              ? `Mark ${formatUsd(mark.markValue)} · cost ${formatUsd(mark.cost)}`
              : `Start ${formatUsd(book.startingCash)}`}
          </span>
        </div>
      </div>

      <div className="five-min-activity" aria-live="polite">
        <span className="label">Window activity</span>
        <strong>{volumeLine(market)}</strong>
        <span className="muted">
          {market?.volumeSource === 'polymarket'
            ? 'Polymarket window volume'
            : market?.volumeSource === 'clob-book'
              ? 'CLOB order-book depth proxy'
              : market?.volumeSource === 'proxy'
                ? 'Simulated activity proxy (spot move)'
                : 'Waiting for volume feed'}
          {market?.bookDepth != null && market.volumeSource === 'polymarket'
            ? ` · book ${market.bookDepth.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })} sh`
            : ''}
        </span>
      </div>

      {hasOpen && (
        <div className="five-min-open">
          <div className="five-min-mtm">
            <div>
              <span className="label">Open mark value</span>
              <strong>{formatUsd(mark.markValue)}</strong>
            </div>
            <div>
              <span className="label">Unrealized P&amp;L</span>
              <strong className={mark.unrealized >= 0 ? 'up' : 'down'}>
                {mark.unrealized >= 0 ? '+' : ''}
                {formatUsd(mark.unrealized)}
              </strong>
            </div>
          </div>

          {mark.upShares > 0 && (
            <div className="five-min-side-row">
              <div className="trade-body">
                <strong className="up">
                  Up · {mark.upShares.toFixed(2)} sh
                </strong>
                <span className="muted">
                  Mark {formatUsd(mark.upMark)} · cost {formatUsd(mark.upCost)}
                  {market
                    ? ` · @ ${(market.upPrice * 100).toFixed(1)}¢`
                    : ''}
                </span>
              </div>
            </div>
          )}

          {mark.downShares > 0 && (
            <div className="five-min-side-row">
              <div className="trade-body">
                <strong className="down">
                  Down · {mark.downShares.toFixed(2)} sh
                </strong>
                <span className="muted">
                  Mark {formatUsd(mark.downMark)} · cost{' '}
                  {formatUsd(mark.downCost)}
                  {market
                    ? ` · @ ${(market.downPrice * 100).toFixed(1)}¢`
                    : ''}
                </span>
              </div>
            </div>
          )}
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
          <span className="muted">{book.history.length} closed</span>
        </div>
        {book.history.length === 0 ? (
          <p className="empty">
            No settled Up/Down windows yet. Place a paper bet.
          </p>
        ) : (
          <ul className="five-hist-list">
            {book.history.slice(0, 12).map((h, i) => (
              <li key={`${h.windowStart}-${h.exitType}-${h.settledAt ?? i}`}>
                <div className="trade-body">
                  <strong>
                    {new Date(h.windowStart * 1000).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}{' '}
                    ·{' '}
                    {h.exitType === 'early'
                      ? `Sold ${h.outcome}`
                      : (h.outcome ?? '—')}
                  </strong>
                  <span className="muted">
                    {h.exitType === 'early' ? 'early exit' : 'settled'} ·{' '}
                    {h.source === 'polymarket' ? 'PM' : 'spot'}
                    {h.windowEnd - h.windowStart >= 1800
                      ? ' · 30m'
                      : ' · 5m'}
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
