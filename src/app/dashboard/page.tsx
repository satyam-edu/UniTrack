'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

// Duration of a slot in hours. Mirrors the logic on the home page.
function getHoursDiff(start: string, end: string) {
  const d1 = new Date(`1970-01-01T${start}`)
  const d2 = new Date(`1970-01-01T${end}`)
  let diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60)
  if (diff <= 0) diff = 1
  return diff
}

// Show whole numbers cleanly, otherwise round to one decimal.
function fmtCount(v: number) {
  return Number.isInteger(v) ? v.toString() : (Math.round(v * 10) / 10).toString()
}

interface Subject {
  id: string
  subject_name: string
  subject_code: string
  type: string
}

interface TimetableSlot {
  id: string
  start_time: string
  end_time: string
}

interface AttendanceRecord {
  subject_id: string
  timetable_id: string
  status: string
}

interface AttendanceStats {
  subject_id: string
  subject_name: string
  subject_code: string
  type: string
  total: number
  present: number
  absent: number
  cancelled: number
  percentage: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [stats, setStats] = useState<AttendanceStats[]>([])
  const [overallPercentage, setOverallPercentage] = useState(0)
  const [totalClasses, setTotalClasses] = useState(0)
  const [totalPresent, setTotalPresent] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/login')
      return
    }

    const userId = session.user.id

    // Fetch user name + counting modes
    const { data: userData } = await supabase
      .from('users')
      .select('name, theory_mode, lab_mode')
      .eq('id', userId)
      .single()

    if (userData) setUserName(userData.name.split(' ')[0])

    const theoryMode: 'class' | 'hour' = userData?.theory_mode === 'hour' ? 'hour' : 'class'
    const labMode: 'class' | 'hour' = userData?.lab_mode === 'hour' ? 'hour' : 'class'

    // Fetch subjects
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, subject_name, subject_code, type')
      .eq('user_id', userId)

    if (!subjects || subjects.length === 0) {
      setLoading(false)
      return
    }

    // Fetch timetable slots (for per-hour durations)
    const { data: timetable } = await supabase
      .from('timetable')
      .select('id, start_time, end_time')
      .eq('user_id', userId)

    const slotById = new Map<string, TimetableSlot>(
      (timetable || []).map((s: TimetableSlot) => [s.id, s])
    )

    // Fetch all attendance records
    const { data: attendance } = await supabase
      .from('attendance')
      .select('subject_id, timetable_id, status')
      .eq('user_id', userId)

    // Point value of a single record, respecting the subject's counting mode.
    const pointValue = (sub: Subject, rec: AttendanceRecord) => {
      const mode = sub.type === 'Theory' ? theoryMode : labMode
      if (mode !== 'hour') return 1
      const slot = slotById.get(rec.timetable_id)
      return slot ? getHoursDiff(slot.start_time, slot.end_time) : 1
    }

    // Calculate stats per subject
    const subjectStats: AttendanceStats[] = subjects.map((sub: Subject) => {
      const records = (attendance || []).filter(
        (a: AttendanceRecord) => a.subject_id === sub.id
      )

      let present = 0
      let absent = 0
      let cancelled = 0
      for (const rec of records) {
        if (rec.status === 'Present') present += pointValue(sub, rec)
        else if (rec.status === 'Absent') absent += pointValue(sub, rec)
        else if (rec.status === 'Cancelled') cancelled += 1
      }

      const total = present + absent // Cancelled classes don't count
      const percentage = total > 0 ? Math.round((present / total) * 100) : 100

      return {
        subject_id: sub.id,
        subject_name: sub.subject_name,
        subject_code: sub.subject_code,
        type: sub.type,
        total,
        present,
        absent,
        cancelled,
        percentage,
      }
    })

    setStats(subjectStats)

    // Overall stats
    const tTotal = subjectStats.reduce((sum, s) => sum + s.total, 0)
    const tPresent = subjectStats.reduce((sum, s) => sum + s.present, 0)
    setTotalClasses(tTotal)
    setTotalPresent(tPresent)
    setOverallPercentage(tTotal > 0 ? Math.round((tPresent / tTotal) * 100) : 100)

    setLoading(false)
  }, [router])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  function getPercentageColor(pct: number) {
    if (pct >= 75) return 'text-success'
    if (pct >= 50) return 'text-yellow-400'
    return 'text-danger'
  }

  function getPercentageBg(pct: number) {
    if (pct >= 75) return 'bg-success'
    if (pct >= 50) return 'bg-yellow-400'
    return 'bg-danger'
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-text-muted text-sm">Loading dashboard…</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="flex-1 flex flex-col px-4 pt-6 pb-24 max-w-lg mx-auto w-full">
        {/* Greeting */}
        <div className="mb-6">
          <p className="text-text-muted text-sm">Welcome back,</p>
          <h1 className="text-2xl font-bold tracking-tight">{userName || 'Student'} 👋</h1>
        </div>

        {/* Overall Stats Card */}
        <div className="bg-card-bg border border-card-border rounded-2xl p-5 shadow-lg shadow-black/20 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
              Overall Attendance
            </h2>
            <span className={`text-2xl font-bold ${getPercentageColor(overallPercentage)}`}>
              {overallPercentage}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 bg-input-bg rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getPercentageBg(overallPercentage)}`}
              style={{ width: `${overallPercentage}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-input-bg rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{fmtCount(totalPresent)}</p>
              <p className="text-xs text-text-muted">Hours Present</p>
            </div>
            <div className="bg-input-bg rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{fmtCount(totalClasses)}</p>
              <p className="text-xs text-text-muted">Total Hours</p>
            </div>
          </div>
        </div>

        {/* Subject-wise Breakdown */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Subject Breakdown
          </h2>
          {stats.length > 0 && (
            <Link href="/subjects" className="text-xs text-accent font-medium">
              View All →
            </Link>
          )}
        </div>

        {stats.length === 0 ? (
          <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center shadow-lg shadow-black/20">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">No subjects yet</h3>
            <p className="text-text-muted text-sm mb-4">
              Add your subjects to start tracking attendance
            </p>
            <Link
              href="/subjects/add"
              className="inline-block bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-accent-glow"
            >
              Add Subject
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.map((subject) => (
              <div
                key={subject.subject_id}
                className="bg-card-bg border border-card-border rounded-2xl p-4 shadow-lg shadow-black/20"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate">{subject.subject_name}</h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      {subject.subject_code} · {subject.type}
                    </p>
                  </div>
                  <span
                    className={`text-lg font-bold ml-3 ${getPercentageColor(subject.percentage)}`}
                  >
                    {subject.percentage}%
                  </span>
                </div>

                {/* Mini progress bar */}
                <div className="w-full h-1.5 bg-input-bg rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getPercentageBg(subject.percentage)}`}
                    style={{ width: `${subject.percentage}%` }}
                  />
                </div>

                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span>
                    <span className="text-success font-medium">{fmtCount(subject.present)}</span> present
                  </span>
                  <span>
                    <span className="text-danger font-medium">{fmtCount(subject.absent)}</span> absent
                  </span>
                  {subject.cancelled > 0 && (
                    <span>
                      <span className="text-yellow-400 font-medium">{fmtCount(subject.cancelled)}</span> cancelled
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </>
  )
}
