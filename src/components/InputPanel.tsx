'use client'

interface Props {
  prevHigh:  number; setPrevHigh:  (v: number) => void
  prevLow:   number; setPrevLow:   (v: number) => void
  prevClose: number; setPrevClose: (v: number) => void
  todayOpen: number; setTodayOpen: (v: number) => void
  rthOpen:   number; setRthOpen:   (v: number) => void
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-[10px] text-[#8b949e] uppercase tracking-widest mb-1">{label}</label>
      <input
        type="number"
        step="0.25"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#e6edf3] text-sm focus:border-[#58a6ff] focus:outline-none transition-colors"
      />
    </div>
  )
}

export default function InputPanel(props: Props) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 shadow-lg shadow-black/20">
      <h2 className="text-xs uppercase tracking-widest text-[#8b949e] font-semibold mb-3">Session Data</h2>
      {/* Grid structure */}
      <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
        <NumInput label="Prev High"  value={props.prevHigh}  onChange={props.setPrevHigh} />
        <NumInput label="Prev Low"   value={props.prevLow}   onChange={props.setPrevLow} />
        <NumInput label="Prev Close" value={props.prevClose} onChange={props.setPrevClose} />
        <NumInput label="Globex Open" value={props.todayOpen} onChange={props.setTodayOpen} />
        <NumInput label="RTH Open"    value={props.rthOpen}   onChange={props.setRthOpen} />
      </div>
    </div>
  )
}

