# NDR Trade Plan Optimizer — Design Spec
**Date:** 2026-05-22  
**Repo:** ndr-levels-app  
**Goal:** Expand backtest combos + refactor PlanPanel to maximize captured points via data-driven entry/exit plan.

---

## Problem

1. `PlanPanel` hardcodes reversal stats — not sourced from historical data.
2. Target is set to `anchor` (prevClose), not the `BUY_100/SELL_100` extreme — leaving points on the table.
3. Missing cross-filter subsets (NDR bucket × HtC/LtC × gap direction) in the backtest — highest-edge combos unknown.
4. No EV metric (`touch_pct × avg_reversal_pts`) — no way to rank setups by expected value.
5. `page.tsx` does not pass `summary` to `PlanPanel` — plan cannot read live stats.

---

## Architecture

### Layer 1 — Python backtest (`es_trading_system/notebooks/11_ndr_levels_backtest.py`)

**New cross-filter subsets (8 additions):**

```python
'NDR_WIDE_HtC':            WIDE × HtC
'NDR_WIDE_LtC':            WIDE × LtC
'NDR_WIDE_HtC_GAP_DOWN':   WIDE × HtC × Gap DOWN   # likely best SELL setup
'NDR_WIDE_LtC_GAP_UP':     WIDE × LtC × Gap UP     # likely best BUY setup
'NDR_MID_HtC':             MID × HtC
'NDR_MID_LtC':             MID × LtC
'NDR_WIDE_GAP_FLAT':       WIDE × Flat gap
'NDR_MID_GAP_FLAT':        MID × Flat gap
```

**New metric in `zone_stats()` output:**
```python
'ev_pts': round((touch_pct / 100) * avg_reversal_pts, 2)
```

**Continuation analysis:** for `_25` zones only, compute what percentage of days where `BUY_25` was touched also reached `BUY_100` (and same for SELL side). New field `continuation_pct` per zone stat.

```python
# Example for BUY_25 → BUY_100 continuation
buy25_touched = sub_df['BUY_25_touched']
buy100_reached = sub_df.loc[buy25_touched, 'BUY_100_touched']
continuation_pct = buy100_reached.mean() * 100 if buy25_touched.any() else 0.0
```

Output: backtest writes to `es_trading_system/public/data/ndr_levels_summary.json`. After running, copy to `ndr-levels-app/public/data/ndr_levels_summary.json` (manual step or script).

---

### Layer 2 — Data types (`src/lib/types.ts`)

Add two fields to `ZoneStat`:

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
  ev_pts: number              // NEW: touch_pct/100 × avg_reversal_pts
  continuation_pct?: number   // NEW: % of _25 touches that continued to _100
}
```

---

### Layer 3 — `page.tsx`

Pass `summary` to `PlanPanel` (currently missing):

```tsx
<PlanPanel levels={levels} timeData={timeData} summary={summary} />
```

---

### Layer 4 — `PlanPanel.tsx` refactor

**Remove:** all hardcoded `rev10` / `avgRev` values.

**Add `summary: NdrSummary | null` prop.**

**Subset selection logic** (priority order, pick first available):
1. `NDR_{bucket}_{pattern}_GAP_{dir}` (e.g. `NDR_WIDE_HtC_GAP_DOWN`)
2. `NDR_{bucket}_{pattern}` (e.g. `NDR_WIDE_HtC`)
3. `NDR_{bucket}_GAP_{dir}` (e.g. `NDR_WIDE_GAP_DOWN`)
4. `NDR_{bucket}` (e.g. `NDR_WIDE`)
5. `ALL` — fallback

**Target change:**
- Target 1 (T1, 50% of position): `anchor` — quick capture
- Target 2 (T2, remaining 50%): `BUY_100` or `SELL_100` — extreme, max points

**Stats sourced from JSON** for the selected subset:
- `SELL_25` or `BUY_25` zone: `touch_pct`, `reversal_pct`, `avg_reversal_pts`, `ev_pts`
- `continuation_pct`: probability that 25% → 100% continuation occurs

**Conviction score (0–3):**
- NDR WIDE: +1
- HtC/LtC pattern matches gap direction counter-move: +1
- Gap direction is not FLAT: +1

**Stop:** `BUY_50` for longs, `SELL_50` for shorts (unchanged).

**Partial exit rule (displayed in UI):**
> When price reaches T1 (anchor): close 50% of position, move stop to breakeven, let remaining 50% target T2.

---

## Plan UI — `PlanPanel` output

```
┌─ PLAN DEL DÍA ─────────────────────────────────────── WIDE NDR ┐
│  NDR WIDE + LtC + GAP UP                      ★★★ HIGH CONV   │
│                                                                  │
│  ENTRADA:  BUY_25  @ 5392.50                                    │
│  STOP:     BUY_50  @ 5376.00    (−6.25 pts, si cierra abajo)   │
│  T1 (½):   ANCHOR  @ 5432.00   (+19.5 pts) — rev 74% hist      │
│  T2 (½):   BUY_100 @ 5355.00   (+37.5 pts) — cont 44% desde 25%│
│  EV total: 12.4 pts/día esperados                                │
│                                                                  │
│  Ventana óptima: 10:00–11:00 EST  ★ 84% rev≥10                 │
│  Regla: Al llegar T1 → cerrar 50%, stop a breakeven            │
└──────────────────────────────────────────────────────────────────┘
```

**Conviction badge:**
- 3/3 → `HIGH` (green)
- 2/3 → `MEDIUM` (yellow)
- 1/3 or TIGHT NDR → `LOW` / skip warning

---

## Files changed

| File | Change |
|------|--------|
| `es_trading_system/notebooks/11_ndr_levels_backtest.py` | +8 subsets, `ev_pts`, `continuation_pct` |
| `public/data/ndr_levels_summary.json` | Regenerated (richer) |
| `src/lib/types.ts` | `ev_pts`, `continuation_pct` on `ZoneStat` |
| `src/app/page.tsx` | Pass `summary` prop to `PlanPanel` |
| `src/components/PlanPanel.tsx` | Full refactor — remove hardcoded stats, dual-target, conviction score |

No new components. No schema changes outside types. EdgePanel untouched.

---

## Success criteria

- `PlanPanel` shows T1/T2 targets with stats sourced from JSON (zero hardcoded values)
- EV visible and higher in WIDE NDR conditions vs TIGHT
- Conviction score correctly reflects how many conditions align today
- Continuation % shown for the 25%→100% path
- All existing filters in `StatsTable` / `EdgePanel` continue working unchanged
