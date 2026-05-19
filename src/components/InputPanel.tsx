'use client'

interface Props {
  prevHigh:  number; setPrevHigh:  (v: number) => void
  prevLow:   number; setPrevLow:   (v: number) => void
  prevClose: number; setPrevClose: (v: number) => void
  todayOpen: number; setTodayOpen: (v: number) => void
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-3">
      <label className="block text-xs text-[#8b949e] uppercase tracking-widest mb-1">{label}</label>
      <input
        type="number"
        step="0.25"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#e6edf3] text-sm focus:border-[#58a6ff] focus:outline-none"
      />
    </div>
  )
}

export default function InputPanel(props: Props) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
      <h2 className="text-xs uppercase tracking-widest text-[#8b949e] mb-4">Session Data</h2>
      <NumInput label="Prev High"  value={props.prevHigh}  onChange={props.setPrevHigh} />
      <NumInput label="Prev Low"   value={props.prevLow}   onChange={props.setPrevLow} />
      <NumInput label="Prev Close" value={props.prevClose} onChange={props.setPrevClose} />
      <NumInput label="Today Open" value={props.todayOpen} onChange={props.setTodayOpen} />
    </div>
  )
}
