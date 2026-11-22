import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchFiveMinuteMarket,
  floorWindowStart,
  resolveFromSpot,
  windowSlug,
} from '../api/fiveMinute'
import {
  closeFiveMinuteSide,
  loadFiveMinuteBook,
  markOpenPosition,
  placeFiveMinuteBet,
  rememberOpenPrice,
  resetFiveMinuteBook,
  saveFiveMinuteBook,
  settleWindow,
} from '../lib/fiveMinuteBook'
import type {
  FiveMinuteBook,
  FiveMinuteMarketSnapshot,
  FiveMinuteSide,
} from '../types'

export function useFiveMinuteMarket(spotPrice: number | null) {
  const [book, setBook] = useState<FiveMinuteBook>(() => loadFiveMinuteBook())
  const [market, setMarket] = useState<FiveMinuteMarketSnapshot | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const spotRef = useRef(spotPrice)
  spotRef.current = spotPrice
  const bookRef = useRef(book)
  bookRef.current = book
  const settlingRef = useRef<number | null>(null)

  useEffect(() => {
    saveFiveMinuteBook(book)
  }, [book])

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 2600)
    return () => window.clearTimeout(t)
  }, [flash])

  // Capture Coinbase open price once per window for settlement fallback.
  useEffect(() => {
    if (spotPrice == null) return
    const start = floorWindowStart()
    setBook((b) => rememberOpenPrice(b, start, spotPrice))
  }, [spotPrice, market?.windowStart])

  const refresh = useCallback(async () => {
    const start = floorWindowStart()
    const open =
      bookRef.current.openPrices[String(start)] ?? spotRef.current ?? null
    try {
      const snap = await fetchFiveMinuteMarket(spotRef.current, open)
      setMarket(snap)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '5m market fetch failed')
    }
  }, [])

  useEffect(() => {
    void refresh()
    const poll = window.setInterval(() => void refresh(), 5_000)
    const tick = window.setInterval(() => setNow(Date.now()), 250)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(tick)
    }
  }, [refresh])

  // Settle when the window rolls or Polymarket resolves.
  useEffect(() => {
    const currentStart = floorWindowStart(now)
    const openBets = book.openBets
    if (openBets.length === 0 && !market) return

    const windowsToSettle = new Set<number>()
    for (const bet of openBets) {
      if (bet.windowStart < currentStart) windowsToSettle.add(bet.windowStart)
    }
    if (
      market &&
      market.closed &&
      market.resolvedOutcome &&
      openBets.some((b) => b.windowStart === market.windowStart)
    ) {
      windowsToSettle.add(market.windowStart)
    }

    for (const ws of windowsToSettle) {
      if (settlingRef.current === ws) continue
      settlingRef.current = ws
      const openPx = book.openPrices[String(ws)] ?? null
      const closePx =
        ws === market?.windowStart
          ? (market.finalPrice ?? spotRef.current)
          : spotRef.current
      const pmOutcome =
        market?.windowStart === ws ? market.resolvedOutcome : null
      const outcome =
        pmOutcome ?? resolveFromSpot(openPx, closePx ?? null)
      if (!outcome) {
        settlingRef.current = null
        continue
      }
      const source =
        market?.windowStart === ws && market.source === 'polymarket' && pmOutcome
          ? 'polymarket'
          : 'simulated'
      setBook((b) =>
        settleWindow(
          b,
          ws,
          ws + 300,
          windowSlug(ws),
          outcome,
          source,
          openPx,
          closePx ?? null,
        ),
      )
      setFlash(`5m window settled · ${outcome}`)
      settlingRef.current = null
    }
  }, [now, book.openBets, book.openPrices, market])

  // Refresh market as soon as the window boundary flips.
  useEffect(() => {
    const start = floorWindowStart(now)
    if (market && market.windowStart !== start) {
      void refresh()
    }
  }, [now, market, refresh])

  const secondsLeft = useMemo(() => {
    const end = market?.windowEnd ?? floorWindowStart(now) + 300
    return Math.max(0, end - Math.floor(now / 1000))
  }, [market, now])

  const windowStart = market?.windowStart ?? floorWindowStart(now)

  const mark = useMemo(() => {
    if (!market) {
      return markOpenPosition(book, windowStart, 0.5, 0.5)
    }
    return markOpenPosition(book, windowStart, market.upPrice, market.downPrice)
  }, [book, market, windowStart])

  const buy = useCallback(
    (side: FiveMinuteSide, usdAmount: number) => {
      if (!market || market.closed || !market.acceptingOrders) {
        setError('This 5-minute window is closed.')
        return false
      }
      const price = side === 'Up' ? market.upPrice : market.downPrice
      const result = placeFiveMinuteBet(
        book,
        side,
        usdAmount,
        price,
        market.windowStart,
        market.source,
      )
      if (!result.ok) {
        setError(result.error)
        return false
      }
      setBook(result.book)
      setError(null)
      setFlash(
        `Paper bought ${side} · $${usdAmount.toFixed(2)} @ ${(price * 100).toFixed(1)}¢`,
      )
      return true
    },
    [book, market],
  )

  const sell = useCallback(
    (side: FiveMinuteSide) => {
      if (!market || market.closed) {
        setError('Cannot sell — window is closed (awaiting settle).')
        return false
      }
      const price = side === 'Up' ? market.upPrice : market.downPrice
      const openPx = book.openPrices[String(market.windowStart)] ?? null
      const result = closeFiveMinuteSide(
        book,
        side,
        price,
        market.windowStart,
        market.windowEnd,
        market.slug,
        market.source,
        openPx,
      )
      if (!result.ok) {
        setError(result.error)
        return false
      }
      setBook(result.book)
      setError(null)
      setFlash(
        `Sold ${side} · +$${result.proceeds.toFixed(2)} (P&L ${
          result.pnl >= 0 ? '+' : ''
        }$${result.pnl.toFixed(2)})`,
      )
      return true
    },
    [book, market],
  )

  const reset = useCallback(() => {
    setBook(resetFiveMinuteBook())
    setFlash('5m practice bankroll reset to $10,000')
    setError(null)
  }, [])

  return {
    book,
    market,
    secondsLeft,
    mark,
    buy,
    sell,
    reset,
    flash,
    error,
    clearError: () => setError(null),
    refresh,
  }
}
