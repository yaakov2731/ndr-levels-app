import type { DailyLevels } from '@/lib/types'

const GAP_COLORS = { UP: '#ff8888', DOWN: '#88ff88', FLAT: '#ffd700' }
const GAP_ICONS  = { UP: '▲', DOWN: '▼', FLAT: '━' }

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-[#8b949e]">{label}</div>
      <div className="text-[#e6edf3] font-semibold text-sm mt-0.5">{value}</div>
    </div>
  )
}

export default function MetricsPanel({ levels }: { levels: DailyLevels }) {
  const gapColor = GAP_COLORS[levels.gap_direction]
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
      <h2 className="text-xs uppercase tracking-widest text-[#8b949e] mb-3">Metrics</h2>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Prev Range" value={`${levels.prev_range.toFixed(2)} pts`} />
        <Metric label="NDR Total"  value={`${levels.NDR_total.toFixed(2)} pts`} />
        <Metric label="TR"         value={`${levels.TR.toFixed(2)}`} />
        <Metric label="NDR"        value={`${levels.NDR.toFixed(2)}`} />
        <Metric label="T"          value={`${levels.T.toFixed(2)}`} />
        <Metric label="R"          value={`${levels.R.toFixed(2)}`} />
      </div>
      <div className="mt-3 bg-[#0d1117] border border-[#30363d] rounded px-3 py-2">
        <div className="text-[10px] uppercase tracking-widest text-[#8b949e]">Gap</div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span style={{ color: gapColor }} className="text-lg font-bold">
            {GAP_ICONS[levels.gap_direction]} {levels.gap_direction}
          </span>
          <span className="text-[#8b949e] text-sm">
            {levels.gap > 0 ? '+' : ''}{levels.gap.toFixed(2)} pts
          </span>
        </div>
      </div>
    </div>
  )
}
