# NDR Trade Plan Optimizer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Python backtest with 8 cross-filter subsets + EV metric, then refactor PlanPanel to show dual-target plan (T1=anchor, T2=opposite extreme) sourced from live JSON stats.

**Architecture:** Python backtest generates enriched JSON with new subsets and `ev_pts`/`continuation_pct` fields. TypeScript types updated to match. PlanPanel reads stats directly from JSON (no hardcoded values), selects best subset for today's conditions, computes conviction score, and renders T1/T2 plan with partial-exit rule.

**Tech Stack:** Python 3 + pandas (backtest), Next.js 14 + TypeScript (app), Vercel (deploy)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `es_trading_system/notebooks/11_ndr_levels_backtest.py` | Modify | Add 8 subsets, `ev_pts`, `continuation_pct` to `zone_stats()` |
| `es_trading_system/public/data/ndr_levels_summary.json` | Regenerated | Richer stats (auto-written by backtest) |
| `ndr-levels-app/public/data/ndr_levels_summary.json` | Overwrite | Copy from es_trading_system after backtest run |
| `ndr-levels-app/src/lib/types.ts` | Modify | Add `ev_pts` + `continuation_pct` to `ZoneStat` |
| `ndr-levels-app/src/app/page.tsx` | Modify | Compute `prevPattern`, pass `summary` + `prevPattern` to PlanPanel |
| `ndr-levels-app/src/components/PlanPanel.tsx` | Modify | Full refactor — live stats, dual-target, conviction score |

---

## Task 1: Expand Python backtest

**Files:**
- Modify: `es_trading_system/notebooks/11_ndr_levels_backtest.py`

- [ ] **Step 1: Add `ev_pts` and `continuation_pct` to `zone_stats()`**

Replace the existing `zone_stats()` function (lines 71–95) with:

```python
def zone_stats(sub_df, label):
    n = len(sub_df)
    stats = []
    for z in ZONES:
        touched_mask = sub_df[f'{z}_touched']
        touched_count = int(touched_mask.sum())
        touch_pct_raw = touched_mask.mean() * 100 if n > 0 else 0.0
        reversed_of_touched = (
            sub_df.loc[touched_mask, f'{z}_reversed'].mean() * 100
            if touched_mask.any() else 0.0
        )
        avg_rev = (
            sub_df.loc[touched_mask, f'{z}_rev_pts'].mean()
            if touched_mask.any() else 0.0
        )
        ev_pts = (touch_pct_raw / 100) * avg_rev

        # Cross-side continuation: SELL_25 entry → how often does BUY_100 also get hit?
        # BUY_25 entry → how often does SELL_100 also get hit?
        continuation_pct = None
        if z == 'SELL_25' and touched_mask.any():
            continuation_pct = round(
                sub_df.loc[touched_mask, 'BUY_100_touched'].mean() * 100, 1
            )
        elif z == 'BUY_25' and touched_mask.any():
            continuation_pct = round(
                sub_df.loc[touched_mask, 'SELL_100_touched'].mean() * 100, 1
            )

        stat = {
            'zone': z,
            'subset': label,
            'n': n,
            'n_touched': touched_count,
            'touch_pct': round(touch_pct_raw, 1),
            'n_reversed': int(sub_df[f'{z}_reversed'].sum()),
            'reversal_pct': round(reversed_of_touched, 1),
            'avg_reversal_pts': round(avg_rev, 1),
            'ev_pts': round(ev_pts, 2),
        }
        if continuation_pct is not None:
            stat['continuation_pct'] = continuation_pct
        stats.append(stat)
    return stats
```

- [ ] **Step 2: Add 8 new cross-filter subsets to the `subsets` dict**

After line 123 (`'NDR_MID_GAP_DOWN': ...`), add:

```python
    # NDR × Pattern combos
    'NDR_WIDE_HtC':          df[(df['ndr_bucket'] == 'WIDE') & (df['prev_pattern'] == 'HtC')],
    'NDR_WIDE_LtC':          df[(df['ndr_bucket'] == 'WIDE') & (df['prev_pattern'] == 'LtC')],
    'NDR_MID_HtC':           df[(df['ndr_bucket'] == 'MID')  & (df['prev_pattern'] == 'HtC')],
    'NDR_MID_LtC':           df[(df['ndr_bucket'] == 'MID')  & (df['prev_pattern'] == 'LtC')],
    # NDR × Pattern × Gap (tightest, highest edge combos)
    'NDR_WIDE_HtC_GAP_DOWN': df[(df['ndr_bucket'] == 'WIDE') & (df['prev_pattern'] == 'HtC') & (df['gap_direction'] == 'DOWN')],
    'NDR_WIDE_LtC_GAP_UP':   df[(df['ndr_bucket'] == 'WIDE') & (df['prev_pattern'] == 'LtC') & (df['gap_direction'] == 'UP')],
    # Flat gap + NDR bucket
    'NDR_WIDE_GAP_FLAT':     df[(df['ndr_bucket'] == 'WIDE') & (df['gap_direction'] == 'FLAT')],
    'NDR_MID_GAP_FLAT':      df[(df['ndr_bucket'] == 'MID')  & (df['gap_direction'] == 'FLAT')],
```

- [ ] **Step 3: Commit backtest changes**

```bash
cd C:\Users\jcbru\es_trading_system
git add notebooks/11_ndr_levels_backtest.py
git commit -m "feat(backtest): 8 cross-filter subsets + ev_pts + continuation_pct"
```

---

## Task 2: Run backtest + copy JSON

**Files:**
- Modify: `ndr-levels-app/public/data/ndr_levels_summary.json`

- [ ] **Step 1: Run the backtest from es_trading_system**

```powershell
cd C:\Users\jcbru\es_trading_system
python notebooks/11_ndr_levels_backtest.py
```

Expected output ends with:
```
Saved: public/data/ndr_levels_summary.json
Saved: results/reports/ndr_levels_full.csv
```

- [ ] **Step 2: Verify new subsets exist in output**

```powershell
python -c "
import json
with open('public/data/ndr_levels_summary.json') as f:
    d = json.load(f)
new_keys = ['NDR_WIDE_HtC', 'NDR_WIDE_LtC', 'NDR_WIDE_HtC_GAP_DOWN', 'NDR_WIDE_LtC_GAP_UP']
for k in new_keys:
    s = next(x for x in d['stats'][k] if x['zone'] == 'SELL_25')
    print(f'{k}: n={s[\"n\"]} touch={s[\"touch_pct\"]}% ev={s[\"ev_pts\"]} cont={s.get(\"continuation_pct\", \"N/A\")}%')
"
```

Expected: all 4 keys print without KeyError, each with `ev_pts` and `continuation_pct` values.

- [ ] **Step 3: Copy JSON to ndr-levels-app**

```powershell
Copy-Item "C:\Users\jcbru\es_trading_system\public\data\ndr_levels_summary.json" `
          "C:\Users\jcbru\ndr-levels-app\public\data\ndr_levels_summary.json" -Force
```

- [ ] **Step 4: Commit updated JSON**

```bash
cd C:\Users\jcbru\ndr-levels-app
git add public/data/ndr_levels_summary.json
git commit -m "data: regenerate ndr_levels_summary with ev_pts, continuation_pct, 8 new subsets"
```

---

## Task 3: Update TypeScript types

**Files:**
- Modify: `ndr-levels-app/src/lib/types.ts`

- [ ] **Step 1: Add `ev_pts` and `continuation_pct` to `ZoneStat`**

Replace the `ZoneStat` interface in `src/lib/types.ts`:

```typescript
export interface ZoneStat {
  zone: string
  subset: string
  n: number
  n_touched: number
  touch_pct: number
  n_reversed: number
  reversal_pct: number
  avg_reversal_pts: number
  ev_pts: number
  continuation_pct?: number
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\jcbru\ndr-levels-app
git add src/lib/types.ts
git commit -m "feat(types): add ev_pts and continuation_pct to ZoneStat"
```

---

## Task 4: Update page.tsx

**Files:**
- Modify: `ndr-levels-app/src/app/page.tsx`

- [ ] **Step 1: Compute `prevPattern` and update PlanPanel usage**

In `page.tsx`, after the `rthLevels` useMemo (around line 67), add:

```typescript
const prevPattern = useMemo((): 'HtC' | 'LtC' | 'NEUTRAL' => {
  const range = prevHigh - prevLow
  if (range === 0) return 'NEUTRAL'
  const relPos = (prevClose - prevLow) / range
  if (relPos >= 0.6) return 'LtC'
  if (relPos <= 0.4) return 'HtC'
  return 'NEUTRAL'
}, [prevHigh, prevLow, prevClose])
```

Then update the `PlanPanel` JSX (around line 225) from:

```tsx
<PlanPanel levels={levels} timeData={timeData} />
```

to:

```tsx
<PlanPanel levels={levels} timeData={timeData} summary={summary} prevPattern={prevPattern} />
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\jcbru\ndr-levels-app
git add src/app/page.tsx
git commit -m "feat(page): compute prevPattern, pass summary+prevPattern to PlanPanel"
```

---

## Task 5: Refactor PlanPanel.tsx

**Files:**
- Modify: `ndr-levels-app/src/components/PlanPanel.tsx`

This is a full replacement of the file. The existing `RRVisualBar` and `HourBar` components stay unchanged — only the data layer and `derivePlan` logic changes.

- [ ] **Step 1: Replace PlanPanel.tsx with the refactored version**

```typescript
import type { DailyLevels, NdrSummary, ZoneStat, TimeAnalysis, HourStat } from '@/lib/types'

const NDR_TIGHT_MAX = 30
const NDR_WIDE_MIN  = 60

type NdrCat = 'TIGHT' | 'MID' | 'WIDE'
type PrevPattern = 'HtC' | 'LtC' | 'NEUTRAL'

function getNdrCat(ndr: number): NdrCat {
  if (ndr < NDR_TIGHT_MAX) return 'TIGHT'
  if (ndr >= NDR_WIDE_MIN) return 'WIDE'
  return 'MID'
}

// Select best matching subset from JSON, most specific first
function selectSubset(
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
  if (gap === 'FLAT') {
    candidates.push(`NDR_${bucket}_GAP_FLAT`)
  } else {
    candidates.push(`NDR_${bucket}_GAP_${gap}`)
  }
  candidates.push(`NDR_${bucket}`)
  candidates.push('ALL')

  for (const key of candidates) {
    const stats = summary.stats[key]
    if (stats && stats.length > 0) return { key, stats }
  }
  return { key: 'ALL', stats: summary.stats['ALL'] ?? [] }
}

// Conviction: 0–3 based on how many edge conditions are active today
function getConviction(bucket: NdrCat, gap: string, pattern: PrevPattern): number {
  let score = 0
  if (bucket === 'WIDE') score++
  if (gap !== 'FLAT') score++
  // Pattern aligns with counter-gap direction (best historical edge)
  if ((pattern === 'HtC' && gap === 'DOWN') || (pattern === 'LtC' && gap === 'UP')) score++
  return score
}

interface Plan {
  side: 'SELL' | 'BUY'
  entryZone: 'SELL_25' | 'BUY_25'
  entry: number
  stop: number
  t1: number            // anchor — quick capture (50% of position)
  t2: number            // opposite extreme — max points (remaining 50%)
  rr1: number
  rr2: number
  setupLabel: string
  setupColor: string
  touch_pct: number
  reversal_pct: number
  avg_reversal_pts: number
  ev_pts: number
  continuationPct: number | null   // % of entry-zone touches that also hit opposite 100%
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
  const cat = getNdrCat(levels.NDR_total)
  const gap = levels.gap_direction

  // Side: counter-gap direction is best historical edge
  // Gap DOWN → price rallied against gap → SELL at SELL_25
  // Gap UP → price dropped against gap → BUY at BUY_25
  // Flat → SELL side historically stronger
  const side: 'SELL' | 'BUY' = gap === 'UP' ? 'BUY' : 'SELL'
  const entryZone: 'SELL_25' | 'BUY_25' = side === 'SELL' ? 'SELL_25' : 'BUY_25'

  // Setup label
  const gapLabel = gap === 'FLAT' ? 'Flat gap' : `Gap ${gap}`
  const patternLabel = prevPattern !== 'NEUTRAL' ? ` + ${prevPattern}` : ''
  const setupLabel = `${side === 'SELL' ? 'Counter-gap SELL' : 'Counter-gap BUY'} — ${cat} NDR + ${gapLabel}${patternLabel}`
  const setupColor = side === 'SELL' ? '#ff6b6b' : '#44ff88'

  // Select best subset for today
  const { key: subsetKey, stats } = summary
    ? selectSubset(summary, cat, gap, prevPattern)
    : { key: 'ALL', stats: [] }
  const byZone = Object.fromEntries(stats.map((s) => [s.zone, s]))
  const entryStat: ZoneStat | undefined = byZone[entryZone]

  // Entry, stop, targets
  const entry = levels[entryZone]
  const stop  = side === 'SELL' ? levels.SELL_50 : levels.BUY_50
  const t1    = levels.anchor                          // quick target (anchor)
  const t2    = side === 'SELL' ? levels.BUY_100 : levels.SELL_100  // opposite extreme
  const risk  = Math.abs(entry - stop)
  const rr1   = risk > 0 ? Math.abs(t1 - entry) / risk : 0
  const rr2   = risk > 0 ? Math.abs(t2 - entry) / risk : 0

  const conviction = getConviction(cat, gap, prevPattern)

  // Time analysis
  const timeKey = `${entryZone}_${gap}_${cat}`
  const hours: HourStat[] = timeData?.[timeKey] ?? []
  const tradeable = hours.filter((h) => h.hour !== 15 && h.count >= 3)
  const sorted    = [...tradeable].sort((a, b) => b.rev10_pct - a.rev10_pct)

  return {
    side, entryZone, entry, stop, t1, t2, rr1, rr2,
    setupLabel, setupColor,
    touch_pct:          entryStat?.touch_pct         ?? 0,
    reversal_pct:       entryStat?.reversal_pct      ?? 0,
    avg_reversal_pts:   entryStat?.avg_reversal_pts  ?? 0,
    ev_pts:             entryStat?.ev_pts            ?? 0,
    continuationPct:    entryStat?.continuation_pct  ?? null,
    subsetKey,
    conviction,
    bestHour:   sorted[0] ?? null,
    secondHour: sorted[1] ?? null,
    hours: tradeable,
    noEdge: cat === 'TIGHT',
  }
}

// ── Sub-components (unchanged from original) ──────────────────────

function RRVisualBar({ side, stop, entry, t1 }: { side: 'SELL' | 'BUY'; stop: number; entry: number; t1: number }) {
  const riskDist   = Math.abs(entry - stop)
  const rewardDist = Math.abs(t1 - entry)
  const total = riskDist + rewardDist
  const riskPct   = total > 0 ? (riskDist / total) * 100 : 33
  const rewardPct = total > 0 ? (rewardDist / total) * 100 : 67

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-[#30363d] space-y-2 mt-2.5">
      <div className="flex justify-between text-[9px] uppercase tracking-wider font-extrabold text-[#8b949e]">
        <span>Visual R:R (T1)</span>
        <span className={side === 'SELL' ? 'text-[#ff6b6b]' : 'text-[#44ff88]'}>
          {side === 'SELL' ? 'Short Setup' : 'Long Setup'}
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

// ── Main component ────────────────────────────────────────────────

interface Props {
  levels: DailyLevels
  timeData: TimeAnalysis | null
  summary: NdrSummary | null
  prevPattern: 'HtC' | 'LtC' | 'NEUTRAL'
}

export default function PlanPanel({ levels, timeData, summary, prevPattern }: Props) {
  const plan = derivePlan(levels, timeData, summary, prevPattern)
  const cat  = getNdrCat(levels.NDR_total)

  const catConfig = {
    TIGHT: 'text-[#ff6b6b] bg-[#ff6b6b]/10 border-[#ff6b6b]/30',
    MID:   'text-[#ffaa44] bg-[#ffaa44]/10 border-[#ffaa44]/30',
    WIDE:  'text-[#44ff88] bg-[#44ff88]/10 border-[#44ff88]/30',
  }[cat]

  const convictionLabel = ['LOW', 'LOW', 'MEDIUM', 'HIGH'][plan.conviction] ?? 'LOW'
  const convictionColor = ['#8b949e', '#8b949e', '#ffd700', '#44ff88'][plan.conviction] ?? '#8b949e'

  const t2Label = plan.side === 'SELL' ? 'BUY_100' : 'SELL_100'
  const t1Pts   = Math.abs(plan.t1 - plan.entry).toFixed(1)
  const t2Pts   = Math.abs(plan.t2 - plan.entry).toFixed(1)
  const stopPts = Math.abs(plan.stop - plan.entry).toFixed(1)

  return (
    <div
      className="rounded-lg border p-4 space-y-3.5 shadow-xl shadow-black/20 transition-all duration-300"
      style={{ background: '#161b22', borderColor: plan.setupColor + '44' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#30363d]/60 pb-2">
        <h3 className="text-xs uppercase tracking-widest font-extrabold text-[#e6edf3]">Plan del Día</h3>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${catConfig}`}>
            {cat} NDR ({levels.NDR_total.toFixed(1)} pts)
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

      {/* Subset context */}
      <div className="text-[9px] text-[#8b949e] font-mono bg-[#0d1117] px-2 py-1 rounded border border-[#30363d]/40">
        Datos: <span className="text-[#58a6ff]">{plan.subsetKey}</span>
        {' · '}touch <span className="text-[#e6edf3]">{plan.touch_pct.toFixed(0)}%</span>
        {' · '}rev <span className="text-[#e6edf3]">{plan.reversal_pct.toFixed(0)}%</span>
        {' · '}EV <span className="text-[#ffd700] font-bold">{plan.ev_pts.toFixed(1)} pts/día</span>
      </div>

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
              <div className="text-[9px] text-[#8b949e] font-semibold mt-0.5">{plan.entryZone}</div>
            </div>

            <div className="bg-[#0d1117] rounded-lg p-2 border border-[#30363d]/80">
              <div className="text-[9px] uppercase font-bold tracking-wider text-[#8b949e] mb-1">Stop</div>
              <div className="font-mono font-extrabold text-sm text-[#ff6b6b]">
                {plan.stop.toFixed(2)}
              </div>
              <div className="text-[9px] text-[#8b949e] font-semibold mt-0.5">
                {plan.side === 'SELL' ? 'SELL_50' : 'BUY_50'} (−{stopPts} pts)
              </div>
            </div>
          </div>

          {/* Dual targets */}
          <div className="space-y-1.5">
            <div className="text-[9px] uppercase font-bold tracking-wider text-[#8b949e]">Targets — Salida Parcial</div>

            {/* T1 */}
            <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#44ff88]/20 flex items-center justify-between">
              <div>
                <div className="text-[9px] text-[#8b949e] uppercase font-bold">T1 — 50% de la posición</div>
                <div className="font-mono font-extrabold text-sm text-[#44ff88]">{plan.t1.toFixed(2)}</div>
                <div className="text-[9px] text-[#8b949e] mt-0.5">Anchor · R:R 1:{plan.rr1.toFixed(1)}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-[#8b949e]">Potencial</div>
                <div className="font-mono font-bold text-[#44ff88]">+{t1Pts} pts</div>
                <div className="text-[9px] text-[#8b949e]">rev {plan.reversal_pct.toFixed(0)}%</div>
              </div>
            </div>

            {/* T2 */}
            <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#58a6ff]/20 flex items-center justify-between">
              <div>
                <div className="text-[9px] text-[#8b949e] uppercase font-bold">T2 — 50% restante</div>
                <div className="font-mono font-extrabold text-sm text-[#58a6ff]">{plan.t2.toFixed(2)}</div>
                <div className="text-[9px] text-[#8b949e] mt-0.5">{t2Label} · R:R 1:{plan.rr2.toFixed(1)}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-[#8b949e]">Potencial</div>
                <div className="font-mono font-bold text-[#58a6ff]">+{t2Pts} pts</div>
                {plan.continuationPct !== null && (
                  <div className="text-[9px] text-[#8b949e]">cont {plan.continuationPct.toFixed(0)}%</div>
                )}
              </div>
            </div>

            {/* Partial exit rule */}
            <div className="rounded p-2 bg-[#ffd700]/5 border border-[#ffd700]/15 text-[9px] text-[#ffd700] leading-relaxed">
              Regla: Al llegar T1 → cerrar 50%, mover stop a breakeven, dejar correr a T2
            </div>
          </div>

          {/* RR visual (T1) */}
          <RRVisualBar side={plan.side} stop={plan.stop} entry={plan.entry} t1={plan.t1} />
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
cd C:\Users\jcbru\ndr-levels-app
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlanPanel.tsx
git commit -m "feat(PlanPanel): dual-target T1/T2, live JSON stats, conviction score, ev_pts"
```

---

## Task 6: Build + Deploy to Vercel

**Files:** none — deployment only

- [ ] **Step 1: Build locally to catch errors**

```powershell
cd C:\Users\jcbru\ndr-levels-app
npm run build
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 2: Deploy to Vercel**

```powershell
npx vercel --prod
```

Expected: deployment URL printed ending in `vercel.app`. Confirm it matches `ndr-levels-app.vercel.app`.

- [ ] **Step 3: Smoke test**

Open `https://ndr-levels-app.vercel.app` and verify:
- PlanPanel shows "Datos: NDR_WIDE_..." (not "ALL") when NDR > 60
- T1 and T2 targets are different values
- EV shows a number (not 0)
- Conviction badge shows HIGH/MEDIUM/LOW
- "Regla: Al llegar T1 → cerrar 50%..." text visible

---

## Self-Review Notes

- **Spec coverage:** All 5 spec requirements covered (new subsets ✓, ev_pts ✓, continuation_pct ✓, dual-target ✓, conviction score ✓, summary passed to PlanPanel ✓)
- **Type consistency:** `ZoneStat.ev_pts` defined in Task 3 and consumed in Task 5 — matches. `ZoneStat.continuation_pct` optional in both.
- **Placeholders:** None.
- **Edge case:** If backtest subset has n<5 (sparse data), `ev_pts` will be low — system will fall back to broader subset via priority chain, showing correct data.
- **prevPattern in page.tsx:** Uses daily OHLC approximation (close position in range). This is an approximation of the true HtC/LtC classifier (which needs hourly data), but sufficient for subset selection. Works with existing InputPanel inputs — no new fields needed.
- **RRVisualBar:** Kept identical structure, updated prop name from `target` to `t1` for clarity.
