import type { ZoneStat } from '@/lib/types'

const ZONE_LABELS: Record<string, string> = {
  SELL_100: 'SELL 100%', SELL_50: 'SELL 50%', SELL_25: 'SELL 25%',
  BUY_25:   'BUY 25%',  BUY_50:  'BUY 50%',  BUY_100: 'BUY 100%',
}
const ZONE_ORDER = ['SELL_100', 'SELL_50', 'SELL_25', 'BUY_25', 'BUY_50', 'BUY_100']
const ZONE_COLORS: Record<string, string> = {
  SELL_100: '#ff4444', SELL_50: '#ff8888', SELL_25: '#ffbbbb',
  BUY_25:   '#bbffbb', BUY_50:  '#88ff88', BUY_100: '#44ff44',
}

export default function StatsTable({ stats }: { stats: ZoneStat[] }) {
  const byZone = Object.fromEntries(stats.map((s) => [s.zone, s]))
  if (!stats.length) return <p className="text-[#8b949e] text-sm">No data</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-[#8b949e] border-b border-[#30363d]">
            <th className="text-left py-2 pr-4">Zone</th>
            <th className="text-right py-2 pr-4">N days</th>
            <th className="text-right py-2 pr-4">Touch%</th>
            <th className="text-right py-2 pr-4">Rev/Touch%</th>
            <th className="text-right py-2">Avg Rev</th>
          </tr>
        </thead>
        <tbody>
          {ZONE_ORDER.filter((z) => z in byZone).map((z) => {
            const s = byZone[z]
            return (
              <tr key={z} className="border-b border-[#21262d] hover:bg-[#21262d] transition-colors">
                <td className="py-2 pr-4">
                  <span style={{ color: ZONE_COLORS[z] }} className="font-semibold">
                    {ZONE_LABELS[z]}
                  </span>
                </td>
                <td className="text-right py-2 pr-4 text-[#8b949e] font-mono text-xs">
                  {s.n_touched}/{s.n}
                </td>
                <td className="text-right py-2 pr-4">
                  <span style={{ opacity: 0.4 + (s.touch_pct / 170) }} className="text-[#e6edf3]">
                    {s.touch_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="text-right py-2 pr-4">
                  <span style={{ opacity: 0.4 + (s.reversal_pct / 170) }} className="text-[#e6edf3]">
                    {s.reversal_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="text-right py-2 text-[#8b949e] font-mono text-xs">
                  {s.avg_reversal_pts.toFixed(1)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
