import type { DailyLevels, TimeAnalysis, HourStat } from '@/lib/types'

const NDR_TIGHT_MAX = 30
const NDR_WIDE_MIN  = 60

type NdrCat = 'TIGHT' | 'MID' | 'WIDE'

function getNdrCat(ndr: number): NdrCat {
  if (ndr < NDR_TIGHT_MAX) return 'TIGHT'
  if (ndr >= NDR_WIDE_MIN) return 'WIDE'
  return 'MID'
}

interface Plan {
  side: 'SELL' | 'BUY' | null
  zone: 'SELL_25' | 'BUY_25' | null
  entry: number
  target: number
  stop: number
  rr: number
  setupLabel: string
  setupColor: string
  rev10: number
  avgRev: number
  bestHour: HourStat | null
  secondHour: HourStat | null
  hours: HourStat[]
  noEdge: boolean
}

function derivePlan(levels: DailyLevels, timeData: TimeAnalysis | null): Plan {
  const cat  = getNdrCat(levels.NDR_total)
  const gap  = levels.gap_direction

  // Determine best setup
  // Counter-gap SELL (gap DOWN) = historically best
  // Counter-gap BUY  (gap UP)   = second best
  // With-gap sides: lower priority
  let side: 'SELL' | 'BUY'
  let zone: 'SELL_25' | 'BUY_25'
  let setupLabel: string
  let setupColor: string
  let rev10: number
  let avgRev: number

  if (gap === 'DOWN') {
    side = 'SELL'; zone = 'SELL_25'
    if (cat === 'WIDE') {
      setupLabel = 'Counter-gap SELL — WIDE NDR + Gap DOWN'
      setupColor = '#ff6b6b'
      rev10 = 82; avgRev = 33.1
    } else if (cat === 'MID') {
      setupLabel = 'Counter-gap SELL — MID NDR + Gap DOWN'
      setupColor = '#ffaa44'
      rev10 = 60; avgRev = 16
    } else {
      setupLabel = 'Counter-gap SELL — TIGHT (low edge)'
      setupColor = '#888'
      rev10 = 30; avgRev = 8
    }
  } else if (gap === 'UP') {
    side = 'BUY'; zone = 'BUY_25'
    if (cat === 'WIDE') {
      setupLabel = 'Counter-gap BUY — WIDE NDR + Gap UP'
      setupColor = '#44ff88'
      rev10 = 84; avgRev = 23.4
    } else if (cat === 'MID') {
      setupLabel = 'Counter-gap BUY — MID NDR + Gap UP'
      setupColor = '#88ffaa'
      rev10 = 58; avgRev = 14
    } else {
      setupLabel = 'Counter-gap BUY — TIGHT (low edge)'
      setupColor = '#888'
      rev10 = 28; avgRev = 7
    }
  } else {
    // FLAT gap — SELL side has slight historical edge
    side = 'SELL'; zone = 'SELL_25'
    setupLabel = 'SELL_25 — Flat gap'
    setupColor = cat === 'WIDE' ? '#ff8888' : '#888'
    rev10 = cat === 'WIDE' ? 70 : 40; avgRev = cat === 'WIDE' ? 20 : 10
  }

  const entry  = levels[zone]
  const target = levels.anchor
  const stop   = side === 'SELL' ? levels.SELL_50 : levels.BUY_50
  const rr     = stop !== entry ? Math.abs(target - entry) / Math.abs(stop - entry) : 0

  // Time data
  const timeKey = `${zone}_${gap}_${cat}`
  const hours: HourStat[] = timeData?.[timeKey] ?? []
  // Filter 15:00 (0% reversal) and require count >= 3
  const tradeable = hours.filter((h) => h.hour !== 15 && h.count >= 3)
  const sorted    = [...tradeable].sort((a, b) => b.rev10_pct - a.rev10_pct)
  const bestHour   = sorted[0] ?? null
  const secondHour = sorted[1] ?? null

  return {
    side, zone, entry, target, stop, rr,
    setupLabel, setupColor,
    rev10, avgRev,
    bestHour, secondHour, hours: tradeable,
    noEdge: cat === 'TIGHT',
  }
}

function HourBar({ stat, best }: { stat: HourStat; best: boolean }) {
  const pct  = stat.rev10_pct
  const fill = pct >= 80 ? '#44ff88' : pct >= 60 ? '#ffd700' : '#ff8888'
  return (
    <div className={`flex items-center gap-2 py-1 ${best ? 'opacity-100' : 'opacity-70'}`}>
      <span className="text-[10px] font-mono text-[#8b949e] w-12 flex-shrink-0">{stat.hour_label}</span>
      <div className="flex-1 bg-[#21262d] rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
      </div>
      <span className="text-[10px] font-mono w-9 text-right flex-shrink-0" style={{ color: fill }}>
        {pct.toFixed(0)}%
      </span>
      <span className="text-[10px] font-mono text-[#8b949e] w-12 text-right flex-shrink-0">
        {stat.avg_rev.toFixed(1)}pt
      </span>
      {best && <span className="text-[10px] text-[#ffd700]">★</span>}
    </div>
  )
}

interface Props {
  levels: DailyLevels
  timeData: TimeAnalysis | null
}

export default function PlanPanel({ levels, timeData }: Props) {
  const plan = derivePlan(levels, timeData)
  const cat  = getNdrCat(levels.NDR_total)

  return (
    <div
      className="rounded-lg border border-[#30363d] p-4 space-y-3"
      style={{ background: '#0d1117', borderColor: plan.setupColor + '55' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest font-bold text-[#e6edf3]">Plan del Día</h3>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded"
          style={{ color: plan.setupColor, background: plan.setupColor + '22', border: `1px solid ${plan.setupColor}44` }}
        >
          {cat} NDR
        </span>
      </div>

      {/* Setup label */}
      <div className="text-[11px] font-semibold" style={{ color: plan.setupColor }}>
        {plan.setupLabel}
      </div>

      {/* Levels grid */}
      {plan.noEdge ? (
        <div className="rounded p-3 border border-[#ff6b6b44] bg-[#ff6b6b0a]">
          <div className="text-xs text-[#ff6b6b]">
            NDR &lt; 30 pts — edge muy bajo (~15%). Considerar no operar hoy.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#161b22] rounded p-2 border border-[#30363d]">
            <div className="text-[9px] uppercase tracking-wider text-[#8b949e] mb-1">Entrada</div>
            <div className="font-mono font-bold text-sm" style={{ color: plan.setupColor }}>
              {plan.entry.toFixed(2)}
            </div>
            <div className="text-[9px] text-[#8b949e] mt-0.5">{plan.zone}</div>
          </div>
          <div className="bg-[#161b22] rounded p-2 border border-[#30363d]">
            <div className="text-[9px] uppercase tracking-wider text-[#8b949e] mb-1">Target</div>
            <div className="font-mono font-bold text-sm text-[#e6edf3]">
              {plan.target.toFixed(2)}
            </div>
            <div className="text-[9px] text-[#8b949e] mt-0.5">Anchor</div>
          </div>
          <div className="bg-[#161b22] rounded p-2 border border-[#30363d]">
            <div className="text-[9px] uppercase tracking-wider text-[#8b949e] mb-1">Stop</div>
            <div className="font-mono font-bold text-sm text-[#ff6b6b]">
              {plan.stop.toFixed(2)}
            </div>
            <div className="text-[9px] text-[#8b949e] mt-0.5">{plan.zone === 'SELL_25' ? 'SELL_50' : 'BUY_50'}</div>
          </div>
          <div className="bg-[#161b22] rounded p-2 border border-[#30363d]">
            <div className="text-[9px] uppercase tracking-wider text-[#8b949e] mb-1">R:R</div>
            <div className="font-mono font-bold text-sm text-[#e6edf3]">
              1 : {plan.rr.toFixed(2)}
            </div>
            <div className="text-[9px] text-[#8b949e] mt-0.5">
              Rev≥10: <span style={{ color: plan.setupColor }}>{plan.rev10}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Best time window */}
      {plan.hours.length > 0 && !plan.noEdge && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-[#8b949e]">
              Horario (Rev≥10% / avg pts)
            </div>
            {plan.bestHour && (
              <div className="text-[10px] font-semibold text-[#ffd700]">
                Mejor: {plan.bestHour.hour_label}
              </div>
            )}
          </div>
          <div className="space-y-0.5">
            {plan.hours.map((h) => (
              <HourBar
                key={h.hour}
                stat={h}
                best={plan.bestHour?.hour === h.hour}
              />
            ))}
          </div>
          {plan.bestHour && (
            <div className="mt-2 rounded p-2 bg-[#ffd70011] border border-[#ffd70044] text-[10px] text-[#ffd700]">
              Ventana optima: <span className="font-bold">{plan.bestHour.hour_label}–{(plan.bestHour.hour + 1).toString().padStart(2, '0')}:00 EST</span>
              {' '}— {plan.bestHour.rev10_pct.toFixed(0)}% Rev≥10, avg {plan.bestHour.avg_rev.toFixed(1)} pts (n={plan.bestHour.count})
            </div>
          )}
        </div>
      )}

      {plan.hours.length === 0 && !plan.noEdge && (
        <div className="text-[10px] text-[#8b949e]">Sin datos de horario para este setup.</div>
      )}
    </div>
  )
}
