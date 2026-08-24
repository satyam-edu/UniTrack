'use client'

// Shared day x time grid renderer — used both on the AI-import review step
// (cross-check extraction against the source photo, cell by cell) and on
// the /timetable page (an alternate view of the saved schedule). Callers
// adapt their own data (ExtractedClass[] or saved TimetableSlot[]) into
// this generic shape rather than the grid knowing about either source.

export interface GridEntry {
  day: string
  start_time: string   // '9:00 AM'
  end_time: string     // '10:00 AM'
  label: string        // what to show as the title (subject name, or code as a fallback)
  code?: string | null
  room?: string | null
  group?: string | null
  category?: string | null
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function parseTimeToMinutes(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const meridiem = m[3].toUpperCase()
  if (meridiem === 'AM') { if (h === 12) h = 0 } else { if (h !== 12) h += 12 }
  return h * 60 + min
}

function formatHourMark(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60) % 24
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}${period}`
}

/** Greedy lane assignment so overlapping classes (parallel groups) stack instead of collide. */
function assignLanes(entries: GridEntry[]): GridEntry[][] {
  const sorted = [...entries].sort((a, b) => (parseTimeToMinutes(a.start_time) ?? 0) - (parseTimeToMinutes(b.start_time) ?? 0))
  const lanes: GridEntry[][] = []
  for (const entry of sorted) {
    const start = parseTimeToMinutes(entry.start_time) ?? 0
    let placed = false
    for (const lane of lanes) {
      const last = lane[lane.length - 1]
      const lastEnd = parseTimeToMinutes(last.end_time) ?? 0
      if (start >= lastEnd) {
        lane.push(entry)
        placed = true
        break
      }
    }
    if (!placed) lanes.push([entry])
  }
  return lanes
}

const CATEGORY_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  Lab:    { bg: 'rgba(168,85,247,0.14)', border: 'rgba(168,85,247,0.35)', text: '#7c3aed' },
  Theory: { bg: 'rgba(26,158,160,0.14)', border: 'rgba(26,158,160,0.35)', text: '#0f766e' },
}
const DEFAULT_STYLE = { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.30)', text: '#475569' }

export default function TimetableGrid({ entries }: { entries: GridEntry[] }) {
  const timed = entries.filter((e) => parseTimeToMinutes(e.start_time) !== null && parseTimeToMinutes(e.end_time) !== null)
  const days = DAY_ORDER.filter((d) => timed.some((e) => e.day === d))

  if (days.length === 0 || timed.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
        Nothing to show yet.
      </div>
    )
  }

  const allMinutes = timed.flatMap((e) => [parseTimeToMinutes(e.start_time)!, parseTimeToMinutes(e.end_time)!])
  const axisStart = Math.floor(Math.min(...allMinutes) / 60) * 60
  const axisEnd = Math.ceil(Math.max(...allMinutes) / 60) * 60
  const axisSpan = Math.max(axisEnd - axisStart, 60)

  const hourMarks: number[] = []
  for (let m = axisStart; m <= axisEnd; m += 60) hourMarks.push(m)

  return (
    <div className="space-y-2.5">
      {/* Hour ruler */}
      <div className="relative h-4 px-1">
        {hourMarks.map((m) => (
          <span
            key={m}
            className="absolute text-[9px] font-mono text-slate-400 -translate-x-1/2"
            style={{ left: `${((m - axisStart) / axisSpan) * 100}%` }}
          >
            {formatHourMark(m)}
          </span>
        ))}
      </div>

      {days.map((day) => {
        const lanes = assignLanes(timed.filter((e) => e.day === day))
        return (
          <div key={day} className="rounded-2xl border border-slate-100 bg-slate-50 p-2.5">
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1.5 px-0.5">{day}</p>
            <div className="space-y-1">
              {lanes.map((lane, li) => (
                <div key={li} className="relative h-12">
                  {lane.map((e, i) => {
                    const start = parseTimeToMinutes(e.start_time)!
                    const end = parseTimeToMinutes(e.end_time)!
                    const left = ((start - axisStart) / axisSpan) * 100
                    const width = Math.max(((end - start) / axisSpan) * 100, 4)
                    const style = (e.category && CATEGORY_STYLE[e.category]) || DEFAULT_STYLE
                    return (
                      <div
                        key={i}
                        className="absolute top-0 h-full rounded-lg px-2 py-1 overflow-hidden flex flex-col justify-center"
                        style={{ left: `${left}%`, width: `${width}%`, background: style.bg, border: `1px solid ${style.border}` }}
                        title={`${e.label} · ${e.start_time}–${e.end_time}${e.room ? ` · ${e.room}` : ''}`}
                      >
                        <p className="text-[10px] font-bold leading-tight truncate" style={{ color: style.text }}>{e.label}</p>
                        <p className="text-[9px] leading-tight truncate opacity-70" style={{ color: style.text }}>
                          {e.start_time}–{e.end_time}{e.group && e.group.toUpperCase() !== 'ALL' ? ` · ${e.group}` : ''}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
