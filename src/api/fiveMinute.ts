import type {
  FiveMinuteMarketSnapshot,
  PredictionWindowMinutes,
} from '../types'

const GAMMA = 'https://gamma-api.polymarket.com'
const CLOB = 'https://clob.polymarket.com'

export const FIVE_MIN_SECONDS = 300
export const THIRTY_MIN_SECONDS = 1800

export function windowSecondsFor(
  durationMinutes: PredictionWindowMinutes,
): number {
  return durationMinutes === 30 ? THIRTY_MIN_SECONDS : FIVE_MIN_SECONDS
}

export function floorWindowStart(
  durationMinutes: PredictionWindowMinutes = 5,
  nowMs = Date.now(),
): number {
  const sec = Math.floor(nowMs / 1000)
  const windowSec = windowSecondsFor(durationMinutes)
  return Math.floor(sec / windowSec) * windowSec
}

export function windowSlug(
  windowStart: number,
  durationMinutes: PredictionWindowMinutes = 5,
): string {
  return `btc-updown-${durationMinutes}m-${windowStart}`
}

function parseJsonArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map(String)
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

type GammaMarket = {
  id?: string
  question?: string
  outcomes?: string | string[]
  outcomePrices?: string | string[]
  clobTokenIds?: string | string[]
  volume?: string | number
  volumeNum?: number
  volume24hr?: number
  liquidity?: string | number
  liquidityNum?: number
  closed?: boolean
  active?: boolean
  acceptingOrders?: boolean
  bestBid?: number
  bestAsk?: number
  eventStartTime?: string
  endDate?: string
}

type GammaEvent = {
  id?: string
  title?: string
  slug?: string
  closed?: boolean
  active?: boolean
  startTime?: string
  endDate?: string
  volume?: number
  volume24hr?: number
  liquidity?: number | null
  markets?: GammaMarket[]
  eventMetadata?: { finalPrice?: number; priceToBeat?: number }
}

async function fetchEventBySlug(slug: string): Promise<GammaEvent | null> {
  const res = await fetch(`${GAMMA}/events/slug/${slug}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Gamma slug lookup failed: ${res.status}`)
  const data = (await res.json()) as GammaEvent | GammaEvent[]
  if (Array.isArray(data)) return data[0] ?? null
  return data?.id || data?.title ? data : null
}

async function fetchClobMid(tokenId: string): Promise<number | null> {
  try {
    const res = await fetch(`${CLOB}/midpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ token_id: tokenId }]),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, string>
    const mid = Number(data[tokenId])
    return Number.isFinite(mid) ? mid : null
  } catch {
    return null
  }
}

async function fetchClobBookDepth(tokenId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${CLOB}/book?token_id=${encodeURIComponent(tokenId)}`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      bids?: { size?: string }[]
      asks?: { size?: string }[]
    }
    const sum = (levels: { size?: string }[] | undefined) =>
      (levels ?? []).reduce((s, lvl) => s + (Number(lvl.size) || 0), 0)
    const depth = sum(data.bids) + sum(data.asks)
    return Number.isFinite(depth) && depth > 0 ? depth : null
  } catch {
    return null
  }
}

function pickVolume(market: GammaMarket, event: GammaEvent): number | null {
  const candidates = [
    market.volumeNum,
    Number(market.volume),
    market.volume24hr,
    event.volume24hr,
    event.volume,
  ]
  for (const v of candidates) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  }
  return null
}

function pickLiquidity(market: GammaMarket, event: GammaEvent): number | null {
  const candidates = [
    market.liquidityNum,
    Number(market.liquidity),
    event.liquidity,
  ]
  for (const v of candidates) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  }
  return null
}

function simulatedOdds(
  spotPrice: number | null,
  openPrice: number | null,
): {
  upPrice: number
  downPrice: number
} {
  if (spotPrice == null || openPrice == null || openPrice <= 0) {
    return { upPrice: 0.5, downPrice: 0.5 }
  }
  const moveBps = ((spotPrice - openPrice) / openPrice) * 10_000
  // Soft skew toward the side that is currently winning vs open.
  const skew = Math.max(-0.22, Math.min(0.22, moveBps / 40))
  const up = Math.max(0.08, Math.min(0.92, 0.5 + skew))
  return { upPrice: up, downPrice: 1 - up }
}

function simulatedSnapshot(
  durationMinutes: PredictionWindowMinutes,
  spotPrice: number | null,
  openPrice: number | null,
  nowMs: number,
): FiveMinuteMarketSnapshot {
  const windowSeconds = windowSecondsFor(durationMinutes)
  const windowStart = floorWindowStart(durationMinutes, nowMs)
  const windowEnd = windowStart + windowSeconds
  const sim = simulatedOdds(spotPrice, openPrice)
  const proxyVol =
    spotPrice != null && openPrice != null
      ? Math.abs(spotPrice - openPrice) * 10
      : null
  const label = `${durationMinutes}m`
  return {
    windowStart,
    windowEnd,
    windowSeconds,
    durationMinutes,
    slug: windowSlug(windowStart, durationMinutes),
    question: `Will BTC finish this ${label} window Up or Down vs open?`,
    title: `Practice · simulated Polymarket-style ${label}`,
    closed: nowMs / 1000 >= windowEnd,
    acceptingOrders: nowMs / 1000 < windowEnd,
    volume: proxyVol,
    liquidity: null,
    bookDepth: null,
    volumeSource: proxyVol != null ? 'proxy' : 'none',
    tokenUp: null,
    tokenDown: null,
    resolvedOutcome: null,
    priceToBeat: openPrice,
    finalPrice: null,
    ...sim,
    source: 'simulated',
    liveOdds: false,
  }
}

/**
 * Fetch short-duration BTC Up/Down market.
 * Tries Polymarket slug `btc-updown-{5|30}m-{windowStart}`; falls back to
 * clearly labeled simulated odds when Gamma has no market (typical for 30m).
 */
export async function fetchFiveMinuteMarket(
  spotPrice: number | null,
  openPrice: number | null,
  durationMinutes: PredictionWindowMinutes = 5,
  nowMs = Date.now(),
): Promise<FiveMinuteMarketSnapshot> {
  const windowSeconds = windowSecondsFor(durationMinutes)
  const windowStart = floorWindowStart(durationMinutes, nowMs)
  const windowEnd = windowStart + windowSeconds
  const slug = windowSlug(windowStart, durationMinutes)
  const label = `${durationMinutes}m`
  const base = {
    windowStart,
    windowEnd,
    windowSeconds,
    durationMinutes,
    slug,
    question: `Bitcoin Up or Down — next ${label}`,
    title: `Bitcoin Up or Down (${label})`,
    closed: nowMs / 1000 >= windowEnd,
    acceptingOrders: nowMs / 1000 < windowEnd,
    volume: null as number | null,
    liquidity: null as number | null,
    bookDepth: null as number | null,
    volumeSource: 'none' as const,
    tokenUp: null as string | null,
    tokenDown: null as string | null,
    resolvedOutcome: null as 'Up' | 'Down' | null,
    priceToBeat: openPrice,
    finalPrice: null as number | null,
  }

  try {
    const event = await fetchEventBySlug(slug)
    const market = event?.markets?.[0]
    if (!event || !market) {
      return simulatedSnapshot(durationMinutes, spotPrice, openPrice, nowMs)
    }

    const prices = parseJsonArray(market.outcomePrices).map(Number)
    const tokens = parseJsonArray(market.clobTokenIds)
    let upPrice = Number.isFinite(prices[0]) ? prices[0]! : 0.5
    let downPrice = Number.isFinite(prices[1]) ? prices[1]! : 1 - upPrice
    let bookDepth: number | null = null

    if (tokens[0]) {
      const [mid, depth] = await Promise.all([
        fetchClobMid(tokens[0]),
        fetchClobBookDepth(tokens[0]),
      ])
      if (mid != null) {
        upPrice = mid
        downPrice = 1 - mid
      }
      bookDepth = depth
    }

    const closed = Boolean(
      event.closed || market.closed || nowMs / 1000 >= windowEnd,
    )
    let resolvedOutcome: 'Up' | 'Down' | null = null
    if (closed) {
      if (upPrice >= 0.99) resolvedOutcome = 'Up'
      else if (downPrice >= 0.99) resolvedOutcome = 'Down'
      else if (
        event.eventMetadata?.finalPrice != null &&
        event.eventMetadata?.priceToBeat != null
      ) {
        resolvedOutcome =
          event.eventMetadata.finalPrice >= event.eventMetadata.priceToBeat
            ? 'Up'
            : 'Down'
      }
    }

    const volume = pickVolume(market, event)
    const liquidity = pickLiquidity(market, event)
    const volumeSource =
      volume != null ? 'polymarket' : bookDepth != null ? 'clob-book' : 'none'

    return {
      ...base,
      title: event.title ?? `Bitcoin Up or Down (${label})`,
      question: market.question ?? event.title ?? `Bitcoin Up or Down (${label})`,
      upPrice,
      downPrice,
      closed,
      acceptingOrders: market.acceptingOrders !== false && !closed,
      volume,
      liquidity,
      bookDepth,
      volumeSource,
      tokenUp: tokens[0] ?? null,
      tokenDown: tokens[1] ?? null,
      resolvedOutcome,
      priceToBeat: event.eventMetadata?.priceToBeat ?? openPrice,
      finalPrice: event.eventMetadata?.finalPrice ?? null,
      source: 'polymarket',
      liveOdds: true,
    }
  } catch {
    return simulatedSnapshot(durationMinutes, spotPrice, openPrice, nowMs)
  }
}

/** Resolve a closed window using Coinbase open/close when Polymarket metadata is missing. */
export function resolveFromSpot(
  openPrice: number | null,
  closePrice: number | null,
): 'Up' | 'Down' | null {
  if (openPrice == null || closePrice == null) return null
  return closePrice >= openPrice ? 'Up' : 'Down'
}
