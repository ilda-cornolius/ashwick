import type { Candle, ChartInterval } from '../types'

const BASE = 'https://api.exchange.coinbase.com'

const INTERVAL_MAP: Record<
  ChartInterval,
  { granularity: number; limit: number }
> = {
  '1h': { granularity: 3600, limit: 168 }, // 7 days of hourly
  '6h': { granularity: 21600, limit: 120 }, // 30 days of 6h
  '1d': { granularity: 86400, limit: 90 }, // 90 days
}

/** Coinbase candle: [time, low, high, open, close, volume] — newest first */
export async function fetchBtcCandles(interval: ChartInterval): Promise<Candle[]> {
  const { granularity, limit } = INTERVAL_MAP[interval]
  const end = Math.floor(Date.now() / 1000)
  const start = end - granularity * limit

  const url = new URL(`${BASE}/products/BTC-USD/candles`)
  url.searchParams.set('granularity', String(granularity))
  url.searchParams.set('start', new Date(start * 1000).toISOString())
  url.searchParams.set('end', new Date(end * 1000).toISOString())

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Coinbase candles failed: ${res.status}`)
  const raw = (await res.json()) as number[][]

  const candles: Candle[] = raw
    .map((row) => ({
      time: row[0]!,
      low: row[1]!,
      high: row[2]!,
      open: row[3]!,
      close: row[4]!,
      volume: row[5]!,
    }))
    .sort((a, b) => a.time - b.time)

  // Deduplicate by time (API can overlap)
  const seen = new Set<number>()
  return candles.filter((c) => {
    if (seen.has(c.time)) return false
    seen.add(c.time)
    return true
  })
}

export async function fetchBtcTicker(): Promise<{ price: number; volume24h: number }> {
  const [tickerRes, statsRes] = await Promise.all([
    fetch(`${BASE}/products/BTC-USD/ticker`),
    fetch(`${BASE}/products/BTC-USD/stats`),
  ])
  if (!tickerRes.ok) throw new Error(`Coinbase ticker failed: ${tickerRes.status}`)
  const ticker = (await tickerRes.json()) as { price: string }
  let volume24h = 0
  if (statsRes.ok) {
    const stats = (await statsRes.json()) as { volume: string }
    volume24h = Number(stats.volume) || 0
  }
  return { price: Number(ticker.price), volume24h }
}
