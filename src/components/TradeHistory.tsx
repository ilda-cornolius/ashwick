import { format } from 'date-fns'
import { formatUsd } from '../lib/format'
import type { Trade } from '../types'

type Props = { trades: Trade[] }

export function TradeHistory({ trades }: Props) {
  return (
    <section className="panel trade-history">
      <div className="panel-head">
        <h2>Recent trades</h2>
      </div>
      {trades.length === 0 ? (
        <p className="empty">No paper trades yet. Place a buy to open a position.</p>
      ) : (
        <ul className="trade-list">
          {trades.slice(0, 12).map((t) => (
            <li key={t.id}>
              <span className={`side-tag ${t.side}`}>{t.side}</span>
              <div className="trade-body">
                <strong>
                  {t.quantity.toFixed(6)} BTC @ {formatUsd(t.price)}
                </strong>
                <span className="muted">
                  {format(t.timestamp, 'MMM d · HH:mm')} · fee {formatUsd(t.fee)}
                </span>
              </div>
              <span className="trade-notional">{formatUsd(t.notional)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
