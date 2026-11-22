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

export type FiveMinuteSide = 'Up' | 'Down'
export type FiveMinuteSource = 'polymarket' | 'simulated'

export type FiveMinuteVolumeSource = 'polymarket' | 'clob-book' | 'proxy' | 'none'

export type FiveMinuteMarketSnapshot = {
  windowStart: number
  windowEnd: number
  slug: string
  title: string
  question: string
  upPrice: number
  downPrice: number
  closed: boolean
  acceptingOrders: boolean
  /** Window traded volume (USD notional) when Gamma provides it */
  volume: number | null
  /** Gamma liquidity estimate when available */
  liquidity: number | null
  /** Combined CLOB bid+ask size on the Up token (share units) */
  bookDepth: number | null
  volumeSource: FiveMinuteVolumeSource
  tokenUp: string | null
  tokenDown: string | null
  resolvedOutcome: FiveMinuteSide | null
  priceToBeat: number | null
  finalPrice: number | null
  source: FiveMinuteSource
  liveOdds: boolean
}

export type FiveMinuteBet = {
  id: string
  windowStart: number
  side: FiveMinuteSide
  shares: number
  price: number
  cost: number
  timestamp: number
  source: FiveMinuteSource
}

export type FiveMinuteWindowRecord = {
  windowStart: number
  windowEnd: number
  slug: string
  openPrice: number | null
  closePrice: number | null
  outcome: FiveMinuteSide | null
  source: FiveMinuteSource
  bets: FiveMinuteBet[]
  payout: number
  cost: number
  pnl: number
  settledAt: number | null
  /** Window expiry settle vs early paper sell at live odds */
  exitType: 'settled' | 'early'
}

export type FiveMinuteBook = {
  cash: number
  startingCash: number
  openBets: FiveMinuteBet[]
  history: FiveMinuteWindowRecord[]
  /** Spot open prices captured for each window (for Coinbase settlement fallback). */
  openPrices: Record<string, number>
}
