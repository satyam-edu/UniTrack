'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

interface Subject {
  id: string
  subject_name: string
  subject_code: string
  type: string
  weight_per_class: number
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

    // Fetch user name
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single()

    if (userData) setUserName(userData.name.split(' ')[0])

    // Fetch subjects
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, subject_name, subject_code, type, weight_per_class')
      .eq('user_id', userId)

    if (!subjects || subjects.length === 0) {
      setLoading(false)
      return
    }

    // Fetch all attendance records
    const { data: attendance } = await supabase
      .from('attendance')
      .select('subject_id, status')
      .eq('user_id', userId)

    // Calculate stats per subject
    const subjectStats: AttendanceStats[] = subjects.map((sub: Subject) => {
      const records = (attendance || []).filter(
        (a: { subject_id: string; status: string }) => a.subject_id === sub.id
      )
      const present = records.filter(
        (r: { status: string }) => r.status === 'Present'
      ).length
      const absent = records.filter(
        (r: { status: string }) => r.status === 'Absent'
      ).length
      const cancelled = records.filter(
        (r: { status: string }) => r.status === 'Cancelled'
      ).length
      const total = present + absent // Cancelled classes don't count
      const percentage = total > 0 ? Math.round((present / total) * 100) : 100

      return {
        subject_id: sub.id,
        subject_name: sub.subject_name,
        subject_code: sub.subject_code,
        type: sub.type,
        total: total * sub.weight_per_class,
        present: present * sub.weight_per_class,
        absent: absent * sub.weight_per_class,
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
              <p className="text-lg font-bold">{totalPresent}</p>
              <p className="text-xs text-text-muted">Hours Present</p>
            </div>
            <div className="bg-input-bg rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{totalClasses}</p>
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
                    <span className="text-success font-medium">{subject.present}</span> present
                  </span>
                  <span>
                    <span className="text-danger font-medium">{subject.absent}</span> absent
                  </span>
                  {subject.cancelled > 0 && (
                    <span>
                      <span className="text-yellow-400 font-medium">{subject.cancelled}</span> cancelled
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
