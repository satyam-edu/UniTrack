'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import BottomNav from '@/components/BottomNav'
import ProgressRing from '@/components/ProgressRing'
import {
  format,
  startOfWeek,
  addDays,
  subWeeks,
  addWeeks,
  isSameDay,
  isToday,
} from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  name: string
  target_attendance: number
  theory_mode: 'class' | 'hour'
  lab_mode: 'class' | 'hour'
}

interface TimetableSlot {
  id: string
  subject_id: string
  day_of_week: string
  start_time: string
  end_time: string
  subject: {
    subject_name: string
    subject_code: string
    type: string
  }
}

interface AttendanceRecord {
  id: string
  timetable_id: string
  subject_id: string
  date: string
  status: 'Present' | 'Absent' | 'Cancelled'
}

interface SlotWithAttendance extends TimetableSlot {
  attendanceRecord?: AttendanceRecord
  pointValue: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHoursDiff(start: string, end: string) {
  const d1 = new Date(`1970-01-01T${start}`)
  const d2 = new Date(`1970-01-01T${end}`)
  let diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60)
  if (diff <= 0) diff = 1
  return diff
}

function formatTime(timeStr: string) {
  return new Date(`1970-01-01T${timeStr}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// ─── Animation variants ───────────────────────────────────────────────────────

const pageVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
}

const attendanceCardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, damping: 25, delay: 0.04 },
  },
}

const calendarVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 25, stiffness: 300, delay: 0.08 },
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )

  const [slotsToday, setSlotsToday] = useState<SlotWithAttendance[]>([])
  const [globalAttended, setGlobalAttended] = useState(0)
  const [globalTotal, setGlobalTotal] = useState(0)
  const [presentCount, setPresentCount] = useState(0)
  const [absentCount, setAbsentCount] = useState(0)
  const [scheduleOpen, setScheduleOpen] = useState(true)

  const [allTimetable, setAllTimetable] = useState<TimetableSlot[]>([])
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([])

  // 1. Initial load
  const loadInitialData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const userId = session.user.id

    const { data: userData } = await supabase
      .from('users')
      .select('id, name, target_attendance, theory_mode, lab_mode')
      .eq('id', userId)
      .single()

    if (userData) setUser(userData)

    const { data: timetableData } = await supabase
      .from('timetable')
      .select('id, subject_id, day_of_week, start_time, end_time, subject:subjects(subject_name, subject_code, type)')
      .eq('user_id', userId)

    if (timetableData) setAllTimetable(timetableData as unknown as TimetableSlot[])

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('id, timetable_id, date, status')
      .eq('user_id', userId)

    if (attendanceData) setAllAttendance(attendanceData as AttendanceRecord[])

    setLoading(false)
  }, [])

  useEffect(() => { loadInitialData() }, [loadInitialData])

  // 2. Global stats
  useEffect(() => {
    if (!user || allTimetable.length === 0 || allAttendance.length === 0) {
      setGlobalAttended(0); setGlobalTotal(0)
      setPresentCount(0); setAbsentCount(0)
      return
    }
    let attendedVal = 0, totalVal = 0, pres = 0, abs = 0
    allAttendance.forEach((record) => {
      const slot = allTimetable.find((s) => s.id === record.timetable_id)
      if (!slot) return
      const mode = slot.subject.type === 'Theory' ? user.theory_mode : user.lab_mode
      const pv = mode === 'hour' ? getHoursDiff(slot.start_time, slot.end_time) : 1
      if (record.status === 'Present') { attendedVal += pv; totalVal += pv; pres++ }
      else if (record.status === 'Absent') { totalVal += pv; abs++ }
    })
    setGlobalAttended(attendedVal); setGlobalTotal(totalVal)
    setPresentCount(pres); setAbsentCount(abs)
  }, [user, allTimetable, allAttendance])

  // 3. Daily schedule
  useEffect(() => {
    if (!user || allTimetable.length === 0) { setSlotsToday([]); return }
    const dayName = format(selectedDate, 'EEEE')
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const slotsForDay = allTimetable
      .filter((s) => s.day_of_week === dayName)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
    const merged: SlotWithAttendance[] = slotsForDay.map((slot) => {
      const record = allAttendance.find((a) => a.timetable_id === slot.id && a.date === dateStr)
      const mode = slot.subject.type === 'Theory' ? user.theory_mode : user.lab_mode
      return { ...slot, attendanceRecord: record, pointValue: mode === 'hour' ? getHoursDiff(slot.start_time, slot.end_time) : 1 }
    })
    setSlotsToday(merged)
  }, [selectedDate, allTimetable, allAttendance, user])

  // 4. Optimistic attendance marking
  async function handleMarkAttendance(slot: SlotWithAttendance, status: 'Present' | 'Absent' | 'Cancelled') {
    if (!user) return
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const existingRecord = slot.attendanceRecord
    const newRecord: AttendanceRecord = {
      id: existingRecord?.id || crypto.randomUUID(),
      timetable_id: slot.id,
      subject_id: slot.subject_id,
      date: dateStr,
      status,
    }
    setAllAttendance((prev) =>
      existingRecord ? prev.map((a) => (a.id === existingRecord.id ? newRecord : a)) : [...prev, newRecord]
    )
    try {
      if (existingRecord) {
        const { error } = await supabase.from('attendance').update({ status }).eq('id', existingRecord.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('attendance').insert({ user_id: user.id, timetable_id: slot.id, subject_id: slot.subject_id, date: dateStr, status })
          .select().single()
        if (error) throw error
        if (data) setAllAttendance((prev) => prev.map((a) => (a.id === newRecord.id ? data : a)))
      }
    } catch (err: any) {
      console.error('Failed to mark attendance:', err)
      setAllAttendance((prev) =>
        existingRecord
          ? prev.map((a) => (a.id === newRecord.id ? existingRecord : a))
          : prev.filter((a) => a.id !== newRecord.id)
      )
    }
  }

  // 5. Undo / clear attendance for a slot
  async function handleUndoAttendance(slot: SlotWithAttendance) {
    const existingRecord = slot.attendanceRecord
    if (!existingRecord) return
    // Optimistic remove
    setAllAttendance((prev) => prev.filter((a) => a.id !== existingRecord.id))
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', existingRecord.id)
      if (error) throw error
    } catch (err: any) {
      console.error('Failed to undo attendance:', err)
      // Rollback
      setAllAttendance((prev) => [...prev, existingRecord])
    }
  }

  const weekDays = useMemo(() =>
    Array.from({ length: 14 }).map((_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  )

  // ─── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <ProtectedRoute>
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
            </div>
            <p className="text-sm text-text-muted">Loading your dashboard…</p>
          </div>
        </main>
        <BottomNav />
      </ProtectedRoute>
    )
  }

  const attendancePercentage = globalTotal > 0 ? (globalAttended / globalTotal) * 100 : 0
  const target = user?.target_attendance || 75
  const isHealthy = attendancePercentage >= target

  return (
    <ProtectedRoute>
      <motion.main
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col px-4 py-6 pb-32 max-w-lg mx-auto w-full"
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-text-muted font-medium">Welcome back,</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              {user?.name ? user.name.split(' ')[0] : 'Student'}
            </h1>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
            style={{
              background: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderColor: 'rgba(255,255,255,0.60)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <span className="text-xs font-semibold text-foreground">UniTrack</span>
          </div>
        </div>

        {/* ── 1. Attendance Card ────────────────────────────────────────── */}
        <motion.div
          variants={attendanceCardVariants}
          initial="hidden"
          animate="visible"
          className="relative rounded-3xl overflow-hidden mb-6"
          style={{
            background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
            boxShadow: '0 12px 40px rgba(20,184,166,0.28)',
          }}
        >
          {/* Decorative blob */}
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.10)', filter: 'blur(24px)' }} />

          <div className="relative p-5 flex items-center gap-5">
            {/* Ring */}
            <div className="flex-shrink-0">
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* White-tinted ring background */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 112 112">
                  <circle cx="56" cy="56" r="44" stroke="rgba(255,255,255,0.20)" strokeWidth="8" fill="none" />
                  <circle
                    cx="56" cy="56" r="44"
                    stroke="white"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={2 * Math.PI * 44}
                    strokeDashoffset={2 * Math.PI * 44 * (1 - (globalTotal > 0 ? attendancePercentage / 100 : 0))}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.25,0.46,0.45,0.94)' }}
                  />
                </svg>
                <div className="flex flex-col items-center justify-center text-white">
                  <span className="text-3xl font-extrabold leading-none">
                    {globalTotal > 0 ? Math.round(attendancePercentage) : '--'}
                  </span>
                  <span className="text-[10px] font-semibold tracking-widest opacity-80 mt-0.5">
                    PERCENT
                  </span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 text-white">
              <h2 className="text-base font-bold mb-3 opacity-95">Overall Attendance</h2>

              <div className="flex gap-2 mb-3">
                {/* Present pill */}
                <div
                  className="flex-1 rounded-xl px-3 py-2 text-center"
                  style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
                >
                  <p className="text-[10px] font-semibold tracking-widest opacity-70 mb-0.5">PRESENT</p>
                  <p className="text-xl font-extrabold">{presentCount}</p>
                </div>
                {/* Absent pill */}
                <div
                  className="flex-1 rounded-xl px-3 py-2 text-center"
                  style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
                >
                  <p className="text-[10px] font-semibold tracking-widest opacity-70 mb-0.5">ABSENT</p>
                  <p className="text-xl font-extrabold">{absentCount}</p>
                </div>
              </div>

              {/* Target row */}
              <div className="flex items-center gap-1.5 opacity-90">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-300">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                <span className="text-xs font-semibold">Target: {target}%</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── 2. Calendar ──────────────────────────────────────────────────── */}
        <motion.div
          variants={calendarVariants}
          initial="hidden"
          animate="visible"
          className="rounded-3xl mb-6 bg-white p-5 border border-slate-200/60"
        >
          {/* Month header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">
              {format(currentWeekStart, 'MMMM yyyy')}
            </h3>
            <div className="flex items-center gap-1.5">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 2))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => {
                  setSelectedDate(new Date())
                  setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
                }}
                className="px-3 py-1 rounded-xl text-sm font-medium cursor-pointer transition-colors"
                style={{
                  background: 'rgba(26,158,160,0.10)',
                  color: '#1a9ea0',
                }}
              >
                Today
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 2))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </motion.button>
            </div>
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const selected = isSameDay(day, selectedDate)
              const hasAttendance = allAttendance.some(
                (a) => a.date === format(day, 'yyyy-MM-dd') && a.status !== 'Cancelled'
              )
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const isFuture = day > today

              return (
                <motion.button
                  key={day.toISOString()}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center py-2.5 rounded-full transition-all cursor-pointer ${isFuture && !selected ? 'opacity-50' : ''}`}
                  style={
                    selected
                      ? { background: '#14b8a6', color: 'white', boxShadow: '0 4px 14px rgba(20,184,166,0.30)' }
                      : { background: 'transparent', color: '#1e293b' }
                  }
                >
                  <span
                    className="text-[9px] font-semibold mb-1 tracking-wide"
                    style={{ opacity: selected ? 0.8 : 0.5 }}
                  >
                    {format(day, 'EEEEE')}
                  </span>
                  <span className="text-sm font-bold leading-none">
                    {format(day, 'd')}
                  </span>
                  {/* The Attendance Dot */}
                  {hasAttendance && (
                    <div className="w-1.5 h-1.5 rounded-full mt-1" style={{ background: selected ? 'white' : '#14b8a6' }} />
                  )}
                </motion.button>
              )
            })}
          </div>
        </motion.div>

        {/* ── 3. Schedule ───────────────────────────────────────────────────── */}
        <div>
          {/* Clickable header row */}
          <button
            onClick={() => setScheduleOpen((o) => !o)}
            className="w-full flex items-center justify-between mb-4 px-0.5 cursor-pointer group"
          >
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {format(selectedDate, 'EEEE')}&apos;s Classes
            </h2>
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(20,184,166,0.08)',
                  border: '1px solid rgba(20,184,166,0.18)',
                }}
              >
                {slotsToday.length} {slotsToday.length === 1 ? 'class' : 'classes'}
              </span>
              <motion.div
                animate={{ rotate: scheduleOpen ? 0 : -90 }}
                transition={{ type: 'spring' as const, damping: 22, stiffness: 220 }}
                className="text-text-muted group-hover:text-accent transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </motion.div>
            </div>
          </button>

          <AnimatePresence mode="wait">
            {slotsToday.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-3xl p-8 text-center"
                style={{
                  background: 'rgba(255,255,255,0.55)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1.5px dashed rgba(26,158,160,0.25)',
                }}
              >
                <div
                  className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-3"
                  style={{ background: 'rgba(26,158,160,0.10)' }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-accent">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <p className="text-sm text-text-muted">No classes scheduled for this day.</p>
              </motion.div>
            ) : (
              /* Collapsible wrapper */
              <motion.div
                key="slots-outer"
                initial={false}
                animate={scheduleOpen
                  ? { height: 'auto', opacity: 1 }
                  : { height: 0, opacity: 0 }
                }
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="space-y-3 pb-0.5">
                  {slotsToday.map((slot, i) => {
                    const status = slot.attendanceRecord?.status
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const isFutureDate = selectedDate > today

                    /* ── Card tints per-status ── */
                    const cardBorder =
                      status === 'Present' ? 'rgba(34, 197, 94,  0.45)' :
                        status === 'Absent' ? 'rgba(239, 68, 68,  0.40)' :
                          status === 'Cancelled' ? 'rgba(100,116,139,  0.25)' :
                            'rgba(255,255,255,  0.55)'

                    const cardBg =
                      status === 'Present' ? 'rgba(34, 197, 94,  0.08)' :
                        status === 'Absent' ? 'rgba(239, 68, 68,  0.07)' :
                          status === 'Cancelled' ? 'rgba(100,116,139,  0.05)' :
                            'rgba(255,255,255,  0.78)'

                    return (
                      <motion.div
                        key={slot.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: status === 'Cancelled' ? 0.6 : 1, y: 0 }}
                        transition={{ delay: i * 0.06, type: 'spring' as const, damping: 25 }}
                        className="rounded-3xl overflow-hidden bg-white border border-slate-200/60"
                        style={{
                          borderLeft:
                            status === 'Present'   ? '4px solid #22c55e' :
                            status === 'Absent'    ? '4px solid #ef4444' :
                            status === 'Cancelled' ? '4px solid #cbd5e1' :
                            '4px solid #e2e8f0',
                        }}
                      >
                        {/* Card Body */}
                        <div className="px-4 pt-4 pb-3 flex gap-4 items-start">
                          {/* Time column */}
                          <div className="flex flex-col items-end min-w-[72px] pt-0.5 flex-shrink-0">
                            <span className="text-sm font-bold text-foreground">{formatTime(slot.start_time)}</span>
                            <div className="my-1 w-px h-4 self-end" style={{ background: 'rgba(26,158,160,0.25)' }} />
                            <span className="text-xs font-medium text-text-muted">{formatTime(slot.end_time)}</span>
                          </div>

                          {/* Vertical divider */}
                          <div className="self-stretch w-px flex-shrink-0 mt-0.5" style={{ background: 'rgba(26,158,160,0.20)' }} />

                          {/* Subject info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base text-foreground leading-snug mb-1.5">
                              {slot.subject.subject_name}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-xs font-bold px-2 py-0.5 rounded-md"
                                style={{ background: 'rgba(26,158,160,0.12)', color: '#1a9ea0', border: '1px solid rgba(26,158,160,0.20)' }}
                              >
                                {slot.subject.subject_code}
                              </span>
                              <span className="text-xs text-text-muted font-medium">{slot.subject.type}</span>
                            </div>
                          </div>

                          {/* Undo button — only when a status is selected */}
                          <AnimatePresence>
                            {status && !isFutureDate && (
                              <button
                                key="undo"
                                onClick={() => handleUndoAttendance(slot)}
                                aria-label="Undo attendance"
                                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-all duration-200 active:scale-95"
                                style={{
                                  background:
                                    status === 'Present' ? 'rgba(34,197,94,0.15)' :
                                      status === 'Absent' ? 'rgba(239,68,68,0.15)' :
                                        'rgba(100,116,139,0.15)',
                                  color:
                                    status === 'Present' ? '#16a34a' :
                                      status === 'Absent' ? '#dc2626' :
                                        '#475569',
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Action row */}
                        <div
                          className={`mx-3 mb-3 rounded-2xl p-1 grid grid-cols-3 gap-1 ${isFutureDate ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                        >
                          {(
                            [
                              { label: 'Present', value: 'Present' as const, activeColor: '#16a34a', activeShadow: 'rgba(22,163,74,0.28)' },
                              { label: 'Absent', value: 'Absent' as const, activeColor: '#dc2626', activeShadow: 'rgba(220,38,38,0.28)' },
                              { label: 'Cancelled', value: 'Cancelled' as const, activeColor: '#475569', activeShadow: 'rgba(71,85,105,0.20)' },
                            ] as const
                          ).map(({ label, value, activeColor, activeShadow }) => {
                            const isActive = status === value
                            return (
                              <button
                                key={value}
                                onClick={() => handleMarkAttendance(slot, value)}
                                disabled={isFutureDate}
                                className="py-2.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer"
                                style={
                                  isActive
                                    ? { background: activeColor, color: 'white', boxShadow: `0 2px 10px ${activeShadow}` }
                                    : { background: 'transparent', color: '#94a3b8' }
                                }
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.main>
      <BottomNav />
    </ProtectedRoute>
  )
}
