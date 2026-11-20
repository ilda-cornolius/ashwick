import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchBtcCandles, fetchBtcTicker } from '../api/coinbase'
import { fetchBtcPolymarkets } from '../api/polymarket'
import type { Candle, ChartInterval, PolymarketEventCard } from '../types'

type Status = 'idle' | 'loading' | 'ready' | 'error'

export function useMarketData(interval: ChartInterval) {
  const [candles, setCandles] = useState<Candle[]>([])
  const [spotPrice, setSpotPrice] = useState<number | null>(null)
  const [volume24h, setVolume24h] = useState(0)
  const [polymarkets, setPolymarkets] = useState<PolymarketEventCard[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const intervalRef = useRef(interval)
  intervalRef.current = interval

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setStatus('loading')
    try {
      const [candleData, ticker, markets] = await Promise.all([
        fetchBtcCandles(intervalRef.current),
        fetchBtcTicker(),
        fetchBtcPolymarkets().catch(() => [] as PolymarketEventCard[]),
      ])
      setCandles(candleData)
      setSpotPrice(ticker.price)
      setVolume24h(ticker.volume24h)
      setPolymarkets(markets)
      setLastUpdated(Date.now())
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load market data')
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'))
    }
  }, [])

  useEffect(() => {
    void refresh(true)
  }, [interval, refresh])

  useEffect(() => {
    const id = window.setInterval(() => void refresh(false), 30_000)
    return () => window.clearInterval(id)
  }, [refresh])

  return {
    candles,
    spotPrice,
    volume24h,
    polymarkets,
    status,
    error,
    lastUpdated,
    refresh,
  }
}
