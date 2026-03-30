'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import ProtectedRoute from '@/components/ProtectedRoute'

interface TimetableSlot {
  id: string
  subject_id: string
  day_of_week: string
  start_time: string
  end_time: string
  room_location?: string | null
  subject: {
    subject_name: string
    subject_code: string
    type: string
  }
}

export default function TimetablePage() {
  const [schedule, setSchedule] = useState<Record<string, TimetableSlot[]>>({})
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string>('Monday')

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  const loadTimetable = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    const { data, error } = await supabase
      .from('timetable')
      .select('id, subject_id, day_of_week, start_time, end_time, room_location, subject:subjects(subject_name, subject_code, type)')
      .eq('user_id', session.user.id)
      .order('start_time', { ascending: true }) // Initial sort by time

    if (error || !data) {
      setLoading(false)
      return
    }

    // Group by day of week
    const grouped: Record<string, TimetableSlot[]> = {}
    data.forEach((slot: any) => {
      if (!grouped[slot.day_of_week]) {
        grouped[slot.day_of_week] = []
      }
      grouped[slot.day_of_week].push(slot as TimetableSlot)
    })

    setSchedule(grouped)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadTimetable()
  }, [loadTimetable])

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this class slot?')) return

    setDeletingId(id)
    const { error } = await supabase.from('timetable').delete().eq('id', id)
    
    if (!error) {
      // Find the day and remove the slot locally
      setSchedule((prev) => {
        const next = { ...prev }
        for (const day of Object.keys(next)) {
          next[day] = next[day].filter((s) => s.id !== id)
          if (next[day].length === 0) delete next[day] // Cleanup empty days
        }
        return next
      })
    }
    setDeletingId(null)
  }

  function formatTime(timeStr: string) {
    return new Date(`1970-01-01T${timeStr}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-text-muted text-sm">Loading timetable…</p>
        </div>
        <BottomNav />
      </main>
    )
  }

  const hasSlots = Object.keys(schedule).length > 0
  const renderedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <ProtectedRoute>
      <main className="flex-1 flex flex-col px-4 py-6 pb-24 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Timetable</h1>
          <Link
            href="/timetable/add"
            className="bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg shadow-accent-glow flex items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </Link>
        </div>

        {/* Horizontal Day Selector */}
        <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {renderedDays.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`whitespace-nowrap px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex-[0_0_auto] ${
                selectedDay === day
                  ? 'bg-accent text-white shadow-lg shadow-accent-glow'
                  : 'bg-card-bg border border-card-border text-text-secondary hover:text-foreground'
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        {!hasSlots && schedule[selectedDay] === undefined ? (
          <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center shadow-lg shadow-black/20 mt-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">Your timetable is empty for this day</h3>
            <p className="text-text-muted text-sm mb-4">
              Add class slots to map out your weekly schedule.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3 mt-4">
              {!schedule[selectedDay] || schedule[selectedDay].length === 0 ? (
                <div className="text-center py-10 bg-card-bg/50 border border-card-border/50 rounded-2xl border-dashed">
                  <p className="text-text-muted">No classes scheduled for {selectedDay}.</p>
                </div>
              ) : (
                schedule[selectedDay].map((slot) => (
                  <div
                    key={slot.id}
                    className="bg-card-bg border border-card-border rounded-2xl p-4 shadow-lg shadow-black/20 flex items-stretch gap-4"
                  >
                    {/* Time Pillar */}
                    <div className="flex flex-col items-center justify-center min-w-[80px] pr-4 border-r border-card-border/50 text-center">
                      <span className="text-sm font-bold block">{formatTime(slot.start_time)}</span>
                      <span className="text-[10px] text-text-muted my-0.5">to</span>
                      <span className="text-sm font-medium text-text-secondary block">{formatTime(slot.end_time)}</span>
                    </div>

                    {/* Subject Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center relative pr-8 pl-1">
                      <h3 className="font-bold text-base truncate">{slot.subject.subject_name}</h3>
                      <p className="text-xs font-semibold text-accent mt-0.5">
                        {slot.subject.type}
                      </p>
                      
                      {slot.room_location && (
                        <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span className="truncate">{slot.room_location}</span>
                        </p>
                      )}

                      {/* Actions */}
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
                        <Link
                          href={`/timetable/${slot.id}/edit`}
                          className="p-1.5 text-text-muted hover:text-accent bg-background/80 rounded-lg transition-colors border border-transparent hover:border-accent/30"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(slot.id)}
                          disabled={deletingId === slot.id}
                          className="p-1.5 text-text-muted hover:text-danger bg-background/80 rounded-lg transition-colors border border-transparent hover:border-danger/30 disabled:opacity-50"
                        >
                          {deletingId === slot.id ? (
                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </ProtectedRoute>
  )
}
