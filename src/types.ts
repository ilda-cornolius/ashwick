export type Candle = {
  time: number // unix seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type TradeSide = 'buy' | 'sell'

export type Trade = {
  id: string
  side: TradeSide
  quantity: number
  price: number
  notional: number
  fee: number
  timestamp: number
}

export type Position = {
  quantity: number
  avgCost: number
}

export type Portfolio = {
  cash: number
  position: Position
  trades: Trade[]
  startingCash: number
}

export type PolymarketOutcome = {
  id: string
  question: string
  yesPrice: number
  noPrice: number
  volume: number
  lastTradePrice: number | null
}

export type PolymarketEventCard = {
  id: string
  title: string
  slug: string
  volume: number
  liquidity: number | null
  outcomes: PolymarketOutcome[]
}

export type ChartInterval = '1h' | '6h' | '1d'

export type IndicatorToggles = {
  rsi: boolean
  volume: boolean
  supportResistance: boolean
}
