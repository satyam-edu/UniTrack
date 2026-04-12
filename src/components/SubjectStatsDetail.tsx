import React from 'react'
import { motion } from 'motion/react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  stats: {
    attended: number
    total: number
    percentage: number
  }
  targetAttendance: number
  recentDates: string[]       // ISO yyyy-MM-dd strings, newest first
  scheduledDays?: string[]    // e.g. ['Monday', 'Wednesday', 'Friday']
  compact?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "Apr 6" — no weekday, just month + day */
function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubjectStatsDetail({
  stats,
  targetAttendance,
  recentDates,
  scheduledDays = [],
  compact = false,
}: Props) {
  const { attended, total, percentage } = stats
  const noData    = total === 0
  const safe      = noData ? 0 : Math.min(100, Math.max(0, percentage))
  const isHealthy = safe >= targetAttendance

  // Ring geometry — always a fixed generous size for clarity
  const ringSize = compact ? 112 : 120
  const strokeW  = 7
  const r        = (ringSize - strokeW * 2) / 2
  const circ     = 2 * Math.PI * r
  const offset   = circ - (safe / 100) * circ
  const ringColor = noData ? '#cbd5e1' : isHealthy ? '#22c55e' : '#ef4444'

  // Projection text
  const targetFrac = targetAttendance / 100
  let projectionText = ''
  if (!noData) {
    if (isHealthy) {
      projectionText = 'On track ✓'
    } else {
      const x = Math.ceil((targetFrac * total - attended) / (1 - targetFrac))
      projectionText = x > 0 ? `Attend ${x} more to reach ${targetAttendance}%` : 'Critical ⚠'
    }
  }

  return (
    <div className="space-y-4">

      {/* ── Big Ring ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center py-1">
        <div
          className="relative flex items-center justify-center"
          style={{ width: ringSize, height: ringSize }}
        >
          <svg
            className="-rotate-90 absolute inset-0 w-full h-full"
            viewBox={`0 0 ${ringSize} ${ringSize}`}
          >
            {/* Track */}
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={r}
              stroke="#f1f5f9" strokeWidth={strokeW} fill="none"
            />
            {/* Progress */}
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={r}
              stroke={ringColor} strokeWidth={strokeW} fill="none"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>

          {/* Centre label */}
          <div className="flex flex-col items-center z-10 select-none">
            <span
              className="text-4xl font-bold leading-none"
              style={{ color: ringColor }}
            >
              {Math.round(safe)}
            </span>
            <span className="text-[10px] font-medium text-slate-400 mt-1 tracking-widest uppercase">
              {noData ? 'no data' : 'percent'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stat boxes ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center py-2.5 px-1 rounded-2xl bg-green-50 border border-green-100">
          <span className="text-xl font-extrabold text-green-600 leading-none">{attended}</span>
          <span className="text-[10px] font-bold text-green-500 mt-1 tracking-wide uppercase">Present</span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-1 rounded-2xl bg-red-50 border border-red-100">
          <span className="text-xl font-extrabold text-red-500 leading-none">{total - attended}</span>
          <span className="text-[10px] font-bold text-red-400 mt-1 tracking-wide uppercase">Absent</span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-1 rounded-2xl bg-slate-100 border border-slate-200/70">
          <span className="text-xl font-extrabold text-slate-600 leading-none">{total}</span>
          <span className="text-[10px] font-bold text-slate-400 mt-1 tracking-wide uppercase">Total</span>
        </div>
      </div>

      {/* ── Target progress bar ───────────────────────────────────────────── */}
      {!noData && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">Target: {targetAttendance}%</span>
            <span className={`text-xs font-bold ${isHealthy ? 'text-green-600' : 'text-red-500'}`}>
              {projectionText}
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${safe}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: ringColor }}
            />
            {/* Target marker */}
            <div
              className="absolute top-0 bottom-0 w-px bg-slate-400/60"
              style={{ left: `${targetAttendance}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Scheduled Days ────────────────────────────────────────────────── */}
      {scheduledDays.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 whitespace-nowrap flex-shrink-0">Scheduled</span>
          <div className="flex flex-wrap gap-1">
            {scheduledDays.map((day) => (
              <span
                key={day}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60"
              >
                {day.slice(0, 3)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Dates Attended ────────────────────────────────────────────────── */}
      {recentDates.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5">Dates Attended</p>
          <div className="flex flex-wrap gap-1.5 max-h-[56px] overflow-y-auto">
            {recentDates.map((d) => (
              <span
                key={d}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100 whitespace-nowrap"
              >
                {formatDate(d)}
              </span>
            ))}
          </div>
        </div>
      )}

      {noData && (
        <p className="text-center text-sm text-slate-400 py-2">No attendance recorded yet.</p>
      )}
    </div>
  )
}
