import type { DailyLevels, ZoneStat } from '@/lib/types'

interface Props {
  levels:   DailyLevels
  gapStats: ZoneStat[]
}

export default function GapSignalBox({ levels, gapStats }: Props) {
  if (levels.gap_direction === 'FLAT' || !gapStats.length) return null

  const isUp      = levels.gap_direction === 'UP'
  const firstZone = isUp ? 'SELL_25' : 'BUY_25'
  const stat      = gapStats.find((s) => s.zone === firstZone)
  if (!stat) return null

  const color     = isUp ? '#ff8888' : '#88ff88'
  const label     = isUp ? 'SELL 25%' : 'BUY 25%'
  const price     = isUp ? levels.SELL_25 : levels.BUY_25
  const direction = isUp ? 'GAP UP' : 'GAP DOWN'

  return (
    <div
      className="rounded-lg p-4 border"
      style={{ borderColor: color, borderLeftWidth: 4, background: '#0d1117' }}
    >
      <div className="text-[10px] uppercase tracking-widest text-[#8b949e] mb-1">
        {direction} — First Target
      </div>
      <div className="flex items-baseline gap-3">
        <span style={{ color }} className="text-xl font-bold">{label}</span>
        <span className="text-[#e6edf3] font-mono text-sm">{price.toFixed(2)}</span>
      </div>
      <div className="mt-2 text-sm text-[#8b949e]">
        Touch:{' '}
        <span className="text-[#e6edf3] font-semibold">{stat.touch_pct.toFixed(1)}%</span>
        {' · '}Reversal:{' '}
        <span className="text-[#e6edf3] font-semibold">{stat.reversal_pct.toFixed(1)}%</span>
        {' · '}Avg:{' '}
        <span className="text-[#e6edf3] font-semibold">{stat.avg_reversal_pts.toFixed(1)} pts</span>
      </div>
    </div>
  )
}
