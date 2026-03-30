'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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

interface UserProfile {
  id: string
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

// Helper to calculate hours difference
function getHoursDiff(start: string, end: string) {
  const d1 = new Date(`1970-01-01T${start}`)
  const d2 = new Date(`1970-01-01T${end}`)
  let diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60)
  if (diff <= 0) diff = 1 // fallback
  return diff
}

export default function HomePage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Calendar State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Start on Monday
  )

  const [slotsToday, setSlotsToday] = useState<SlotWithAttendance[]>([])
  const [globalAttended, setGlobalAttended] = useState(0)
  const [globalTotal, setGlobalTotal] = useState(0)

  const [presentCount, setPresentCount] = useState(0)
  const [absentCount, setAbsentCount] = useState(0)
  const [cancelledCount, setCancelledCount] = useState(0)

  // Reference data to calculate points globally
  const [allTimetable, setAllTimetable] = useState<TimetableSlot[]>([])
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([])

  // 1. Initial Data Load (User, Timetable, All Attendance)
  const loadInitialData = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    const userId = session.user.id

    // Fetch User Profile
    const { data: userData } = await supabase
      .from('users')
      .select('id, target_attendance, theory_mode, lab_mode')
      .eq('id', userId)
      .single()

    if (userData) setUser(userData)

    // Fetch Full Timetable
    const { data: timetableData } = await supabase
      .from('timetable')
      .select('id, subject_id, day_of_week, start_time, end_time, subject:subjects(subject_name, subject_code, type)')
      .eq('user_id', userId)

    if (timetableData) setAllTimetable(timetableData as unknown as TimetableSlot[])

    // Fetch All Attendance Records
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('id, timetable_id, date, status')
      .eq('user_id', userId)

    if (attendanceData) setAllAttendance(attendanceData as AttendanceRecord[])

    setLoading(false)
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // 2. Compute Global Stats whenever attendance or timetable changes
  useEffect(() => {
    if (!user || allTimetable.length === 0 || allAttendance.length === 0) {
      setGlobalAttended(0)
      setGlobalTotal(0)
      setPresentCount(0)
      setAbsentCount(0)
      setCancelledCount(0)
      return
    }

    let attendedVal = 0
    let totalVal = 0
    let pres = 0
    let abs = 0
    let canc = 0

    allAttendance.forEach((record) => {
      // Find the slot for this record to know its type & time
      const slot = allTimetable.find((s) => s.id === record.timetable_id)
      if (!slot) return

      const mode = slot.subject.type === 'Theory' ? user.theory_mode : user.lab_mode
      const pointValue = mode === 'hour' ? getHoursDiff(slot.start_time, slot.end_time) : 1

      if (record.status === 'Present') {
        attendedVal += pointValue
        totalVal += pointValue
        pres++
      } else if (record.status === 'Absent') {
        totalVal += pointValue
        abs++
      } else if (record.status === 'Cancelled') {
        canc++
      }
    })

    setGlobalAttended(attendedVal)
    setGlobalTotal(totalVal)
    setPresentCount(pres)
    setAbsentCount(abs)
    setCancelledCount(canc)
  }, [user, allTimetable, allAttendance])

  // 3. Compute Schedule for Selected Date
  useEffect(() => {
    if (!user || allTimetable.length === 0) {
      setSlotsToday([])
      return
    }

    const dayName = format(selectedDate, 'EEEE') // e.g., 'Monday'
    const dateStr = format(selectedDate, 'yyyy-MM-dd')

    // Filter timetable for this day of week
    const slotsForDay = allTimetable
      .filter((slot) => slot.day_of_week === dayName)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

    // Map over slots to join with attendance and calculate exact point value
    const merged: SlotWithAttendance[] = slotsForDay.map((slot) => {
      const record = allAttendance.find(
        (a) => a.timetable_id === slot.id && a.date === dateStr
      )
      const mode = slot.subject.type === 'Theory' ? user.theory_mode : user.lab_mode
      const pointValue = mode === 'hour' ? getHoursDiff(slot.start_time, slot.end_time) : 1

      return {
        ...slot,
        attendanceRecord: record,
        pointValue,
      }
    })

    setSlotsToday(merged)
  }, [selectedDate, allTimetable, allAttendance, user])

  // 4. Handle Attendance Marking (Optimistic UI)
  async function handleMarkAttendance(
    slot: SlotWithAttendance,
    status: 'Present' | 'Absent' | 'Cancelled'
  ) {
    if (!user) return

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const existingRecord = slot.attendanceRecord

    // --- Optimistic Update ---
    const newRecord: AttendanceRecord = {
      id: existingRecord?.id || crypto.randomUUID(), // fake ID if new
      timetable_id: slot.id,
      subject_id: slot.subject_id,
      date: dateStr,
      status,
    }

    setAllAttendance((prev) => {
      if (existingRecord) {
        return prev.map((a) => (a.id === existingRecord.id ? newRecord : a))
      }
      return [...prev, newRecord]
    })

    // --- Database Update ---
    try {
      if (existingRecord) {
        const { error } = await supabase
          .from('attendance')
          .update({ status })
          .eq('id', existingRecord.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('attendance')
          .insert({
            user_id: user.id,
            timetable_id: slot.id,
            subject_id: slot.subject_id,
            date: dateStr,
            status,
          })
          .select()
          .single()

        if (error) throw error
        
        // Replace fake ID with real DB ID silently
        if (data) {
          setAllAttendance((prev) =>
            prev.map((a) => (a.id === newRecord.id ? data : a))
          )
        }
      }
    } catch (err: any) {
      console.error('Failed to mark attendance:', err)
      alert(`Failed to save attendance: ${err.message || 'Unknown error'}`)
      
      // Revert Optimistic UI
      setAllAttendance((prev) => {
        if (existingRecord) {
          // Revert back to the old record
          return prev.map((a) => (a.id === newRecord.id ? existingRecord : a))
        }
        // It was a new record, just remove it entirely
        return prev.filter((a) => a.id !== newRecord.id)
      })
    }
  }

  // Generate calendar days for the current week row
  const weekDays = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => addDays(currentWeekStart, i))
  }, [currentWeekStart])

  function formatTime(timeStr: string) {
    return new Date(`1970-01-01T${timeStr}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <main className="flex-1 flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
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
      <main className="flex-1 flex flex-col px-4 py-6 pb-24 max-w-lg mx-auto w-full">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <span className="text-sm font-medium bg-secondary text-text-secondary px-3 py-1.5 rounded-full">
            Today: {format(new Date(), 'MMM d')}
          </span>
        </div>

        {/* 1. Analytics Card */}
        <div className="bg-card-bg border border-card-border rounded-2xl p-6 shadow-lg shadow-black/20 flex items-center gap-6 mb-8 relative overflow-hidden">
          {/* Decorative background glow */}
          <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-20 ${isHealthy ? 'bg-success' : 'bg-danger'}`}></div>
          
          <div className="relative w-28 h-28 flex-shrink-0">
            {/* SVG Ring */}
            <ProgressRing
              percentage={globalTotal > 0 ? attendancePercentage : NaN}
              target={target}
              size={112}
              strokeWidth={8}
            />
          </div>

          <div className="flex flex-col z-10 w-full pl-2">
            <h2 className="text-lg font-bold mb-1">Overall Attendance</h2>
            
            <div className="text-xs mb-3 flex items-center gap-1.5 flex-wrap">
              <span className="bg-success/10 text-success px-1.5 py-0.5 rounded font-medium">Present: {presentCount}</span>
              <span className="bg-danger/10 text-danger px-1.5 py-0.5 rounded font-medium">Absent: {absentCount}</span>
              <span className="bg-card-border text-foreground px-1.5 py-0.5 rounded font-medium">Cancelled: {cancelledCount}</span>
            </div>

            <div className="inline-flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-card-border w-fit text-sm">
              <span className={isHealthy ? 'text-success font-bold' : 'text-danger font-bold'}>
                {globalAttended.toFixed(1).replace(/\.0$/, '')}
              </span>
              <span className="text-text-muted">/</span>
              <span className="font-semibold text-text-secondary">
                {globalTotal.toFixed(1).replace(/\.0$/, '')} Attended
              </span>
            </div>
          </div>
        </div>

        {/* 2. Calendar Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-secondary">
              {format(currentWeekStart, 'MMMM yyyy')}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 2))}
                className="p-1.5 bg-card-bg border border-card-border rounded-lg hover:border-text-muted transition-colors cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setSelectedDate(new Date())
                  setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
                }}
                className="text-xs font-semibold bg-accent/10 text-accent px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 2))}
                className="p-1.5 bg-card-bg border border-card-border rounded-lg hover:border-text-muted transition-colors cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const selected = isSameDay(day, selectedDate)
              const today = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center py-2.5 rounded-xl transition-all cursor-pointer ${
                    selected
                      ? 'bg-accent text-white shadow-md shadow-accent/30'
                      : today
                      ? 'bg-card-bg border border-accent/50 text-foreground'
                      : 'bg-card-bg border border-card-border text-text-secondary hover:border-text-muted'
                  }`}
                >
                  <span className={`text-[10px] font-medium mb-1 ${selected ? 'text-white/80' : 'text-text-muted'}`}>
                    {format(day, 'EEE')}
                  </span>
                  <span className="text-base font-bold">{format(day, 'd')}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 3. Schedule for Selected Date */}
        <div>
          <h3 className="font-semibold text-text-secondary mb-4 flex items-center gap-2">
            Schedule for {format(selectedDate, 'EEEE')}
            <span className="text-xs font-normal text-text-muted tracking-normal bg-card-bg px-2 py-0.5 rounded-md border border-card-border">
              {slotsToday.length} classes
            </span>
          </h3>

          {slotsToday.length === 0 ? (
            <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center border-dashed">
              <p className="text-text-muted text-sm">No classes scheduled for this day.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {slotsToday.map((slot) => {
                const status = slot.attendanceRecord?.status // undefined if new
                
                return (
                  <div
                    key={slot.id}
                    className={`bg-card-bg border rounded-2xl p-4 shadow-sm flex flex-col gap-4 transition-all ${
                      status === 'Present'
                        ? 'border-success/50 bg-success/5 shadow-success/10'
                        : status === 'Absent'
                        ? 'border-danger/50 bg-danger/5 shadow-danger/10'
                        : status === 'Cancelled'
                        ? 'border-card-border bg-background/50 opacity-60'
                        : 'border-card-border hover:border-text-muted'
                    }`}
                  >
                    {/* Top Row: Time & Info */}
                    <div className="flex gap-4 items-start pr-2">
                      <div className="flex flex-col items-center justify-center min-w-[70px] pt-0.5">
                        <span className="text-sm font-bold">{formatTime(slot.start_time)}</span>
                        <span className="text-[10px] text-text-muted my-0.5">to</span>
                        <span className="text-xs font-medium text-text-secondary">{formatTime(slot.end_time)}</span>
                      </div>
                      
                      <div className="flex-1 border-l border-card-border/50 pl-4">
                        <h4 className="font-bold text-base mb-1">{slot.subject.subject_name}</h4>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="bg-background border border-card-border px-2 py-0.5 rounded font-medium text-text-secondary">
                            {slot.subject.type}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Action Toggles */}
                    <div className="bg-background rounded-xl p-1 flex items-center border border-card-border">
                      <button
                        onClick={() => handleMarkAttendance(slot, 'Present')}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                          status === 'Present'
                            ? 'bg-success text-white shadow-md shadow-success/20'
                            : 'text-text-muted hover:text-success hover:bg-success/10'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => handleMarkAttendance(slot, 'Absent')}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                          status === 'Absent'
                            ? 'bg-danger text-white shadow-md shadow-danger/20'
                            : 'text-text-muted hover:text-danger hover:bg-danger/10'
                        }`}
                      >
                        Absent
                      </button>
                      <button
                        onClick={() => handleMarkAttendance(slot, 'Cancelled')}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                          status === 'Cancelled'
                            ? 'bg-card-border text-foreground shadow-md'
                            : 'text-text-muted hover:text-foreground hover:bg-card-border'
                        }`}
                      >
                        Cancelled
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </ProtectedRoute>
  )
}
