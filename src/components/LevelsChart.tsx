'use client'

import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  LineSeries,
  LineStyle,
  type IChartApi,
  type Time,
} from 'lightweight-charts'
import type { DailyLevels } from '@/lib/types'

interface Props {
  levels:     DailyLevels
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

export default function LevelsChart({ levels, entryZone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Destroy previous chart before rebuilding
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#161b22' },
        textColor:  '#8b949e',
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      crosshair:       { mode: 1 },
      rightPriceScale: { borderColor: '#30363d', autoScale: true },
      timeScale:       { borderColor: '#30363d', visible: false },
      width:  container.clientWidth,
      height: 360,
    })

    // Invisible anchor series — same color as background so data points are hidden
    // but still provide the price range for auto-scale
    const series = chart.addSeries(LineSeries, {
      color:                  '#161b22',
      lineWidth:              1,
      lastValueVisible:       false,
      priceLineVisible:       false,
      crosshairMarkerVisible: false,
    })

    // Phantom data points span SELL_100 → BUY_100 to anchor the visible price range
    series.setData([
      { time: '2020-01-01' as Time, value: levels.SELL_100 },
      { time: '2020-01-02' as Time, value: levels.BUY_100  },
    ])

    // Build all price lines
    LEVEL_STYLES.forEach(({ key, label, color, style, width }) => {
      const price   = levels[key] as number
      const isEntry = key === entryZone
      series.createPriceLine({
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

    chart.timeScale().fitContent()

    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      chartRef.current?.applyOptions({ width: container.clientWidth })
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [levels, entryZone])

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />
}
