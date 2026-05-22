export interface DailyLevels {
  prev_range: number
  gap: number
  gap_direction: 'UP' | 'DOWN' | 'FLAT'
  NDR_total: number
  anchor: number
  SELL_100: number
  SELL_50: number
  SELL_25: number
  BUY_25: number
  BUY_50: number
  BUY_100: number
  TR: number
  NDR: number
  T: number
  R_75: number
  R_25: number
  R: number
}

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

export interface NdrSummary {
  symbol: string
  total_days: number
  date_from: string
  date_to: string
  reversal_min_pts: number
  ndr_thresholds: { tight_max: number; wide_min: number }
  stats: Record<string, ZoneStat[]>
}

export interface HourStat {
  hour: number
  hour_label: string
  count: number
  rev10_pct: number
  rev20_pct: number
  avg_rev: number
}

export type TimeAnalysis = Record<string, HourStat[]>
