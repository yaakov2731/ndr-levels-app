import type { DailyLevels } from '@/lib/types'

const GAP_COLORS = { UP: '#ff6b6b', DOWN: '#44ff88', FLAT: '#ffd700' }
const GAP_ICONS  = { UP: '▲', DOWN: '▼', FLAT: '━' }
const GAP_BGS    = { UP: 'bg-[#ff6b6b]/10 border-[#ff6b6b]/20', DOWN: 'bg-[#44ff88]/10 border-[#44ff88]/20', FLAT: 'bg-[#ffd700]/10 border-[#ffd700]/20' }

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0d1117] border border-[#30363d]/60 rounded-lg px-3 py-2 hover:border-[#30363d] transition-colors shadow-sm">
      <div className="text-[9px] uppercase tracking-widest font-extrabold text-[#8b949e]">{label}</div>
      <div className="text-[#e6edf3] font-mono font-extrabold text-sm mt-0.5 tracking-tight">{value}</div>
    </div>
  )
}

export default function MetricsPanel({ levels }: { levels: DailyLevels }) {
  const gapColor = GAP_COLORS[levels.gap_direction]
  const gapBg = GAP_BGS[levels.gap_direction]
  
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 shadow-lg shadow-black/10">
      <h2 className="text-xs uppercase tracking-widest font-extrabold text-[#8b949e] mb-3 pb-1 border-b border-[#30363d]/45">Metrics</h2>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Prev Range" value={`${levels.prev_range.toFixed(2)}`} />
        <Metric label="NDR Total"  value={`${levels.NDR_total.toFixed(2)}`} />
        <Metric label="TR"         value={`${levels.TR.toFixed(2)}`} />
        <Metric label="NDR"        value={`${levels.NDR.toFixed(2)}`} />
        <Metric label="T (Limit)"  value={`${levels.T.toFixed(2)}`} />
        <Metric label="R (Reversal)" value={`${levels.R.toFixed(2)}`} />
      </div>
      
      <div className={`mt-3.5 border rounded-lg px-3.5 py-2.5 shadow-sm transition-all duration-300 ${gapBg}`}>
        <div className="text-[9px] uppercase tracking-widest font-extrabold text-[#8b949e]">Daily Gap</div>
        <div className="flex items-baseline justify-between mt-1">
          <span style={{ color: gapColor }} className="text-base font-extrabold tracking-wide flex items-center gap-1.5 animate-pulse">
            <span>{GAP_ICONS[levels.gap_direction]}</span>
            <span>{levels.gap_direction}</span>
          </span>
          <span className="text-[#e6edf3] font-mono font-bold text-sm bg-[#0d1117]/80 border border-[#30363d]/50 px-2 py-0.5 rounded">
            {levels.gap > 0 ? '+' : ''}{levels.gap.toFixed(2)} pts
          </span>
        </div>
      </div>
    </div>
  )
}
