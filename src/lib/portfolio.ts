import type { Portfolio, Trade, TradeSide } from '../types'

export const STARTING_CASH = 100_000
const STORAGE_KEY = 'ashwick.portfolio.v1'
const FEE_BPS = 5 // 0.05% paper fee

export function createEmptyPortfolio(startingCash = STARTING_CASH): Portfolio {
  return {
    cash: startingCash,
    position: { quantity: 0, avgCost: 0 },
    trades: [],
    startingCash,
  }
}

export function loadPortfolio(): Portfolio {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyPortfolio()
    const parsed = JSON.parse(raw) as Portfolio
    if (
      typeof parsed.cash !== 'number' ||
      !parsed.position ||
      !Array.isArray(parsed.trades)
    ) {
      return createEmptyPortfolio()
    }
    return parsed
  } catch {
    return createEmptyPortfolio()
  }
}

export function savePortfolio(portfolio: Portfolio): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio))
}

export function equity(portfolio: Portfolio, markPrice: number): number {
  return portfolio.cash + portfolio.position.quantity * markPrice
}

export function unrealizedPnl(portfolio: Portfolio, markPrice: number): number {
  const { quantity, avgCost } = portfolio.position
  if (quantity === 0) return 0
  return (markPrice - avgCost) * quantity
}

export function realizedPnl(portfolio: Portfolio): number {
  // Approximate from trades: buys subtract, sells add vs cost — use cash delta vs start minus open cost basis
  const openCost = portfolio.position.quantity * portfolio.position.avgCost
  return portfolio.cash + openCost - portfolio.startingCash
}

export type OrderResult =
  | { ok: true; portfolio: Portfolio; trade: Trade }
  | { ok: false; error: string }

export function executeMarketOrder(
  portfolio: Portfolio,
  side: TradeSide,
  quantity: number,
  price: number,
): OrderResult {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: 'Quantity must be greater than zero.' }
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: 'No valid market price.' }
  }

  const notional = quantity * price
  const fee = (notional * FEE_BPS) / 10_000
  const trade: Trade = {
    id: crypto.randomUUID(),
    side,
    quantity,
    price,
    notional,
    fee,
    timestamp: Date.now(),
  }

  if (side === 'buy') {
    const cost = notional + fee
    if (cost > portfolio.cash) {
      return { ok: false, error: 'Insufficient paper cash.' }
    }
    const prevQty = portfolio.position.quantity
    const prevCost = portfolio.position.avgCost
    const newQty = prevQty + quantity
    const newAvg = newQty === 0 ? 0 : (prevQty * prevCost + notional) / newQty
    return {
      ok: true,
      trade,
      portfolio: {
        ...portfolio,
        cash: portfolio.cash - cost,
        position: { quantity: newQty, avgCost: newAvg },
        trades: [trade, ...portfolio.trades].slice(0, 200),
      },
    }
  }

  // sell
  if (quantity > portfolio.position.quantity + 1e-12) {
    return { ok: false, error: 'Not enough BTC in position.' }
  }
  const newQty = portfolio.position.quantity - quantity
  return {
    ok: true,
    trade,
    portfolio: {
      ...portfolio,
      cash: portfolio.cash + notional - fee,
      position: {
        quantity: newQty,
        avgCost: newQty === 0 ? 0 : portfolio.position.avgCost,
      },
      trades: [trade, ...portfolio.trades].slice(0, 200),
    },
  }
}

export function resetPortfolio(): Portfolio {
  const empty = createEmptyPortfolio()
  savePortfolio(empty)
  return empty
}
