import { latestRsi, detectSupportResistance } from '../lib/indicators'
import { formatUsd } from '../lib/format'
import type { Candle, ChartInterval, IndicatorToggles } from '../types'

type Props = {
  candles: Candle[]
  toggles: IndicatorToggles
  onToggle: (key: keyof IndicatorToggles) => void
  chartType: 'candle' | 'line'
  onChartType: (t: 'candle' | 'line') => void
  interval: ChartInterval
  onInterval: (i: ChartInterval) => void
  onRefreshLevels: () => void
}

export function IndicatorBar({
  candles,
  toggles,
  onToggle,
  chartType,
  onChartType,
  interval,
  onInterval,
  onRefreshLevels,
}: Props) {
  const rsi = latestRsi(candles)
  const levels = detectSupportResistance(candles)

  return (
    <div className="indicator-bar">
      <div className="toolbar-group">
        {(['1h', '6h', '1d'] as ChartInterval[]).map((i) => (
          <button
            key={i}
            type="button"
            className={interval === i ? 'active' : ''}
            onClick={() => onInterval(i)}
          >
            {i}
          </button>
        ))}
      </div>

      <div className="toolbar-group">
        <button
          type="button"
          className={chartType === 'candle' ? 'active' : ''}
          onClick={() => onChartType('candle')}
        >
          Candles
        </button>
        <button
          type="button"
          className={chartType === 'line' ? 'active' : ''}
          onClick={() => onChartType('line')}
        >
          Line
        </button>
      </div>

      <div className="toolbar-group">
        {(
          [
            ['rsi', 'RSI'],
            ['volume', 'Volume'],
            ['supportResistance', 'S/R'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={toggles[key] ? 'active' : ''}
            onClick={() => onToggle(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="ghost-btn refresh-levels-btn"
        onClick={onRefreshLevels}
        title="Re-run detectSupportResistance and redraw levels on the chart"
      >
        Refresh levels
      </button>

      <div className="indicator-readouts">
        <span>
          RSI 14{' '}
          <strong
            className={
              rsi != null && rsi > 70 ? 'down' : rsi != null && rsi < 30 ? 'up' : ''
            }
          >
            {rsi != null ? rsi.toFixed(1) : '—'}
          </strong>
        </span>
        {levels.slice(0, 2).map((l) => (
          <span key={`${l.kind}-${l.price}`}>
            {l.kind === 'support' ? 'Support' : 'Resist'}{' '}
            <strong className={l.kind === 'support' ? 'up' : 'down'}>
              {formatUsd(l.price, 0)}
            </strong>
          </span>
        ))}
      </div>
    </div>
  )
}
