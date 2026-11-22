import type {
  FiveMinuteBet,
  FiveMinuteBook,
  FiveMinuteSide,
  FiveMinuteSource,
  FiveMinuteWindowRecord,
} from '../types'

export const FIVE_MIN_STARTING_CASH = 10_000
const STORAGE_KEY = 'ashwick.fiveMinute.v1'

export function createEmptyFiveMinuteBook(
  startingCash = FIVE_MIN_STARTING_CASH,
): FiveMinuteBook {
  return {
    cash: startingCash,
    startingCash,
    openBets: [],
    history: [],
    openPrices: {},
  }
}

export function loadFiveMinuteBook(): FiveMinuteBook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyFiveMinuteBook()
    const parsed = JSON.parse(raw) as FiveMinuteBook
    if (typeof parsed.cash !== 'number' || !Array.isArray(parsed.openBets)) {
      return createEmptyFiveMinuteBook()
    }
    const history = (Array.isArray(parsed.history) ? parsed.history : []).map(
      (h) => ({
        ...h,
        exitType: h.exitType ?? ('settled' as const),
      }),
    )
    return {
      ...createEmptyFiveMinuteBook(parsed.startingCash ?? FIVE_MIN_STARTING_CASH),
      ...parsed,
      openPrices: parsed.openPrices ?? {},
      history,
    }
  } catch {
    return createEmptyFiveMinuteBook()
  }
}

export function saveFiveMinuteBook(book: FiveMinuteBook): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(book))
}

export type FiveMinuteOrderResult =
  | { ok: true; book: FiveMinuteBook; bet: FiveMinuteBet }
  | { ok: false; error: string }

export function placeFiveMinuteBet(
  book: FiveMinuteBook,
  side: FiveMinuteSide,
  usdAmount: number,
  price: number,
  windowStart: number,
  source: FiveMinuteSource,
): FiveMinuteOrderResult {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
    return { ok: false, error: 'Stake must be greater than zero.' }
  }
  if (!Number.isFinite(price) || price <= 0.01 || price >= 0.99) {
    return { ok: false, error: 'No valid Up/Down odds right now.' }
  }
  if (usdAmount > book.cash + 1e-9) {
    return { ok: false, error: 'Insufficient 5m practice cash.' }
  }

  const shares = usdAmount / price
  const bet: FiveMinuteBet = {
    id: crypto.randomUUID(),
    windowStart,
    side,
    shares,
    price,
    cost: usdAmount,
    timestamp: Date.now(),
    source,
  }

  return {
    ok: true,
    bet,
    book: {
      ...book,
      cash: book.cash - usdAmount,
      openBets: [...book.openBets, bet],
    },
  }
}

export function rememberOpenPrice(
  book: FiveMinuteBook,
  windowStart: number,
  price: number,
): FiveMinuteBook {
  const key = String(windowStart)
  if (book.openPrices[key] != null) return book
  return {
    ...book,
    openPrices: { ...book.openPrices, [key]: price },
  }
}

export function settleWindow(
  book: FiveMinuteBook,
  windowStart: number,
  windowEnd: number,
  slug: string,
  outcome: FiveMinuteSide,
  source: FiveMinuteSource,
  openPrice: number | null,
  closePrice: number | null,
): FiveMinuteBook {
  const already = book.history.find((h) => h.windowStart === windowStart)
  if (already?.settledAt) return book

  const bets = book.openBets.filter((b) => b.windowStart === windowStart)
  const remainingOpen = book.openBets.filter((b) => b.windowStart !== windowStart)
  const cost = bets.reduce((s, b) => s + b.cost, 0)
  const payout = bets.reduce(
    (s, b) => s + (b.side === outcome ? b.shares : 0),
    0,
  )
  const pnl = payout - cost

  const record: FiveMinuteWindowRecord = {
    windowStart,
    windowEnd,
    slug,
    openPrice,
    closePrice,
    outcome,
    source,
    bets,
    payout,
    cost,
    pnl,
    settledAt: Date.now(),
    exitType: 'settled',
  }

  const nextOpenPrices = { ...book.openPrices }
  delete nextOpenPrices[String(windowStart)]

  return {
    ...book,
    cash: book.cash + payout,
    openBets: remainingOpen,
    history: [record, ...book.history].slice(0, 40),
    openPrices: nextOpenPrices,
  }
}

export function resetFiveMinuteBook(): FiveMinuteBook {
  const empty = createEmptyFiveMinuteBook()
  saveFiveMinuteBook(empty)
  return empty
}

export function openExposure(book: FiveMinuteBook, windowStart: number) {
  const bets = book.openBets.filter((b) => b.windowStart === windowStart)
  const upShares = bets.filter((b) => b.side === 'Up').reduce((s, b) => s + b.shares, 0)
  const downShares = bets
    .filter((b) => b.side === 'Down')
    .reduce((s, b) => s + b.shares, 0)
  const upCost = bets
    .filter((b) => b.side === 'Up')
    .reduce((s, b) => s + b.cost, 0)
  const downCost = bets
    .filter((b) => b.side === 'Down')
    .reduce((s, b) => s + b.cost, 0)
  const cost = upCost + downCost
  return { upShares, downShares, upCost, downCost, cost, bets }
}

/** Mark open paper shares to live Up/Down odds. */
export function markOpenPosition(
  book: FiveMinuteBook,
  windowStart: number,
  upPrice: number,
  downPrice: number,
) {
  const { upShares, downShares, upCost, downCost, cost, bets } = openExposure(
    book,
    windowStart,
  )
  const upMark = upShares * upPrice
  const downMark = downShares * downPrice
  const markValue = upMark + downMark
  const unrealized = markValue - cost
  return {
    upShares,
    downShares,
    upCost,
    downCost,
    cost,
    upMark,
    downMark,
    markValue,
    unrealized,
    bets,
  }
}

export type CloseResult =
  | { ok: true; book: FiveMinuteBook; proceeds: number; cost: number; pnl: number }
  | { ok: false; error: string }

/** Sell all open paper shares on one side at the current odds (early exit). */
export function closeFiveMinuteSide(
  book: FiveMinuteBook,
  side: FiveMinuteSide,
  price: number,
  windowStart: number,
  windowEnd: number,
  slug: string,
  source: FiveMinuteSource,
  openPrice: number | null,
): CloseResult {
  if (!Number.isFinite(price) || price <= 0.01 || price >= 0.99) {
    return { ok: false, error: 'No valid exit odds right now.' }
  }
  const sideBets = book.openBets.filter(
    (b) => b.windowStart === windowStart && b.side === side,
  )
  if (sideBets.length === 0) {
    return { ok: false, error: `No open ${side} position to sell.` }
  }

  const shares = sideBets.reduce((s, b) => s + b.shares, 0)
  const cost = sideBets.reduce((s, b) => s + b.cost, 0)
  const proceeds = shares * price
  const pnl = proceeds - cost

  const remainingOpen = book.openBets.filter(
    (b) => !(b.windowStart === windowStart && b.side === side),
  )

  const record: FiveMinuteWindowRecord = {
    windowStart,
    windowEnd,
    slug,
    openPrice,
    closePrice: null,
    outcome: side,
    source,
    bets: sideBets,
    payout: proceeds,
    cost,
    pnl,
    settledAt: Date.now(),
    exitType: 'early',
  }

  return {
    ok: true,
    proceeds,
    cost,
    pnl,
    book: {
      ...book,
      cash: book.cash + proceeds,
      openBets: remainingOpen,
      history: [record, ...book.history].slice(0, 40),
    },
  }
}
