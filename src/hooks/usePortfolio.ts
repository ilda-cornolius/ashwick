import { useCallback, useEffect, useState } from 'react'
import {
  executeMarketOrder,
  loadPortfolio,
  resetPortfolio,
  savePortfolio,
} from '../lib/portfolio'
import type { Portfolio, TradeSide } from '../types'

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>(() => loadPortfolio())
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    savePortfolio(portfolio)
  }, [portfolio])

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 2400)
    return () => window.clearTimeout(t)
  }, [flash])

  const placeOrder = useCallback((side: TradeSide, quantity: number, price: number) => {
    setError(null)
    const result = executeMarketOrder(portfolio, side, quantity, price)
    if (!result.ok) {
      setError(result.error)
      return false
    }
    setPortfolio(result.portfolio)
    setFlash(
      `${side === 'buy' ? 'Bought' : 'Sold'} ${quantity.toFixed(6)} BTC @ $${price.toLocaleString()}`,
    )
    return true
  }, [portfolio])

  const reset = useCallback(() => {
    const empty = resetPortfolio()
    setPortfolio(empty)
    setFlash('Paper account reset to $100,000')
    setError(null)
  }, [])

  return { portfolio, placeOrder, reset, flash, error, clearError: () => setError(null) }
}
