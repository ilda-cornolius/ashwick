import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchFiveMinuteMarket,
  floorWindowStart,
  resolveFromSpot,
  windowSecondsFor,
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
  PredictionWindowMinutes,
} from '../types'

export function useFiveMinuteMarket(
  spotPrice: number | null,
  durationMinutes: PredictionWindowMinutes = 5,
) {
  const [book, setBook] = useState<FiveMinuteBook>(() => loadFiveMinuteBook())
  const [market, setMarket] = useState<FiveMinuteMarketSnapshot | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const spotRef = useRef(spotPrice)
  spotRef.current = spotPrice
  const bookRef = useRef(book)
  bookRef.current = book
  const durationRef = useRef(durationMinutes)
  durationRef.current = durationMinutes
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
    const start = floorWindowStart(durationMinutes)
    setBook((b) => rememberOpenPrice(b, start, spotPrice))
  }, [spotPrice, market?.windowStart, durationMinutes])

  const refresh = useCallback(async () => {
    const mins = durationRef.current
    const start = floorWindowStart(mins)
    const open =
      bookRef.current.openPrices[String(start)] ?? spotRef.current ?? null
    try {
      const snap = await fetchFiveMinuteMarket(spotRef.current, open, mins)
      setMarket(snap)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Up/Down market fetch failed')
    }
  }, [])

  useEffect(() => {
    setMarket(null)
    void refresh()
    const poll = window.setInterval(() => void refresh(), 5_000)
    const tick = window.setInterval(() => setNow(Date.now()), 250)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(tick)
    }
  }, [refresh, durationMinutes])

  // Settle when any open bet's window ends (works across 5m and 30m).
  useEffect(() => {
    const nowSec = Math.floor(now / 1000)
    const openBets = book.openBets
    if (openBets.length === 0 && !market) return

    const windowsToSettle = new Map<
      number,
      { windowSeconds: number; durationMinutes: PredictionWindowMinutes }
    >()

    for (const bet of openBets) {
      const secs = bet.windowSeconds ?? 300
      if (bet.windowStart + secs <= nowSec) {
        windowsToSettle.set(bet.windowStart, {
          windowSeconds: secs,
          durationMinutes: bet.durationMinutes ?? (secs >= 1800 ? 30 : 5),
        })
      }
    }
    if (
      market &&
      market.closed &&
      market.resolvedOutcome &&
      openBets.some((b) => b.windowStart === market.windowStart)
    ) {
      windowsToSettle.set(market.windowStart, {
        windowSeconds: market.windowSeconds,
        durationMinutes: market.durationMinutes,
      })
    }

    for (const [ws, meta] of windowsToSettle) {
      if (settlingRef.current === ws) continue
      settlingRef.current = ws
      const openPx = book.openPrices[String(ws)] ?? null
      const closePx =
        ws === market?.windowStart
          ? (market.finalPrice ?? spotRef.current)
          : spotRef.current
      const pmOutcome =
        market?.windowStart === ws ? market.resolvedOutcome : null
      const outcome = pmOutcome ?? resolveFromSpot(openPx, closePx ?? null)
      if (!outcome) {
        settlingRef.current = null
        continue
      }
      const source =
        market?.windowStart === ws && market.source === 'polymarket' && pmOutcome
          ? 'polymarket'
          : 'simulated'
      const windowEnd = ws + meta.windowSeconds
      setBook((b) =>
        settleWindow(
          b,
          ws,
          windowEnd,
          windowSlug(ws, meta.durationMinutes),
          outcome,
          source,
          openPx,
          closePx ?? null,
        ),
      )
      setFlash(`${meta.durationMinutes}m window settled · ${outcome}`)
      settlingRef.current = null
    }
  }, [now, book.openBets, book.openPrices, market])

  // Refresh market as soon as the window boundary flips for the active duration.
  useEffect(() => {
    const start = floorWindowStart(durationMinutes, now)
    if (market && market.windowStart !== start) {
      void refresh()
    }
  }, [now, market, refresh, durationMinutes])

  const secondsLeft = useMemo(() => {
    const end =
      market?.windowEnd ??
      floorWindowStart(durationMinutes, now) + windowSecondsFor(durationMinutes)
    return Math.max(0, end - Math.floor(now / 1000))
  }, [market, now, durationMinutes])

  const windowStart =
    market?.windowStart ?? floorWindowStart(durationMinutes, now)

  const mark = useMemo(() => {
    if (!market) {
      return markOpenPosition(book, windowStart, 0.5, 0.5)
    }
    return markOpenPosition(book, windowStart, market.upPrice, market.downPrice)
  }, [book, market, windowStart])

  const buy = useCallback(
    (side: FiveMinuteSide, usdAmount: number) => {
      if (!market || market.closed || !market.acceptingOrders) {
        setError(`This ${market?.durationMinutes ?? durationMinutes}m window is closed.`)
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
        market.durationMinutes,
        market.windowSeconds,
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
    [book, market, durationMinutes],
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
    setFlash('Up/Down practice bankroll reset to $10,000')
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
