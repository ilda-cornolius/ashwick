import { formatCompact, formatProb } from '../lib/format'
import type { PolymarketEventCard } from '../types'

type Props = {
  events: PolymarketEventCard[]
  loading: boolean
}

export function PolymarketPanel({ events, loading }: Props) {
  return (
    <section className="panel polymarket-panel">
      <div className="panel-head">
        <h2>Polymarket BTC</h2>
        <span className="pill pill-amber">Prediction odds</span>
      </div>
      <p className="feed-note">
        These are <strong>prediction-market probabilities</strong>, not BTC spot.
        Spot chart price comes from Coinbase Exchange (BTC-USD).
      </p>

      {loading && events.length === 0 ? (
        <p className="empty">Loading Polymarket markets…</p>
      ) : events.length === 0 ? (
        <p className="empty">No Bitcoin markets returned from Gamma API.</p>
      ) : (
        <div className="pm-events">
          {events.map((ev) => (
            <article key={ev.id} className="pm-event">
              <header>
                <h3>{ev.title}</h3>
                <span className="muted">Vol {formatCompact(ev.volume)}</span>
              </header>
              <ul>
                {ev.outcomes.slice(0, 3).map((o) => (
                  <li key={o.id}>
                    <span className="q">{o.question}</span>
                    <div className="odds">
                      <div
                        className="odds-bar"
                        style={{ width: `${Math.min(100, o.yesPrice * 100)}%` }}
                      />
                      <strong>{formatProb(o.yesPrice)} Yes</strong>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
