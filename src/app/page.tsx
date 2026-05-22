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
  const [rthOpen,   setRthOpen]   = useState(5442.0)
  const [sessionMode, setSessionMode] = useState<'globex' | 'rth'>('globex')
  const [statsFilter, setStatsFilter] = useState('ALL')
  const [summary, setSummary]   = useState<NdrSummary | null>(null)
  const [timeData, setTimeData] = useState<TimeAnalysis | null>(null)

  useEffect(() => {
    fetch('/data/ndr_levels_summary.json')
      .then((r) => r.json()).then(setSummary).catch(() => {})
    fetch('/data/ndr_time_analysis.json')
      .then((r) => r.json()).then(setTimeData).catch(() => {})
  }, [])

  const globexLevels = useMemo(
    () => computeDailyLevels(prevHigh, prevLow, prevClose, todayOpen),
    [prevHigh, prevLow, prevClose, todayOpen],
  )

  const rthLevels = useMemo(
    () => computeDailyLevels(prevHigh, prevLow, prevClose, rthOpen),
    [prevHigh, prevLow, prevClose, rthOpen],
  )

  const prevPattern = useMemo((): 'HtC' | 'LtC' | 'NEUTRAL' => {
    const range = prevHigh - prevLow
    if (range === 0) return 'NEUTRAL'
    const relPos = (prevClose - prevLow) / range
    if (relPos >= 0.6) return 'LtC'
    if (relPos <= 0.4) return 'HtC'
    return 'NEUTRAL'
  }, [prevHigh, prevLow, prevClose])

  const levels = sessionMode === 'globex' ? globexLevels : rthLevels

  const activeStats: ZoneStat[] = summary?.stats?.[statsFilter] ?? []
  const gapStats:    ZoneStat[] = summary?.stats?.[`GAP_${levels.gap_direction}`] ?? []
  const entryZone = getEntryZone(levels.gap_direction)

  return (
    <div className="bg-[#0d1117] flex flex-col min-h-screen text-[#e6edf3] font-sans antialiased">

      {/* ── Header ── */}
      <header className="flex-shrink-0 border-b border-[#30363d] bg-[#161b22]/50 backdrop-blur-md px-4 md:px-6 py-3.5 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="bg-gradient-to-r from-[#58a6ff] to-[#bc8cff] bg-clip-text text-transparent font-extrabold text-lg md:text-xl tracking-tight">
            NDR Levels Dashboard
          </span>
          <span className="bg-[#21262d] text-[#58a6ff] text-[10px] md:text-xs px-2 py-0.5 rounded font-mono border border-[#30363d]">
            /ES Futures
          </span>
        </div>
        {summary && (
          <span className="text-[#8b949e] text-[10px] md:text-xs bg-[#161b22] border border-[#30363d] px-2.5 py-1 rounded-full">
            Historical Data: <span className="text-[#e6edf3] font-medium">{summary.total_days.toLocaleString()}</span> days &middot; <span className="font-mono text-[#58a6ff]">{summary.date_from.slice(0, 10)}</span> &rarr; <span className="font-mono text-[#58a6ff]">{summary.date_to.slice(0, 10)}</span>
          </span>
        )}
      </header>

      {/* ── Body: stack on mobile / row on md+ ── */}
      <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">

        {/* Sidebar */}
        <aside className="
          w-full md:w-64 lg:w-72
          flex-shrink-0
          border-b md:border-b-0 md:border-r border-[#30363d]
          p-4 space-y-4 bg-[#0d1117]
          md:overflow-y-auto md:h-full
        ">
          <InputPanel
            prevHigh={prevHigh}   setPrevHigh={setPrevHigh}
            prevLow={prevLow}     setPrevLow={setPrevLow}
            prevClose={prevClose} setPrevClose={setPrevClose}
            todayOpen={todayOpen} setTodayOpen={setTodayOpen}
            rthOpen={rthOpen}     setRthOpen={setRthOpen}
          />
          <MetricsPanel levels={levels} />
        </aside>

        {/* Main */}
        <main className="flex-1 p-3 md:p-5 space-y-4 overflow-y-auto bg-[#0d1117]/80">

          {/* Dynamic Session Switcher & Comparative Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#161b22] border border-[#30363d] rounded-lg p-3 shadow-lg shadow-black/20">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] text-[#8b949e] font-bold uppercase tracking-wider">Activar Sesión:</span>
              <div className="inline-flex rounded-md p-0.5 bg-[#0d1117] border border-[#30363d]">
                <button
                  onClick={() => setSessionMode('globex')}
                  className={`px-3 py-1 text-xs font-bold rounded transition-all duration-200 cursor-pointer ${
                    sessionMode === 'globex'
                      ? 'bg-[#58a6ff] text-[#0d1117] shadow-sm shadow-[#58a6ff]/20'
                      : 'text-[#8b949e] hover:text-[#e6edf3]'
                  }`}
                >
                  Globex (ETH)
                </button>
                <button
                  onClick={() => setSessionMode('rth')}
                  className={`px-3 py-1 text-xs font-bold rounded transition-all duration-200 cursor-pointer ${
                    sessionMode === 'rth'
                      ? 'bg-[#58a6ff] text-[#0d1117] shadow-sm shadow-[#58a6ff]/20'
                      : 'text-[#8b949e] hover:text-[#e6edf3]'
                  }`}
                >
                  RTH (Regular)
                </button>
              </div>
            </div>
            
            {/* Quick comparisons of key levels */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono">
              <div className="flex items-center gap-1.5 border-r border-[#30363d] pr-4 last:border-r-0">
                <span className="text-[#8b949e] text-[9px] uppercase tracking-wider">Rango NDR (GLB/RTH):</span>
                <span className="text-[#58a6ff] font-bold">{globexLevels.NDR_total.toFixed(1)}</span>
                <span className="text-[#8b949e]">/</span>
                <span className="text-[#bc8cff] font-bold">{rthLevels.NDR_total.toFixed(1)}</span>
                <span className="text-[#8b949e] text-[10px] font-sans">pts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#8b949e] text-[9px] uppercase tracking-wider">Extremo SELL (GLB vs RTH):</span>
                <span className="text-[#ff6b6b] font-bold">{globexLevels.SELL_100.toFixed(1)}</span>
                <span className="text-[#8b949e]">vs</span>
                <span className="text-[#ff8888] font-bold">{rthLevels.SELL_100.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Chart — responsive height */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-2 md:p-4 h-[220px] sm:h-[280px] md:h-[360px] shadow-lg shadow-black/20 relative group">
            <div className="absolute top-3 left-4 z-10 bg-[#0d1117]/85 border border-[#30363d] text-[10px] uppercase font-bold text-[#8b949e] px-2 py-0.5 rounded shadow-md">
              Vista Gráfica - {sessionMode === 'globex' ? 'Globex (ETH)' : 'Regular (RTH)'}
            </div>
            <LevelsChart levels={levels} entryZone={entryZone} />
          </div>

          {/* Level reference grid — 4 cols on mobile, 7 on desktop */}
          <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5 md:gap-2.5">
            {LEVELS_GRID.map(({ label, key, color }) => {
              const val = levels[key as keyof typeof levels] as number
              const isAnchor = key === 'anchor'
              return (
                <div
                  key={key}
                  className="bg-[#161b22] border border-[#30363d] rounded-lg p-2 md:p-3 text-center transition-all duration-200 hover:border-[#58a6ff]/40 shadow-sm"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                >
                  <div className="text-[9px] md:text-[10px] text-[#8b949e] uppercase font-bold tracking-wider leading-tight">{label}</div>
                  <div style={{ color }} className="font-mono font-extrabold text-xs md:text-[15px] mt-1 tracking-tight">
                    {val.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Stats + right panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Stats table — full width on mobile, 2/3 on desktop */}
            <div className="lg:col-span-2 bg-[#161b22] border border-[#30363d] rounded-lg p-4 shadow-lg shadow-black/10">
              <div className="flex items-center justify-between mb-3 border-b border-[#30363d] pb-2">
                <h3 className="text-xs uppercase tracking-widest font-bold text-[#8b949e]">Historical Statistics</h3>
                <select
                  value={statsFilter}
                  onChange={(e) => setStatsFilter(e.target.value)}
                  className="bg-[#21262d] border border-[#30363d] text-[#e6edf3] text-xs font-semibold rounded px-2.5 py-1 focus:outline-none focus:border-[#58a6ff] cursor-pointer transition-colors"
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

            {/* Right panels — stacked */}
            <div className="space-y-4">
              <PlanPanel levels={levels} timeData={timeData} summary={summary} prevPattern={prevPattern} />
              <EdgePanel levels={levels} summary={summary} />
              <GapSignalBox levels={levels} gapStats={gapStats} />
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 shadow-lg shadow-black/10">
                <div className="text-[10px] uppercase tracking-widest font-bold text-[#8b949e] mb-2 border-b border-[#30363d]/60 pb-1">NDR Formulas</div>
                <div className="text-xs text-[#8b949e] font-mono space-y-1 bg-[#0d1117] p-2.5 rounded border border-[#30363d]/40">
                  <div className="flex justify-between"><span>NDR Total</span><span className="text-[#e6edf3]">range + |gap|</span></div>
                  <div className="flex justify-between"><span>SELL Levels</span><span className="text-[#ff8888]">anchor + 50/25/12.5%</span></div>
                  <div className="flex justify-between"><span>BUY Levels</span><span className="text-[#88ff88]">anchor - 12.5/25/50%</span></div>
                  <div className="flex justify-between"><span>TR (True Range)</span><span className="text-[#e6edf3]">75% x range</span></div>
                  <div className="flex justify-between"><span>T (Total Limit)</span><span className="text-[#e6edf3]">TR + 75% x NDR</span></div>
                  <div className="flex justify-between"><span>R (Reversal Size)</span><span className="text-[#e6edf3]">50% x T</span></div>
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
