import type { DailyLevels, NdrSummary, ZoneStat, TimeAnalysis, HourStat } from '@/lib/types'

const NDR_TIGHT_MAX = 30
const NDR_WIDE_MIN  = 60
const GAP_SMALL_PCT = 0.06   // |gap| / prev_range < 6% → continuation day

type NdrCat     = 'TIGHT' | 'MID' | 'WIDE'
type PrevPattern = 'HtC' | 'LtC' | 'NEUTRAL'
type TradeMode  = 'CONTINUATION' | 'REVERSAL'
type Direction  = 'LONG' | 'SHORT'

function getNdrCat(ndr: number): NdrCat {
  if (ndr < NDR_TIGHT_MAX) return 'TIGHT'
  if (ndr >= NDR_WIDE_MIN) return 'WIDE'
  return 'MID'
}

function getTradeMode(gap: number, prevRange: number): TradeMode {
  if (prevRange === 0) return 'REVERSAL'
  return Math.abs(gap) / prevRange < GAP_SMALL_PCT ? 'CONTINUATION' : 'REVERSAL'
}

function selectReversalSubset(
  summary: NdrSummary,
  bucket: NdrCat,
  gap: string,
  pattern: PrevPattern,
): { key: string; stats: ZoneStat[] } {
  const candidates: string[] = []
  if (pattern !== 'NEUTRAL') {
    if (gap !== 'FLAT') candidates.push(`NDR_${bucket}_${pattern}_GAP_${gap}`)
    candidates.push(`NDR_${bucket}_${pattern}`)
  }
  candidates.push(gap === 'FLAT' ? `NDR_${bucket}_GAP_FLAT` : `NDR_${bucket}_GAP_${gap}`)
  candidates.push(`NDR_${bucket}`)
  candidates.push('ALL')
  for (const key of candidates) {
    const stats = summary.stats[key]
    if (stats && stats.length > 0) return { key, stats }
  }
  return { key: 'ALL', stats: summary.stats['ALL'] ?? [] }
}

function selectContinuationSubset(
  summary: NdrSummary,
  bucket: NdrCat,
  pattern: 'LtC' | 'HtC',
): { key: string; stats: ZoneStat[] } {
  const candidates = [
    `NDR_${bucket}_${pattern}_SMALL_GAP`,
    `${pattern}_SMALL_GAP`,
    `NDR_${bucket}_${pattern}`,
    `NDR_${bucket}`,
    'ALL',
  ]
  for (const key of candidates) {
    const stats = summary.stats[key]
    if (stats && stats.length > 0) return { key, stats }
  }
  return { key: 'ALL', stats: summary.stats['ALL'] ?? [] }
}

function getConviction(bucket: NdrCat, gap: string, pattern: PrevPattern, mode: TradeMode): number {
  let score = 0
  if (bucket === 'WIDE') score++
  if (mode === 'REVERSAL') {
    if (gap !== 'FLAT') score++
    if ((pattern === 'HtC' && gap === 'DOWN') || (pattern === 'LtC' && gap === 'UP')) score++
  } else {
    // Continuation: small gap is confirmed by the mode itself, pattern clarity matters
    if (pattern !== 'NEUTRAL') score++
    score++  // continuation mode itself is already a filter
  }
  return Math.min(score, 3)
}

interface Plan {
  tradeMode: TradeMode
  direction: Direction
  entryZone: 'SELL_25' | 'BUY_25'
  entry: number
  stop: number
  t1: number
  t2: number
  t1Label: string
  t2Label: string
  stopLabel: string
  rr1: number
  rr2: number
  setupLabel: string
  setupColor: string
  touch_pct: number
  reversal_pct: number
  avg_reversal_pts: number
  ev_pts: number
  continuationPct: number | null
  sameContinuationPct: number | null
  subsetKey: string
  conviction: number
  bestHour: HourStat | null
  secondHour: HourStat | null
  hours: HourStat[]
  noEdge: boolean
}

function derivePlan(
  levels: DailyLevels,
  timeData: TimeAnalysis | null,
  summary: NdrSummary | null,
  prevPattern: PrevPattern,
): Plan {
  const cat       = getNdrCat(levels.NDR_total)
  const gap       = levels.gap_direction
  const tradeMode = getTradeMode(levels.gap, levels.prev_range)

  let direction: Direction
  let entryZone: 'SELL_25' | 'BUY_25'
  let stop: number
  let stopLabel: string
  let t1: number, t2: number
  let t1Label: string, t2Label: string
  let setupLabel: string, setupColor: string
  let subsetKey: string
  let stats: ZoneStat[]

  if (tradeMode === 'CONTINUATION') {
    // Small gap: yesterday's pattern continues — LtC = UP continuation, HtC = DOWN continuation
    const effPattern = prevPattern === 'NEUTRAL' ? 'LtC' : prevPattern  // NEUTRAL defaults to LtC (SELL side historically)
    if (effPattern === 'LtC') {
      direction  = 'LONG'
      entryZone  = 'SELL_25'   // LONG breakout above anchor area
      stop       = levels.anchor
      stopLabel  = 'Anchor'
      t1         = levels.SELL_50
      t2         = levels.SELL_100
      t1Label    = 'SELL_50'
      t2Label    = 'SELL_100'
      setupColor = '#44ff88'
      setupLabel = `Continuación LONG — ${cat} NDR + LtC + Gap mínimo`
    } else {
      direction  = 'SHORT'
      entryZone  = 'BUY_25'    // SHORT breakdown below anchor area
      stop       = levels.anchor
      stopLabel  = 'Anchor'
      t1         = levels.BUY_50
      t2         = levels.BUY_100
      t1Label    = 'BUY_50'
      t2Label    = 'BUY_100'
      setupColor = '#ff6b6b'
      setupLabel = `Continuación SHORT — ${cat} NDR + HtC + Gap mínimo`
    }
    const result = summary
      ? selectContinuationSubset(summary, cat, effPattern)
      : { key: 'ALL', stats: [] }
    subsetKey = result.key
    stats     = result.stats
  } else {
    // REVERSAL mode: counter-gap
    if (gap === 'UP') {
      direction  = 'LONG'
      entryZone  = 'BUY_25'
      stop       = levels.BUY_50
      stopLabel  = 'BUY_50'
      t1         = levels.anchor
      t2         = levels.SELL_100
      t1Label    = 'Anchor'
      t2Label    = 'SELL_100'
      setupColor = '#44ff88'
    } else {
      direction  = 'SHORT'
      entryZone  = 'SELL_25'
      stop       = levels.SELL_50
      stopLabel  = 'SELL_50'
      t1         = levels.anchor
      t2         = levels.BUY_100
      t1Label    = 'Anchor'
      t2Label    = 'BUY_100'
      setupColor = '#ff6b6b'
    }
    const patternLabel = prevPattern !== 'NEUTRAL' ? ` + ${prevPattern}` : ''
    const gapLabel     = gap === 'FLAT' ? 'Gap flat' : `Gap ${gap}`
    setupLabel = `Reversión ${direction} — ${cat} NDR + ${gapLabel}${patternLabel}`
    const result = summary
      ? selectReversalSubset(summary, cat, gap, prevPattern)
      : { key: 'ALL', stats: [] }
    subsetKey = result.key
    stats     = result.stats
  }

  const byZone    = Object.fromEntries(stats.map((s) => [s.zone, s]))
  const entryStat: ZoneStat | undefined = byZone[entryZone]
  const entry     = levels[entryZone]
  const risk      = Math.abs(entry - stop)
  const rr1       = risk > 0 ? Math.abs(t1 - entry) / risk : 0
  const rr2       = risk > 0 ? Math.abs(t2 - entry) / risk : 0
  const conviction = getConviction(cat, gap, prevPattern, tradeMode)

  const timeKey   = `${entryZone}_${gap}_${cat}`
  const hours: HourStat[] = timeData?.[timeKey] ?? []
  const tradeable = hours.filter((h) => h.hour !== 15 && h.count >= 3)
  const sorted    = [...tradeable].sort((a, b) => b.rev10_pct - a.rev10_pct)

  return {
    tradeMode, direction, entryZone, entry, stop, stopLabel,
    t1, t2, t1Label, t2Label, rr1, rr2,
    setupLabel, setupColor,
    touch_pct:          entryStat?.touch_pct         ?? 0,
    reversal_pct:       entryStat?.reversal_pct      ?? 0,
    avg_reversal_pts:   entryStat?.avg_reversal_pts  ?? 0,
    ev_pts:             entryStat?.ev_pts            ?? 0,
    continuationPct:    entryStat?.continuation_pct  ?? null,
    sameContinuationPct: entryStat?.same_cont_pct    ?? null,
    subsetKey, conviction,
    bestHour:   sorted[0] ?? null,
    secondHour: sorted[1] ?? null,
    hours: tradeable,
    noEdge: cat === 'TIGHT',
  }
}

function RRVisualBar({
  direction, stop, entry, t1,
}: { direction: Direction; stop: number; entry: number; t1: number }) {
  const riskDist   = Math.abs(entry - stop)
  const rewardDist = Math.abs(t1 - entry)
  const total      = riskDist + rewardDist
  const riskPct    = total > 0 ? (riskDist   / total) * 100 : 33
  const rewardPct  = total > 0 ? (rewardDist / total) * 100 : 67

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-[#30363d] space-y-2 mt-2.5">
      <div className="flex justify-between text-[9px] uppercase tracking-wider font-extrabold text-[#8b949e]">
        <span>Visual R:R (T1)</span>
        <span className={direction === 'SHORT' ? 'text-[#ff6b6b]' : 'text-[#44ff88]'}>
          {direction === 'SHORT' ? 'Short Setup' : 'Long Setup'}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#21262d] flex overflow-hidden border border-[#30363d]/30">
        <div className="h-full bg-gradient-to-r from-[#ff4444]/90 to-[#ff6b6b]/95 transition-all duration-300"
             style={{ width: `${riskPct}%` }} />
        <div className="h-full bg-gradient-to-r from-[#44ff88]/95 to-[#00cc66]/90 transition-all duration-300"
             style={{ width: `${rewardPct}%` }} />
      </div>
      <div className="flex justify-between text-[9px] font-mono text-[#8b949e] pt-1">
        <div className="flex flex-col">
          <span className="text-[8px] uppercase text-[#ff6b6b]">Stop</span>
          <span className="font-bold text-[#ff6b6b]">{stop.toFixed(2)}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[8px] uppercase text-[#ffd700]">Entry</span>
          <span className="font-bold text-[#ffd700]">{entry.toFixed(2)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[8px] uppercase text-[#44ff88]">T1</span>
          <span className="font-bold text-[#44ff88]">{t1.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

function HourBar({ stat, best }: { stat: HourStat; best: boolean }) {
  const pct  = stat.rev10_pct
  const fill = pct >= 80 ? '#44ff88' : pct >= 60 ? '#ffd700' : '#ff6b6b'
  return (
    <div className={`flex items-center gap-2 py-1 transition-opacity duration-200 ${best ? 'opacity-100' : 'opacity-60 hover:opacity-90'}`}>
      <span className="text-[10px] font-mono text-[#8b949e] w-12 flex-shrink-0">{stat.hour_label}</span>
      <div className="flex-1 bg-[#21262d] rounded-full h-1.5 overflow-hidden border border-[#30363d]/20">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: fill }} />
      </div>
      <span className="text-[10px] font-mono w-9 text-right flex-shrink-0 font-bold" style={{ color: fill }}>
        {pct.toFixed(0)}%
      </span>
      <span className="text-[10px] font-mono text-[#8b949e] w-12 text-right flex-shrink-0">
        {stat.avg_rev.toFixed(1)}pt
      </span>
      {best && <span className="text-[10px] text-[#ffd700] animate-pulse">★</span>}
    </div>
  )
}

interface Props {
  levels:      DailyLevels
  timeData:    TimeAnalysis | null
  summary:     NdrSummary | null
  prevPattern: PrevPattern
}

export default function PlanPanel({ levels, timeData, summary, prevPattern }: Props) {
  const plan = derivePlan(levels, timeData, summary, prevPattern)
  const cat  = getNdrCat(levels.NDR_total)

  const catConfig = {
    TIGHT: 'text-[#ff6b6b] bg-[#ff6b6b]/10 border-[#ff6b6b]/30',
    MID:   'text-[#ffaa44] bg-[#ffaa44]/10 border-[#ffaa44]/30',
    WIDE:  'text-[#44ff88] bg-[#44ff88]/10 border-[#44ff88]/30',
  }[cat]

  const convictionLabel = (['LOW', 'LOW', 'MEDIUM', 'HIGH'] as const)[plan.conviction] ?? 'LOW'
  const convictionColor = ['#8b949e', '#8b949e', '#ffd700', '#44ff88'][plan.conviction] ?? '#8b949e'
  const modeColor = plan.tradeMode === 'CONTINUATION' ? '#bc8cff' : '#58a6ff'
  const modeLabel = plan.tradeMode === 'CONTINUATION' ? '↗ CONT' : '↩ REV'

  const t1Pts   = Math.abs(plan.t1   - plan.entry).toFixed(1)
  const t2Pts   = Math.abs(plan.t2   - plan.entry).toFixed(1)
  const stopPts = Math.abs(plan.stop - plan.entry).toFixed(1)

  // For T2, show same-side % for continuation mode, cross-side % for reversal mode
  const t2Pct = plan.tradeMode === 'CONTINUATION'
    ? plan.sameContinuationPct
    : plan.continuationPct

  return (
    <div
      className="rounded-lg border p-4 space-y-3.5 shadow-xl shadow-black/20 transition-all duration-300"
      style={{ background: '#161b22', borderColor: plan.setupColor + '44' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#30363d]/60 pb-2">
        <h3 className="text-xs uppercase tracking-widest font-extrabold text-[#e6edf3]">Plan del Día</h3>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <span
            className="text-[9px] font-extrabold px-2 py-0.5 rounded-full border"
            style={{ color: modeColor, borderColor: modeColor + '44', background: modeColor + '11' }}
          >
            {modeLabel}
          </span>
          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${catConfig}`}>
            {cat} ({levels.NDR_total.toFixed(1)} pts)
          </span>
          <span
            className="text-[9px] font-extrabold px-2 py-0.5 rounded-full border"
            style={{ color: convictionColor, borderColor: convictionColor + '44', background: convictionColor + '11' }}
          >
            {convictionLabel}
          </span>
        </div>
      </div>

      {/* Setup label */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-3.5 rounded-sm" style={{ backgroundColor: plan.setupColor }} />
        <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: plan.setupColor }}>
          {plan.setupLabel}
        </div>
      </div>

      {/* Subset + stats */}
      <div className="text-[9px] text-[#8b949e] font-mono bg-[#0d1117] px-2 py-1 rounded border border-[#30363d]/40">
        Datos: <span className="text-[#58a6ff]">{plan.subsetKey}</span>
        {' · '}touch <span className="text-[#e6edf3]">{plan.touch_pct.toFixed(0)}%</span>
        {' · '}rev <span className="text-[#e6edf3]">{plan.reversal_pct.toFixed(0)}%</span>
        {' · '}EV <span className="text-[#ffd700] font-bold">{plan.ev_pts.toFixed(1)} pts/día</span>
      </div>

      {/* Gap pct info for continuation mode */}
      {plan.tradeMode === 'CONTINUATION' && (
        <div className="text-[9px] text-[#bc8cff] bg-[#bc8cff]/5 border border-[#bc8cff]/20 px-2 py-1 rounded font-mono">
          Gap {Math.abs(levels.gap).toFixed(2)} pts ({(Math.abs(levels.gap) / levels.prev_range * 100).toFixed(1)}% del rango) — modo continuación activo
        </div>
      )}

      {/* Plan */}
      {plan.noEdge ? (
        <div className="rounded-lg p-3 border border-[#ff6b6b]/30 bg-[#ff6b6b]/5">
          <div className="text-xs text-[#ff6b6b] font-medium leading-relaxed">
            ⚠️ NDR &lt; 30 pts — Edge histórico muy bajo (~15%). Reducir tamaño o no operar hoy.
          </div>
        </div>
      ) : (
        <>
          {/* Entry + Stop */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#0d1117] rounded-lg p-2 border border-[#30363d]/80">
              <div className="text-[9px] uppercase font-bold tracking-wider text-[#8b949e] mb-1">Entrada</div>
              <div className="font-mono font-extrabold text-sm" style={{ color: plan.setupColor }}>
                {plan.entry.toFixed(2)}
              </div>
              <div className="text-[9px] text-[#8b949e] font-semibold mt-0.5">
                {plan.entryZone} · {plan.direction}
              </div>
            </div>

            <div className="bg-[#0d1117] rounded-lg p-2 border border-[#30363d]/80">
              <div className="text-[9px] uppercase font-bold tracking-wider text-[#8b949e] mb-1">Stop</div>
              <div className="font-mono font-extrabold text-sm text-[#ff6b6b]">
                {plan.stop.toFixed(2)}
              </div>
              <div className="text-[9px] text-[#8b949e] font-semibold mt-0.5">
                {plan.stopLabel} (−{stopPts} pts)
              </div>
            </div>
          </div>

          {/* Dual targets */}
          <div className="space-y-1.5">
            <div className="text-[9px] uppercase font-bold tracking-wider text-[#8b949e]">Targets — Salida Parcial</div>

            <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#44ff88]/20 flex items-center justify-between">
              <div>
                <div className="text-[9px] text-[#8b949e] uppercase font-bold">T1 — 50% de la posición</div>
                <div className="font-mono font-extrabold text-sm text-[#44ff88]">{plan.t1.toFixed(2)}</div>
                <div className="text-[9px] text-[#8b949e] mt-0.5">{plan.t1Label} · R:R 1:{plan.rr1.toFixed(1)}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-[#8b949e]">Potencial</div>
                <div className="font-mono font-bold text-[#44ff88]">+{t1Pts} pts</div>
                <div className="text-[9px] text-[#8b949e]">rev {plan.reversal_pct.toFixed(0)}%</div>
              </div>
            </div>

            <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#58a6ff]/20 flex items-center justify-between">
              <div>
                <div className="text-[9px] text-[#8b949e] uppercase font-bold">T2 — 50% restante</div>
                <div className="font-mono font-extrabold text-sm text-[#58a6ff]">{plan.t2.toFixed(2)}</div>
                <div className="text-[9px] text-[#8b949e] mt-0.5">{plan.t2Label} · R:R 1:{plan.rr2.toFixed(1)}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-[#8b949e]">Potencial</div>
                <div className="font-mono font-bold text-[#58a6ff]">+{t2Pts} pts</div>
                {t2Pct !== null && (
                  <div className="text-[9px] text-[#8b949e]">cont {t2Pct.toFixed(0)}%</div>
                )}
              </div>
            </div>

            <div className="rounded p-2 bg-[#ffd700]/5 border border-[#ffd700]/15 text-[9px] text-[#ffd700] leading-relaxed">
              Regla: Al llegar T1 → cerrar 50%, mover stop a breakeven, dejar correr a T2
            </div>
          </div>

          <RRVisualBar direction={plan.direction} stop={plan.stop} entry={plan.entry} t1={plan.t1} />
        </>
      )}

      {/* Time window */}
      {plan.hours.length > 0 && !plan.noEdge && (
        <div className="border-t border-[#30363d]/60 pt-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[9px] uppercase font-extrabold tracking-wider text-[#8b949e]">
              Filtro Horario (Rev≥10% / pts)
            </div>
            {plan.bestHour && (
              <div className="text-[10px] font-bold text-[#ffd700] bg-[#ffd700]/10 px-2 py-0.5 rounded border border-[#ffd700]/20">
                Top: {plan.bestHour.hour_label}
              </div>
            )}
          </div>
          <div className="space-y-0.5 bg-[#0d1117] p-2.5 rounded-lg border border-[#30363d]/60">
            {plan.hours.map((h) => (
              <HourBar key={h.hour} stat={h} best={plan.bestHour?.hour === h.hour} />
            ))}
          </div>
          {plan.bestHour && (
            <div className="rounded-lg p-2.5 bg-[#ffd700]/5 border border-[#ffd700]/20 text-[10px] text-[#ffd700] leading-normal">
              🚀 <span className="font-bold">Ventana Óptima:</span> {plan.bestHour.hour_label}–{(plan.bestHour.hour + 1).toString().padStart(2, '0')}:00 EST · <span className="font-extrabold">{plan.bestHour.rev10_pct.toFixed(0)}%</span> rev≥10 · avg <span className="font-bold">{plan.bestHour.avg_rev.toFixed(1)} pts</span> (n={plan.bestHour.count})
            </div>
          )}
        </div>
      )}

      {plan.hours.length === 0 && !plan.noEdge && (
        <div className="text-[10px] text-[#8b949e] italic text-center py-2">
          Sin registros horarios para esta combinación.
        </div>
      )}
    </div>
  )
}
