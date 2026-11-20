import type { PolymarketEventCard, PolymarketOutcome } from '../types'

const GAMMA = 'https://gamma-api.polymarket.com'

type GammaMarket = {
  id?: string
  question?: string
  outcomePrices?: string | string[]
  outcomes?: string | string[]
  volume?: string | number
  volumeNum?: number
  lastTradePrice?: number | string
  closed?: boolean
  active?: boolean
}

type GammaEvent = {
  id?: string
  title?: string
  slug?: string
  volume?: number
  liquidity?: number | null
  markets?: GammaMarket[]
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

function toOutcome(m: GammaMarket): PolymarketOutcome | null {
  if (!m.question) return null
  const prices = parseJsonArray(m.outcomePrices).map(Number)
  const yesPrice = Number.isFinite(prices[0]) ? prices[0]! : 0
  const noPrice = Number.isFinite(prices[1]) ? prices[1]! : 1 - yesPrice
  const volume =
    typeof m.volumeNum === 'number'
      ? m.volumeNum
      : Number(m.volume) || 0
  const last =
    m.lastTradePrice != null && m.lastTradePrice !== ''
      ? Number(m.lastTradePrice)
      : null

  return {
    id: String(m.id ?? m.question),
    question: m.question,
    yesPrice,
    noPrice,
    volume,
    lastTradePrice: Number.isFinite(last) ? last : null,
  }
}

export async function fetchBtcPolymarkets(): Promise<PolymarketEventCard[]> {
  const url = new URL(`${GAMMA}/public-search`)
  url.searchParams.set('q', 'bitcoin')
  url.searchParams.set('limit_per_type', '6')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Polymarket search failed: ${res.status}`)
  const data = (await res.json()) as { events?: GammaEvent[] }
  const events = data.events ?? []

  return events
    .filter((e) => e.title && e.id)
    .map((e) => {
      const outcomes = (e.markets ?? [])
        .filter((m) => m.active !== false && m.closed !== true)
        .map(toOutcome)
        .filter((o): o is PolymarketOutcome => o != null)
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5)

      return {
        id: String(e.id),
        title: e.title!,
        slug: e.slug ?? '',
        volume: Number(e.volume) || 0,
        liquidity: e.liquidity ?? null,
        outcomes,
      }
    })
    .filter((e) => e.outcomes.length > 0)
    .slice(0, 4)
}
