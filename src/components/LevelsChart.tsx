'use client'

import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type Time,
} from 'lightweight-charts'
import type { DailyLevels } from '@/lib/types'

interface Props {
  levels:    DailyLevels
  entryZone?: 'SELL_25' | 'BUY_25'
}

const LEVEL_STYLES: Array<{
  key:   keyof DailyLevels
  label: string
  color: string
  style: LineStyle
  width: 1 | 2 | 3 | 4
}> = [
  { key: 'SELL_100', label: 'SELL 100%', color: '#ff4444', style: LineStyle.Solid,  width: 2 },
  { key: 'SELL_50',  label: 'SELL  50%', color: '#ff8888', style: LineStyle.Dashed, width: 1 },
  { key: 'SELL_25',  label: 'SELL  25%', color: '#ffbbbb', style: LineStyle.Dotted, width: 1 },
  { key: 'anchor',   label: 'ANCHOR',    color: '#ffd700', style: LineStyle.Solid,  width: 2 },
  { key: 'BUY_25',   label: 'BUY   25%', color: '#bbffbb', style: LineStyle.Dotted, width: 1 },
  { key: 'BUY_50',   label: 'BUY   50%', color: '#88ff88', style: LineStyle.Dashed, width: 1 },
  { key: 'BUY_100',  label: 'BUY  100%', color: '#44ff44', style: LineStyle.Solid,  width: 2 },
]

function buildPriceLines(
  series:    ISeriesApi<'Line'>,
  levels:    DailyLevels,
  entryZone?: 'SELL_25' | 'BUY_25',
): IPriceLine[] {
  return LEVEL_STYLES.map(({ key, label, color, style, width }) => {
    const price   = levels[key] as number
    const isEntry = key === entryZone
    return series.createPriceLine({
      price,
      color:            isEntry ? '#ffffff' : color,
      lineWidth:        (isEntry ? 2 : width) as 1 | 2 | 3 | 4,
      lineStyle:        isEntry ? LineStyle.Dotted : style,
      axisLabelVisible: true,
      title:            isEntry
        ? `>>> ENTRADA  ${price.toFixed(2)}`
        : `${label}: ${price.toFixed(2)}`,
    })
  })
}

export default function LevelsChart({ levels, entryZone }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const chartRef      = useRef<IChartApi | null>(null)
  const seriesRef     = useRef<ISeriesApi<'Line'> | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const levelsRef     = useRef(levels)
  levelsRef.current   = levels
  const entryRef      = useRef(entryZone)
  entryRef.current    = entryZone

  // Create chart once
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
      timeScale:       { borderColor: '#30363d', visible: false },
      width:  containerRef.current.clientWidth,
      height: 360,
    })

    // Invisible series — only purpose is to host price lines and anchor scale
    const series = chart.addSeries(LineSeries, {
      color:                  'transparent',
      lineWidth:              1,
      lastValueVisible:       false,
      priceLineVisible:       false,
      crosshairMarkerVisible: false,
    })

    // Two phantom points so the price scale auto-fits to the levels range
    const d1 = '2000-01-01'
    const d2 = '2000-01-02'
    const lvl = levelsRef.current
    series.setData([
      { time: d1 as Time, value: lvl.SELL_100 },
      { time: d2 as Time, value: lvl.BUY_100 },
    ])

    priceLinesRef.current = buildPriceLines(series, levelsRef.current, entryRef.current)

    chartRef.current  = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update price lines + phantom range when levels / entryZone change
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    // Update phantom points to new range
    const d1 = '2000-01-01'
    const d2 = '2000-01-02'
    series.setData([
      { time: d1 as Time, value: levels.SELL_100 },
      { time: d2 as Time, value: levels.BUY_100  },
    ])

    priceLinesRef.current.forEach((pl) => series.removePriceLine(pl))
    priceLinesRef.current = buildPriceLines(series, levels, entryZone)
  }, [levels, entryZone])

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />
}
