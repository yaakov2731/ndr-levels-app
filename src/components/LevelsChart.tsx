'use client'

import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type Time,
} from 'lightweight-charts'
import type { DailyLevels } from '@/lib/types'

interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
}

interface Props {
  levels: DailyLevels
  candles: Candle[]
}

const LEVEL_STYLES = [
  { key: 'SELL_100' as keyof DailyLevels, label: 'SELL 100%', color: '#ff4444', style: LineStyle.Solid,  width: 2 },
  { key: 'SELL_50'  as keyof DailyLevels, label: 'SELL  50%', color: '#ff8888', style: LineStyle.Dashed, width: 1 },
  { key: 'SELL_25'  as keyof DailyLevels, label: 'SELL  25%', color: '#ffbbbb', style: LineStyle.Dotted, width: 1 },
  { key: 'anchor'   as keyof DailyLevels, label: 'ANCHOR',    color: '#ffd700', style: LineStyle.Solid,  width: 2 },
  { key: 'BUY_25'   as keyof DailyLevels, label: 'BUY   25%', color: '#bbffbb', style: LineStyle.Dotted, width: 1 },
  { key: 'BUY_50'   as keyof DailyLevels, label: 'BUY   50%', color: '#88ff88', style: LineStyle.Dashed, width: 1 },
  { key: 'BUY_100'  as keyof DailyLevels, label: 'BUY  100%', color: '#44ff44', style: LineStyle.Solid,  width: 2 },
]

function buildPriceLines(
  series: ISeriesApi<'Candlestick'>,
  levels: DailyLevels,
): IPriceLine[] {
  return LEVEL_STYLES.map(({ key, label, color, style, width }) => {
    const price = levels[key] as number
    return series.createPriceLine({
      price,
      color,
      lineWidth:        width as 1 | 2 | 3 | 4,
      lineStyle:        style,
      axisLabelVisible: true,
      title:            `${label}: ${price.toFixed(2)}`,
    })
  })
}

export default function LevelsChart({ levels, candles }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const chartRef      = useRef<IChartApi | null>(null)
  const seriesRef     = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])
  // always-current snapshot of levels so the candle effect can read latest values
  const levelsRef     = useRef(levels)
  levelsRef.current   = levels

  // Rebuild chart when candles change (new session data)
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#161b22' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#30363d' },
      timeScale: { borderColor: '#30363d', timeVisible: true },
      width:  containerRef.current.clientWidth,
      height: 480,
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor:         '#26a269',
      downColor:       '#e0342e',
      borderUpColor:   '#26a269',
      borderDownColor: '#e0342e',
      wickUpColor:     '#26a269',
      wickDownColor:   '#e0342e',
    })

    series.setData(candles.map((c) => ({ ...c, time: c.time as Time })))

    // Add price lines immediately using current levels
    priceLinesRef.current = buildPriceLines(series, levelsRef.current)

    chartRef.current  = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove() }
  }, [candles])

  // Update price lines when levels change (no chart rebuild needed)
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    // Remove ALL existing price lines before adding new ones
    priceLinesRef.current.forEach((pl) => series.removePriceLine(pl))
    priceLinesRef.current = buildPriceLines(series, levels)
  }, [levels])

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />
}
