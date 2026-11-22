import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import { computeRsi, detectSupportResistance } from '../lib/indicators'
import type { ThemeMode } from '../lib/theme'
import type { Candle, IndicatorToggles } from '../types'

type Props = {
  candles: Candle[]
  toggles: IndicatorToggles
  chartType: 'candle' | 'line'
  theme?: ThemeMode
  /** Bump to force re-running detectSupportResistance and redrawing S/R lines. */
  levelsRevision?: number
}

const ZOOM_IN = 0.8
const ZOOM_OUT = 1.25

function zoomLogicalRange(
  chart: IChartApi,
  factor: number,
  barCount: number,
) {
  const ts = chart.timeScale()
  const range = ts.getVisibleLogicalRange()
  if (!range) return

  const mid = (range.from + range.to) / 2
  const span = Math.max((range.to - range.from) * factor, 2)
  let from = mid - span / 2
  let to = mid + span / 2

  // Keep a little padding past the data so pan still feels open when zoomed.
  const min = -2
  const max = Math.max(barCount + 1, to)
  if (from < min) {
    to += min - from
    from = min
  }
  if (to > max) {
    from -= to - max
    to = max
    from = Math.max(min, from)
  }

  ts.setVisibleLogicalRange({ from, to })
}

export function TradingChart({
  candles,
  toggles,
  chartType,
  theme = 'desk',
  levelsRevision = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const savedRangeRef = useRef<LogicalRange | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const lightUi = theme === 'aero' || theme === 'macos'
    const textColor = lightUi ? '#3c3c43' : '#8b93a7'
    const gridColor = lightUi
      ? 'rgba(60, 60, 67, 0.1)'
      : 'rgba(139, 147, 167, 0.08)'
    const borderColor = lightUi
      ? 'rgba(60, 60, 67, 0.18)'
      : 'rgba(139, 147, 167, 0.15)'
    const cross =
      theme === 'macos'
        ? 'rgba(0, 122, 255, 0.4)'
        : theme === 'aero'
          ? 'rgba(0, 122, 255, 0.35)'
          : 'rgba(232, 184, 74, 0.35)'

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        vertLine: { color: cross, width: 1, style: 2 },
        horzLine: { color: cross, width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor,
        scaleMargins: {
          top: 0.08,
          bottom: toggles.volume || toggles.rsi ? 0.28 : 0.08,
        },
      },
      timeScale: {
        borderColor,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        minBarSpacing: 0.5,
        // Keep room to pan after wheel/pinch zoom.
        lockVisibleTimeRangeOnResize: true,
      },
      // Wheel/trackpad → zoom; drag / touch → pan while zoomed.
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      kineticScroll: {
        touch: true,
        mouse: false,
      },
      autoSize: true,
    })

    chartRef.current = chart

    let candleSeries: ISeriesApi<'Candlestick'> | null = null
    let lineSeries: ISeriesApi<'Line'> | null = null
    let volumeSeries: ISeriesApi<'Histogram'> | null = null
    let rsiSeries: ISeriesApi<'Line'> | null = null

    if (chartType === 'candle') {
      candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#3dcf8e',
        downColor: '#f07178',
        borderUpColor: '#3dcf8e',
        borderDownColor: '#f07178',
        wickUpColor: '#3dcf8e',
        wickDownColor: '#f07178',
      })
      candleSeries.setData(
        candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      )
    } else {
      lineSeries = chart.addSeries(LineSeries, {
        color: lightUi ? '#007aff' : '#e8b84a',
        lineWidth: 2,
        priceLineVisible: false,
      })
      lineSeries.setData(
        candles.map((c) => ({ time: c.time as Time, value: c.close })),
      )
    }

    const primary = candleSeries ?? lineSeries

    if (toggles.volume) {
      volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
      })
      volumeSeries.setData(
        candles.map((c) => ({
          time: c.time as Time,
          value: c.volume,
          color:
            c.close >= c.open
              ? 'rgba(61, 207, 142, 0.35)'
              : 'rgba(240, 113, 120, 0.35)',
        })),
      )
    }

    if (toggles.rsi) {
      rsiSeries = chart.addSeries(LineSeries, {
        color: '#7eb8ff',
        lineWidth: 1,
        priceScaleId: 'rsi',
        priceLineVisible: false,
        lastValueVisible: true,
      })
      chart.priceScale('rsi').applyOptions({
        scaleMargins: { top: 0.82, bottom: toggles.volume ? 0.12 : 0 },
      })
      const rsi = computeRsi(candles.map((c) => c.close))
      rsiSeries.setData(
        candles
          .map((c, i) =>
            rsi[i] == null
              ? null
              : { time: c.time as Time, value: rsi[i]! },
          )
          .filter((d): d is { time: Time; value: number } => d != null),
      )
    }

    if (toggles.supportResistance && primary) {
      const levels = detectSupportResistance(candles)
      for (const level of levels) {
        primary.createPriceLine({
          price: level.price,
          color: level.kind === 'support' ? '#3dcf8e' : '#f07178',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: level.kind === 'support' ? 'S' : 'R',
        })
      }

      const markers: SeriesMarker<Time>[] = []
      for (const level of levels.slice(0, 3)) {
        let bestIdx = 0
        let bestDist = Infinity
        for (let i = 0; i < candles.length; i++) {
          const ref =
            level.kind === 'support' ? candles[i]!.low : candles[i]!.high
          const dist = Math.abs(ref - level.price)
          if (dist < bestDist) {
            bestDist = dist
            bestIdx = i
          }
        }
        markers.push({
          time: candles[bestIdx]!.time as Time,
          position: level.kind === 'support' ? 'belowBar' : 'aboveBar',
          color: level.kind === 'support' ? '#3dcf8e' : '#f07178',
          shape: level.kind === 'support' ? 'arrowUp' : 'arrowDown',
          text: level.kind === 'support' ? 'Support' : 'Resist',
        })
      }
      markers.sort((a, b) => Number(a.time) - Number(b.time))
      createSeriesMarkers(primary, markers)
    }

    const saved = savedRangeRef.current
    if (saved) {
      chart.timeScale().setVisibleLogicalRange(saved)
    } else {
      chart.timeScale().fitContent()
    }

    const onRange = (range: LogicalRange | null) => {
      if (range) savedRangeRef.current = range
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange)

    // Keep page from scrolling while trackpad/wheel zooms the chart.
    const el = containerRef.current
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('wheel', onWheel)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange)
      chart.remove()
      chartRef.current = null
    }
  }, [candles, toggles, chartType, theme, levelsRevision])

  const zoomIn = () => {
    const chart = chartRef.current
    if (!chart) return
    zoomLogicalRange(chart, ZOOM_IN, candles.length)
  }

  const zoomOut = () => {
    const chart = chartRef.current
    if (!chart) return
    zoomLogicalRange(chart, ZOOM_OUT, candles.length)
  }

  const resetZoom = () => {
    const chart = chartRef.current
    if (!chart) return
    savedRangeRef.current = null
    chart.timeScale().fitContent()
  }

  return (
    <div className="chart-stage">
      <div className="chart-zoom-controls" role="toolbar" aria-label="Chart zoom">
        <button type="button" title="Zoom in" onClick={zoomIn}>
          +
        </button>
        <button type="button" title="Zoom out" onClick={zoomOut}>
          −
        </button>
        <button type="button" title="Reset zoom" onClick={resetZoom}>
          Reset
        </button>
      </div>
      <div
        className="chart-canvas"
        ref={containerRef}
        role="img"
        aria-label="BTC price chart. Scroll or pinch to zoom, drag to pan."
      />
    </div>
  )
}
