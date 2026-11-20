import type { Candle } from '../types'

/** Classic Wilder RSI */
export function computeRsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(closes.length).fill(null)
  if (closes.length <= period) return out

  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const change = closes[i]! - closes[i - 1]!
    if (change >= 0) avgGain += change
    else avgLoss -= change
  }
  avgGain /= period
  avgLoss /= period

  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i]! - closes[i - 1]!
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }

  return out
}

export type Level = {
  price: number
  kind: 'support' | 'resistance'
  touches: number
}

/**
 * Auto-detect support/resistance from local swing highs/lows,
 * clustered within a relative price tolerance.
 */
export function detectSupportResistance(candles: Candle[], lookback = 3, maxLevels = 4): Level[] {
  if (candles.length < lookback * 2 + 3) return []

  const swings: { price: number; kind: 'support' | 'resistance' }[] = []

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i]!
    let isLow = true
    let isHigh = true
    for (let j = 1; j <= lookback; j++) {
      if (c.low > candles[i - j]!.low || c.low > candles[i + j]!.low) isLow = false
      if (c.high < candles[i - j]!.high || c.high < candles[i + j]!.high) isHigh = false
    }
    if (isLow) swings.push({ price: c.low, kind: 'support' })
    if (isHigh) swings.push({ price: c.high, kind: 'resistance' })
  }

  if (swings.length === 0) return []

  const last = candles[candles.length - 1]!.close
  const tol = last * 0.004 // 0.4% cluster width

  type Cluster = { prices: number[]; kind: 'support' | 'resistance' }
  const clusters: Cluster[] = []

  for (const swing of swings) {
    const existing = clusters.find(
      (cl) =>
        cl.kind === swing.kind &&
        Math.abs(avg(cl.prices) - swing.price) <= tol,
    )
    if (existing) existing.prices.push(swing.price)
    else clusters.push({ prices: [swing.price], kind: swing.kind })
  }

  const levels: Level[] = clusters
    .map((cl) => ({
      price: avg(cl.prices),
      kind: cl.kind,
      touches: cl.prices.length,
    }))
    .sort((a, b) => b.touches - a.touches)

  // Prefer levels near the current price; require 2+ touches when plenty exist
  const near = levels.filter((l) => Math.abs(l.price - last) / last < 0.12)
  const pool = (near.length >= 2 ? near : levels).filter((l) =>
    near.length >= 4 ? l.touches >= 2 : true,
  )

  const scored = pool
    .map((l) => {
      // Re-label vs live price so broken supports become resistance, etc.
      const kind: Level['kind'] = l.price >= last ? 'resistance' : 'support'
      return {
        price: l.price,
        kind,
        touches: l.touches,
        score: l.touches * 2 - (Math.abs(l.price - last) / last) * 80,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxLevels)

  return scored.map(({ price, kind, touches }) => ({ price, kind, touches }))
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function latestRsi(candles: Candle[], period = 14): number | null {
  const series = computeRsi(
    candles.map((c) => c.close),
    period,
  )
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i]
  }
  return null
}
