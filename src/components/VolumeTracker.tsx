import { formatBtc, formatUsd } from '../lib/format'
import type { Candle } from '../types'

type Props = {
  candles: Candle[]
  volume24hBtc: number
  spotPrice: number | null
}

export function VolumeTracker({ candles, volume24hBtc, spotPrice }: Props) {
  const recent = candles.slice(-24)
  const sessionVol = recent.reduce((s, c) => s + c.volume, 0)
  const maxBar = Math.max(...recent.map((c) => c.volume), 1)
  const avgVol = recent.length ? sessionVol / recent.length : 0
  const last = candles[candles.length - 1]

  return (
    <section className="panel volume-tracker">
      <div className="panel-head">
        <h2>Volume tracker</h2>
        <span className="pill pill-muted">Coinbase BTC-USD</span>
      </div>

      <div className="stat-grid compact">
        <div>
          <span className="label">24h volume</span>
          <strong>{formatBtc(volume24hBtc)}</strong>
          <span className="muted">
            {spotPrice ? formatUsd(volume24hBtc * spotPrice, 0) : '—'}
          </span>
        </div>
        <div>
          <span className="label">Avg / bar</span>
          <strong>{avgVol.toFixed(2)} BTC</strong>
        </div>
        <div>
          <span className="label">Last bar</span>
          <strong>{last ? `${last.volume.toFixed(2)} BTC` : '—'}</strong>
        </div>
      </div>

      <div className="vol-bars" aria-hidden>
        {recent.map((c) => (
          <div
            key={c.time}
            className={`vol-bar ${c.close >= c.open ? 'up' : 'down'}`}
            style={{ height: `${Math.max(6, (c.volume / maxBar) * 100)}%` }}
            title={`${c.volume.toFixed(2)} BTC`}
          />
        ))}
      </div>
    </section>
  )
}
