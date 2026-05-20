'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import InputPanel   from '@/components/InputPanel'
import MetricsPanel from '@/components/MetricsPanel'
import StatsTable   from '@/components/StatsTable'
import GapSignalBox from '@/components/GapSignalBox'
import EdgePanel    from '@/components/EdgePanel'
import PlanPanel    from '@/components/PlanPanel'
import { computeDailyLevels } from '@/lib/calculator'
import type { NdrSummary, ZoneStat, TimeAnalysis } from '@/lib/types'

const LevelsChart = dynamic(() => import('@/components/LevelsChart'), { ssr: false })

const FILTER_OPTIONS = [
  { label: 'All Days',      key: 'ALL'              },
  { label: 'Gap UP',        key: 'GAP_UP'           },
  { label: 'Gap DOWN',      key: 'GAP_DOWN'         },
  { label: 'HtC Days',      key: 'HtC'              },
  { label: 'LtC Days',      key: 'LtC'              },
  { label: '─────',         key: '__sep__'          },
  { label: 'NDR Wide (>60)',key: 'NDR_WIDE'         },
  { label: 'NDR Mid',       key: 'NDR_MID'          },
  { label: 'NDR Tight(<30)',key: 'NDR_TIGHT'        },
  { label: 'Wide + Gap UP', key: 'NDR_WIDE_GAP_UP'  },
  { label: 'Wide + Gap DWN',key: 'NDR_WIDE_GAP_DOWN'},
]

const LEVELS_GRID = [
  { label: 'SELL 100%', key: 'SELL_100', color: '#ff4444' },
  { label: 'SELL  50%', key: 'SELL_50',  color: '#ff8888' },
  { label: 'SELL  25%', key: 'SELL_25',  color: '#ffbbbb' },
  { label: 'ANCHOR',    key: 'anchor',   color: '#ffd700' },
  { label: 'BUY   25%', key: 'BUY_25',  color: '#bbffbb' },
  { label: 'BUY   50%', key: 'BUY_50',  color: '#88ff88' },
  { label: 'BUY  100%', key: 'BUY_100', color: '#44ff44' },
]

function getEntryZone(gap: string): 'SELL_25' | 'BUY_25' {
  return gap === 'UP' ? 'BUY_25' : 'SELL_25'
}

export default function Home() {
  const [prevHigh,  setPrevHigh]  = useState(5528.0)
  const [prevLow,   setPrevLow]   = useState(5409.0)
  const [prevClose, setPrevClose] = useState(5432.0)
  const [todayOpen, setTodayOpen] = useState(5435.0)
  const [statsFilter, setStatsFilter] = useState('ALL')
  const [summary, setSummary] = useState<NdrSummary | null>(null)
  const [timeData, setTimeData] = useState<TimeAnalysis | null>(null)

  useEffect(() => {
    fetch('/data/ndr_levels_summary.json')
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {})
    fetch('/data/ndr_time_analysis.json')
      .then((r) => r.json())
      .then(setTimeData)
      .catch(() => {})
  }, [])

  const levels = useMemo(
    () => computeDailyLevels(prevHigh, prevLow, prevClose, todayOpen),
    [prevHigh, prevLow, prevClose, todayOpen],
  )

  const activeStats: ZoneStat[] = summary?.stats?.[statsFilter] ?? []
  const gapKey   = `GAP_${levels.gap_direction}`
  const gapStats: ZoneStat[] = summary?.stats?.[gapKey] ?? []
  const entryZone = getEntryZone(levels.gap_direction)

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <header className="border-b border-[#30363d] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[#e6edf3] font-bold text-lg tracking-tight">NDR Levels</span>
          <span className="bg-[#21262d] text-[#58a6ff] text-xs px-2 py-0.5 rounded font-mono border border-[#30363d]">
            /ES
          </span>
        </div>
        {summary && (
          <span className="text-[#8b949e] text-xs">
            {summary.total_days.toLocaleString()} days &middot; {summary.date_from.slice(0, 10)} &rarr; {summary.date_to.slice(0, 10)}
          </span>
        )}
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 49px)' }}>
        {/* Sidebar */}
        <aside className="w-64 border-r border-[#30363d] p-4 overflow-y-auto flex-shrink-0 space-y-4">
          <InputPanel
            prevHigh={prevHigh}   setPrevHigh={setPrevHigh}
            prevLow={prevLow}     setPrevLow={setPrevLow}
            prevClose={prevClose} setPrevClose={setPrevClose}
            todayOpen={todayOpen} setTodayOpen={setTodayOpen}
          />
          <MetricsPanel levels={levels} />
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Chart */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
            <LevelsChart levels={levels} entryZone={entryZone} />
          </div>

          {/* Level reference grid */}
          <div className="grid grid-cols-7 gap-2">
            {LEVELS_GRID.map(({ label, key, color }) => (
              <div
                key={key}
                className="bg-[#161b22] border border-[#30363d] rounded p-3 text-center"
                style={{ borderLeftColor: color, borderLeftWidth: 3 }}
              >
                <div className="text-[10px] text-[#8b949e] uppercase whitespace-nowrap">{label}</div>
                <div style={{ color }} className="font-mono font-bold text-sm mt-1">
                  {(levels[key as keyof typeof levels] as number).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Stats + side panels */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-[#161b22] border border-[#30363d] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#e6edf3]">Historical Statistics</h3>
                <select
                  value={statsFilter}
                  onChange={(e) => setStatsFilter(e.target.value)}
                  className="bg-[#21262d] border border-[#30363d] text-[#e6edf3] text-xs rounded px-2 py-1 focus:outline-none focus:border-[#58a6ff]"
                >
                  {FILTER_OPTIONS.map((o) =>
                    o.key === '__sep__'
                      ? <option key="__sep__" disabled>─────────────</option>
                      : <option key={o.key} value={o.key}>{o.label}</option>
                  )}
                </select>
              </div>
              {summary ? (
                <StatsTable stats={activeStats} />
              ) : (
                <p className="text-[#8b949e] text-sm">Loading stats...</p>
              )}
            </div>

            <div className="space-y-4">
              <PlanPanel levels={levels} timeData={timeData} />
              <EdgePanel levels={levels} summary={summary} />
              <GapSignalBox levels={levels} gapStats={gapStats} />
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                <div className="text-[10px] uppercase tracking-widest text-[#8b949e] mb-2">Formula</div>
                <div className="text-xs text-[#8b949e] font-mono space-y-1">
                  <div>NDR = range + |gap|</div>
                  <div>SELL = anchor + 50/25/12.5%</div>
                  <div>BUY  = anchor - 12.5/25/50%</div>
                  <div>TR = 75% x range</div>
                  <div>T  = TR + 75% x NDR</div>
                  <div>R  = 50% x T</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
