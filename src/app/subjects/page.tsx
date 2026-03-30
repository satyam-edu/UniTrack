'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import ProtectedRoute from '@/components/ProtectedRoute'
import ProgressRing from '@/components/ProgressRing'

interface SubjectStats {
  attended: number
  total: number
  percentage: number
}

interface Subject {
  id: string
  subject_name: string
  subject_code: string
  faculty_name: string
  type: string
  weight_per_class: number // legacy
  stats: SubjectStats
}

// Helper to calculate hours difference
function getHoursDiff(start: string, end: string) {
  const d1 = new Date(`1970-01-01T${start}`)
  const d2 = new Date(`1970-01-01T${end}`)
  let diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60)
  if (diff <= 0) diff = 1 // fallback
  return diff
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [targetAttendance, setTargetAttendance] = useState<number>(75)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const loadSubjects = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return
    const userId = session.user.id

    // Fetch User Profile settings
    const { data: userData } = await supabase
      .from('users')
      .select('target_attendance, theory_mode, lab_mode')
      .eq('id', userId)
      .single()

    if (userData?.target_attendance) {
      setTargetAttendance(userData.target_attendance)
    }

    const theoryMode = userData?.theory_mode || 'class'
    const labMode = userData?.lab_mode || 'class'

    // Fetch Subjects first (no joins that could hide rows)
    const { data: rawSubjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (subjectsError) {
      setErrorMsg(`Failed to load subjects: ${subjectsError.message}`)
      setLoading(false)
      return
    }

    if (!rawSubjects || rawSubjects.length === 0) {
      setSubjects([])
      setLoading(false)
      return
    }

    // Fetch Timetable separately
    const { data: rawTimetable } = await supabase
      .from('timetable')
      .select('id, subject_id, start_time, end_time')
      .eq('user_id', userId)

    // Fetch Attendance separately
    const { data: rawAttendance } = await supabase
      .from('attendance')
      .select('timetable_id, status')
      .eq('user_id', userId)

    // Math Engine per subject (Join in JS)
    const computedSubjects = rawSubjects.map((subjectRow: any) => {
      let attended = 0
      let total = 0
      const mode = subjectRow.type === 'Theory' ? theoryMode : labMode

      const slots = rawTimetable?.filter((t) => t.subject_id === subjectRow.id) || []
      slots.forEach((slot: any) => {
        const pointValue = mode === 'hour' ? getHoursDiff(slot.start_time, slot.end_time) : 1
        const attendances = rawAttendance?.filter((a) => a.timetable_id === slot.id) || []
        
        attendances.forEach((record: any) => {
          if (record.status === 'Present') {
            attended += pointValue
            total += pointValue
          } else if (record.status === 'Absent') {
            total += pointValue
          }
          // 'Cancelled' does nothing to points
        })
      })

      const percentage = total > 0 ? (attended / total) * 100 : 0

      // Safeguard for JS floating point displaying
      const safeAttended = attended || 0
      const safeTotal = total || 0

      return {
        ...subjectRow,
        stats: {
          attended: Number(safeAttended.toFixed(1).replace(/\.0$/, '')),
          total: Number(safeTotal.toFixed(1).replace(/\.0$/, '')),
          percentage
        }
      } as Subject
    })

    setSubjects(computedSubjects)
    setErrorMsg(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSubjects()
  }, [loadSubjects])

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this subject? All associated timetable and attendance records will be removed.')) return

    setDeletingId(id)
    const { error } = await supabase.from('subjects').delete().eq('id', id)
    
    if (!error) {
      setSubjects((prev) => prev.filter((s) => s.id !== id))
    } else {
      alert('Failed to delete subject')
    }
    setDeletingId(null)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-text-muted text-sm">Loading subjects…</p>
          </div>
        </main>
        <BottomNav />
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <main className="flex-1 flex flex-col px-4 py-6 pb-24 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Subjects Dashboard</h1>
          <Link
            href="/subjects/add"
            className="bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg shadow-accent-glow flex items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </Link>
        </div>

        {errorMsg ? (
          <div className="bg-danger/10 border border-danger/20 rounded-2xl p-6 text-center shadow-sm mt-4">
            <h3 className="font-semibold text-danger mb-2">Error Loading Subjects</h3>
            <p className="text-danger/80 text-sm break-words">{errorMsg}</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center shadow-lg shadow-black/20 mt-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">No subjects found</h3>
            <p className="text-text-muted text-sm mb-4">
              Add your subjects to start tracking attendance.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {subjects.map((subject) => {
              const { attended, total, percentage } = subject.stats
              const isHealthy = percentage >= targetAttendance
              const noData = total === 0

              return (
                <div
                  key={subject.id}
                  className="bg-card-bg border border-card-border rounded-2xl p-5 shadow-lg shadow-black/20 flex flex-col gap-4 relative overflow-hidden"
                >
                  {/* Decorative background glow for health */}
                  {!noData && (
                    <div className={`absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-[0.15] ${isHealthy ? 'bg-success' : 'bg-danger'}`}></div>
                  )}

                  {/* Top: Info & Actions */}
                  <div className="flex items-start justify-between pr-[70px]">
                    <div>
                      <h3 className="text-xl font-bold truncate tracking-tight">{subject.subject_name}</h3>
                      <p className="text-sm text-text-muted mt-0.5">{subject.subject_code}</p>
                      
                      <div className="flex items-center gap-3 text-xs mt-2">
                        <span className="bg-background border border-card-border px-2 py-0.5 rounded font-medium text-text-secondary">
                          {subject.type}
                        </span>
                        {subject.faculty_name && (
                          <span className="text-text-muted flex items-center gap-1.5 truncate">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                            <span className="truncate max-w-[120px]">{subject.faculty_name}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Stats Dashboard */}
                  <div className="mt-2 flex items-center justify-between bg-background border border-card-border rounded-xl p-3 z-10">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Attendance</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-lg font-bold ${noData ? 'text-text-muted' : isHealthy ? 'text-success' : 'text-danger'}`}>
                          {attended}
                        </span>
                        <span className="text-text-muted text-sm">/</span>
                        <span className="text-sm font-semibold text-text-secondary">{total}</span>
                        <span className="text-xs text-text-muted ml-0.5">Attended</span>
                      </div>
                    </div>

                    <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                      {/* SVG Progress Ring */}
                      <ProgressRing
                        percentage={noData ? NaN : percentage}
                        target={targetAttendance}
                        size={48}
                        strokeWidth={4}
                      />
                    </div>
                  </div>

                  {/* Card Actions (Absolute top-right mapping) */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <Link
                      href={`/subjects/${subject.id}/edit`}
                      className="p-1.5 text-text-muted hover:text-accent bg-background/80 backdrop-blur rounded-lg transition-colors border border-transparent hover:border-accent/30"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </Link>
                    <button
                      onClick={() => handleDelete(subject.id)}
                      disabled={deletingId === subject.id}
                      className="p-1.5 text-text-muted hover:text-danger bg-background/80 backdrop-blur rounded-lg transition-colors border border-transparent hover:border-danger/30 disabled:opacity-50"
                    >
                      {deletingId === subject.id ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </ProtectedRoute>
  )
}
