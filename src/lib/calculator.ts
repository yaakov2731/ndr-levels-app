import type { DailyLevels } from './types'

export function computeDailyLevels(
  prevHigh: number,
  prevLow: number,
  prevClose: number,
  todayOpen: number,
): DailyLevels {
  const prev_range = prevHigh - prevLow
  const gap = todayOpen - prevClose
  const NDR_total = prev_range + Math.abs(gap)
  const anchor = prevClose
  const TR = 0.75 * prev_range
  const NDR = 0.75 * NDR_total
  const T = TR + NDR
  const gap_direction: 'UP' | 'DOWN' | 'FLAT' =
    gap > 0 ? 'UP' : gap < 0 ? 'DOWN' : 'FLAT'

  return {
    prev_range, gap, gap_direction, NDR_total, anchor,
    SELL_100: anchor + 0.500 * NDR_total,
    SELL_50:  anchor + 0.250 * NDR_total,
    SELL_25:  anchor + 0.125 * NDR_total,
    BUY_25:   anchor - 0.125 * NDR_total,
    BUY_50:   anchor - 0.250 * NDR_total,
    BUY_100:  anchor - 0.500 * NDR_total,
    TR, NDR, T, R_75: T * 0.75, R_25: T * 0.25, R: T * 0.50,
  }
}
