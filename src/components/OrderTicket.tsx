import { useMemo, useState } from 'react'
import { formatUsd } from '../lib/format'
import type { TradeSide } from '../types'

type Props = {
  spotPrice: number | null
  cash: number
  btcHeld: number
  onSubmit: (side: TradeSide, quantity: number) => boolean
  disabled?: boolean
}

export function OrderTicket({ spotPrice, cash, btcHeld, onSubmit, disabled }: Props) {
  const [side, setSide] = useState<TradeSide>('buy')
  const [qtyInput, setQtyInput] = useState('0.01')
  const [mode, setMode] = useState<'btc' | 'usd'>('btc')

  const quantity = useMemo(() => {
    const n = Number(qtyInput)
    if (!Number.isFinite(n) || n <= 0 || !spotPrice) return 0
    return mode === 'btc' ? n : n / spotPrice
  }, [qtyInput, mode, spotPrice])

  const notional = spotPrice && quantity ? quantity * spotPrice : 0

  const setPct = (pct: number) => {
    if (!spotPrice) return
    if (side === 'buy') {
      const spend = cash * pct
      if (mode === 'usd') setQtyInput((spend).toFixed(2))
      else setQtyInput((spend / spotPrice).toFixed(6))
    } else {
      const sellQty = btcHeld * pct
      if (mode === 'btc') setQtyInput(sellQty.toFixed(6))
      else setQtyInput((sellQty * spotPrice).toFixed(2))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!spotPrice || quantity <= 0) return
    const ok = onSubmit(side, quantity)
    if (ok) setQtyInput(mode === 'btc' ? '0.01' : '500')
  }

  return (
    <form className="panel order-ticket" onSubmit={handleSubmit}>
      <div className="panel-head">
        <h2>Order ticket</h2>
        <span className="pill pill-muted">Paper market</span>
      </div>

      <div className="side-toggle" role="group" aria-label="Order side">
        <button
          type="button"
          className={side === 'buy' ? 'active buy' : ''}
          onClick={() => setSide('buy')}
        >
          Buy
        </button>
        <button
          type="button"
          className={side === 'sell' ? 'active sell' : ''}
          onClick={() => setSide('sell')}
        >
          Sell
        </button>
      </div>

      <div className="field-row">
        <label htmlFor="qty">Size</label>
        <div className="mode-toggle">
          <button type="button" className={mode === 'btc' ? 'active' : ''} onClick={() => setMode('btc')}>
            BTC
          </button>
          <button type="button" className={mode === 'usd' ? 'active' : ''} onClick={() => setMode('usd')}>
            USD
          </button>
        </div>
      </div>

      <input
        id="qty"
        className="input"
        inputMode="decimal"
        value={qtyInput}
        onChange={(e) => setQtyInput(e.target.value)}
        placeholder={mode === 'btc' ? '0.01' : '500'}
      />

      <div className="pct-row">
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <button key={p} type="button" onClick={() => setPct(p)}>
            {p === 1 ? 'Max' : `${p * 100}%`}
          </button>
        ))}
      </div>

      <dl className="order-meta">
        <div>
          <dt>Est. fill</dt>
          <dd>{spotPrice ? formatUsd(spotPrice) : '—'}</dd>
        </div>
        <div>
          <dt>Notional</dt>
          <dd>{notional ? formatUsd(notional) : '—'}</dd>
        </div>
        <div>
          <dt>Available</dt>
          <dd>{side === 'buy' ? formatUsd(cash) : `${btcHeld.toFixed(6)} BTC`}</dd>
        </div>
      </dl>

      <button
        type="submit"
        className={`cta ${side}`}
        disabled={disabled || !spotPrice || quantity <= 0}
      >
        {side === 'buy' ? 'Buy BTC' : 'Sell BTC'}
      </button>
    </form>
  )
}
