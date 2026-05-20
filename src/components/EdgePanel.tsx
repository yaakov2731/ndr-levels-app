import type { DailyLevels, ZoneStat, NdrSummary } from '@/lib/types'

// NDR thresholds from 10yr backtest (Q33≈30, Q67≈60)
const NDR_TIGHT_MAX = 30
const NDR_WIDE_MIN  = 60

type NdrCategory = 'TIGHT' | 'MID' | 'WIDE'

const NDR_CONFIG: Record<NdrCategory, { label: string; color: string; bg: string; desc: string }> = {
  TIGHT: { label: 'TIGHT NDR', color: '#ff6b6b', bg: 'rgba(255,107,107,0.08)', desc: 'Low edge — skip or reduce size' },
  MID:   { label: 'MID NDR',   color: '#ffd700', bg: 'rgba(255,215,0,0.08)',   desc: 'Moderate edge — standard setup' },
  WIDE:  { label: 'WIDE NDR',  color: '#44ff88', bg: 'rgba(68,255,136,0.08)',  desc: 'High edge — best reversal prob' },
}

function getNdrCategory(ndr: number): NdrCategory {
  if (ndr < NDR_TIGHT_MAX) return 'TIGHT'
  if (ndr >= NDR_WIDE_MIN) return 'WIDE'
  return 'MID'
}

function getSubsetKey(category: NdrCategory, gap: string): string {
  if (gap === 'FLAT') return `NDR_${category}`
  return `NDR_${category}_GAP_${gap}`
}

interface Props {
  levels:  DailyLevels
  summary: NdrSummary | null
}

function StatRow({ label, stat, color }: { label: string; stat: ZoneStat | undefined; color: string }) {
  if (!stat) return null
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#21262d] last:border-0">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-xs text-[#8b949e]">{label}</span>
      </div>
      <div className="flex gap-4 text-xs font-mono">
        <span className="text-[#8b949e]">touch <span className="text-[#e6edf3]">{stat.touch_pct.toFixed(0)}%</span></span>
        <span className="text-[#8b949e]">rev <span style={{ color }} className="font-semibold">{stat.reversal_pct.toFixed(0)}%</span></span>
        <span className="text-[#8b949e]">avg <span className="text-[#e6edf3]">{stat.avg_reversal_pts.toFixed(1)}</span></span>
      </div>
    </div>
  )
}

export default function EdgePanel({ levels, summary }: Props) {
  const category = getNdrCategory(levels.NDR_total)
  const cfg = NDR_CONFIG[category]

  // Stats subset: NDR bucket + gap combo, fallback to NDR bucket only
  const subsetKey  = getSubsetKey(category, levels.gap_direction)
  const fallback   = `NDR_${category}`
  const stats: ZoneStat[] = summary?.stats?.[subsetKey] ?? summary?.stats?.[fallback] ?? []
  const byZone = Object.fromEntries(stats.map((s) => [s.zone, s]))

  // Counter-gap insight: gap UP → counter-gap zone = SELL (price would need to go opposite gap)
  // gap DOWN → counter-gap zone = BUY... wait, reversed:
  // gap UP means price opened higher → SELL_25 is WITH gap; BUY_25 is counter-gap
  // From analysis: SELL side reverses better. Counter-gap SELL (on gap DOWN) = best setup.
  const isGapUp   = levels.gap_direction === 'UP'
  const isGapDown = levels.gap_direction === 'DOWN'
  const counterGapSell = isGapDown  // SELL_25 counter to gap DOWN = best edge (61%)
  const counterGapBuy  = isGapUp    // BUY_25 counter to gap UP

  return (
    <div
      className="rounded-lg border border-[#30363d] p-4"
      style={{ background: cfg.bg, borderColor: cfg.color + '44' }}
    >
      {/* NDR Quality badge */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest text-[#8b949e]">Edge Analysis</h3>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{ color: cfg.color, background: cfg.color + '22', border: `1px solid ${cfg.color}44` }}
        >
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-[#8b949e] mb-3">{cfg.desc}</p>

      {/* Zone stats for today's NDR + gap context */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-widest text-[#8b949e] mb-2">
          Reversal odds — {subsetKey.replace(/_/g, ' ')}
        </div>
        <StatRow label="SELL 25%" stat={byZone['SELL_25']} color="#ffbbbb" />
        <StatRow label="SELL 50%" stat={byZone['SELL_50']} color="#ff8888" />
        <StatRow label="BUY 25%"  stat={byZone['BUY_25']}  color="#bbffbb" />
        <StatRow label="BUY 50%"  stat={byZone['BUY_50']}  color="#88ff88" />
      </div>

      {/* Counter-gap setup highlight */}
      {(counterGapSell || counterGapBuy || levels.gap_direction === 'FLAT') && (
        <div
          className="rounded p-3 border"
          style={{
            borderColor: counterGapSell ? '#ff8888' : '#88ff88',
            background: counterGapSell ? 'rgba(255,136,136,0.06)' : 'rgba(136,255,136,0.06)',
          }}
        >
          <div className="text-[10px] uppercase tracking-widest text-[#8b949e] mb-1">
            Top Setup Today
          </div>
          {counterGapSell && (
            <div>
              <div className="text-xs font-semibold" style={{ color: '#ff8888' }}>
                Counter-gap SELL
              </div>
              <div className="text-xs text-[#8b949e] mt-0.5">
                GAP DOWN + SELL_25 first: historically <span className="text-[#e6edf3] font-semibold">61% Rev≥10pts</span>, avg 18.6 pts
              </div>
              <div className="text-xs text-[#8b949e] mt-0.5 font-mono">
                Watch: {levels.SELL_25.toFixed(2)}
              </div>
            </div>
          )}
          {counterGapBuy && (
            <div>
              <div className="text-xs font-semibold" style={{ color: '#bbffbb' }}>
                Counter-gap BUY
              </div>
              <div className="text-xs text-[#8b949e] mt-0.5">
                GAP UP + BUY_25 first: historically <span className="text-[#e6edf3] font-semibold">51% Rev≥10pts</span>, avg 13.4 pts
              </div>
              <div className="text-xs text-[#8b949e] mt-0.5 font-mono">
                Watch: {levels.BUY_25.toFixed(2)}
              </div>
            </div>
          )}
          {levels.gap_direction === 'FLAT' && (
            <div>
              <div className="text-xs font-semibold" style={{ color: '#ff8888' }}>
                SELL side (flat gap)
              </div>
              <div className="text-xs text-[#8b949e] mt-0.5">
                No gap — SELL_25 first: historically <span className="text-[#e6edf3] font-semibold">57% Rev≥10pts</span>, avg 16.5 pts
              </div>
              <div className="text-xs text-[#8b949e] mt-0.5 font-mono">
                Watch: {levels.SELL_25.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TIGHT warning */}
      {category === 'TIGHT' && (
        <div className="mt-3 rounded p-2 border border-[#ff6b6b44] bg-[#ff6b6b0a]">
          <div className="text-xs text-[#ff6b6b]">
            NDR &lt; 30 pts — Rev≥10 probability drops to ~15%. Consider skipping or waiting for a better day.
          </div>
        </div>
      )}
    </div>
  )
}
