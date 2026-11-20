import { equity, unrealizedPnl } from '../lib/portfolio'
import { formatBtc, formatPct, formatUsd } from '../lib/format'
import type { Portfolio } from '../types'

type Props = {
  portfolio: Portfolio
  spotPrice: number | null
  onReset: () => void
}

export function PortfolioSummary({ portfolio, spotPrice, onReset }: Props) {
  const mark = spotPrice ?? 0
  const total = equity(portfolio, mark)
  const upnl = unrealizedPnl(portfolio, mark)
  const totalReturn = mark
    ? ((total - portfolio.startingCash) / portfolio.startingCash) * 100
    : 0
  const posValue = portfolio.position.quantity * mark

  return (
    <section className="panel portfolio-summary">
      <div className="panel-head">
        <h2>Portfolio</h2>
        <button type="button" className="ghost-btn" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="equity-block">
        <span className="label">Paper equity</span>
        <strong className="equity-value">{formatUsd(total)}</strong>
        <span className={`delta ${totalReturn >= 0 ? 'up' : 'down'}`}>
          {formatPct(totalReturn)} since start
        </span>
      </div>

      <div className="stat-grid">
        <div>
          <span className="label">Cash</span>
          <strong>{formatUsd(portfolio.cash)}</strong>
        </div>
        <div>
          <span className="label">BTC held</span>
          <strong>{formatBtc(portfolio.position.quantity)}</strong>
        </div>
        <div>
          <span className="label">Position value</span>
          <strong>{formatUsd(posValue)}</strong>
        </div>
        <div>
          <span className="label">Avg cost</span>
          <strong>
            {portfolio.position.quantity > 0
              ? formatUsd(portfolio.position.avgCost)
              : '—'}
          </strong>
        </div>
        <div>
          <span className="label">Unrealized P&amp;L</span>
          <strong className={upnl >= 0 ? 'up' : 'down'}>{formatUsd(upnl)}</strong>
        </div>
        <div>
          <span className="label">Trades</span>
          <strong>{portfolio.trades.length}</strong>
        </div>
      </div>
    </section>
  )
}
