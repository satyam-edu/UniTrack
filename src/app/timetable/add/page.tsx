'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Subject {
  id: string
  subject_name: string
  subject_code: string
}

const timeToMins = (time: string) => { 
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export default function AddTimetablePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetchingSubjects, setFetchingSubjects] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    subject_id: '',
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '10:00',
    room_location: '',
  })

  const loadSubjects = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/login')
      return
    }

    const { data } = await supabase
      .from('subjects')
      .select('id, subject_name, subject_code')
      .eq('user_id', session.user.id)
      .order('subject_name', { ascending: true })

    if (data && data.length > 0) {
      setSubjects(data)
      setForm((prev) => ({ ...prev, subject_id: data[0].id }))
    }
    setFetchingSubjects(false)
  }, [router])

  useEffect(() => {
    loadSubjects()
  }, [loadSubjects])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    
    // Mathematical time validation
    if (timeToMins(form.start_time) >= timeToMins(form.end_time)) {
      setError('End time must be after the start time.')
      return
    }

    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      // Check for overlaps
      const newStart = `${form.start_time}:00`
      const newEnd = `${form.end_time}:00`

      const { data: existingSlots, error: fetchError } = await supabase
        .from('timetable')
        .select('start_time, end_time')
        .eq('user_id', session.user.id)
        .eq('day_of_week', form.day_of_week)

      if (fetchError) throw fetchError

      // Overlap condition:
      // (newStart < existingEnd) && (newEnd > existingStart)
      const hasOverlap = existingSlots?.some((slot) => {
        return newStart < slot.end_time && newEnd > slot.start_time
      })

      if (hasOverlap) {
        setError('You already have a class scheduled during this time slot.')
        setLoading(false)
        return
      }

      // Insert safely
      const { error: insertError } = await supabase.from('timetable').insert({
        user_id: session.user.id,
        subject_id: form.subject_id,
        day_of_week: form.day_of_week,
        start_time: newStart,
        end_time: newEnd,
        room_location: form.room_location ? form.room_location : null,
      })

      if (insertError) throw insertError

      router.push('/timetable')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred while adding the slot.')
    } finally {
      setLoading(false)
    }
  }

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  if (fetchingSubjects) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/timetable" className="text-text-muted hover:text-foreground transition-colors p-2 -ml-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Add Class</h1>
      </div>

      {subjects.length === 0 ? (
        <div className="bg-card-bg border border-card-border rounded-2xl p-8 text-center shadow-lg shadow-black/20">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-3">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
          </div>
          <h3 className="font-semibold mb-1">No subjects found</h3>
          <p className="text-text-muted text-sm mb-4">
            You must add a subject before scheduling classes.
          </p>
          <Link
            href="/subjects/add"
            className="inline-block bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-accent-glow"
          >
            Add Subject
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-card-bg border border-card-border rounded-2xl p-6 space-y-4 shadow-lg shadow-black/20"
        >
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="subject_id" className="block text-sm font-medium text-text-secondary mb-1.5">
              Subject <span className="text-danger">*</span>
            </label>
            <select
              id="subject_id"
              name="subject_id"
              required
              value={form.subject_id}
              onChange={handleChange}
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent appearance-none cursor-pointer"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.subject_code} - {sub.subject_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="day_of_week" className="block text-sm font-medium text-text-secondary mb-1.5">
              Day of the Week <span className="text-danger">*</span>
            </label>
            <select
              id="day_of_week"
              name="day_of_week"
              required
              value={form.day_of_week}
              onChange={handleChange}
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent appearance-none cursor-pointer"
            >
              {daysOfWeek.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start_time" className="block text-sm font-medium text-text-secondary mb-1.5">
                Start Time <span className="text-danger">*</span>
              </label>
              <input
                id="start_time"
                name="start_time"
                type="time"
                required
                value={form.start_time}
                onChange={handleChange}
                className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent appearance-none"
              />
            </div>

            <div>
              <label htmlFor="end_time" className="block text-sm font-medium text-text-secondary mb-1.5">
                End Time <span className="text-danger">*</span>
              </label>
              <input
                id="end_time"
                name="end_time"
                type="time"
                required
                value={form.end_time}
                onChange={handleChange}
                className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent appearance-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="room_location" className="block text-sm font-medium text-text-secondary mb-1.5 flex justify-between">
              <span>Room/Location</span>
              <span className="text-text-muted text-xs">Optional</span>
            </label>
            <input
              id="room_location"
              name="room_location"
              type="text"
              placeholder="e.g. Room 402, Block A"
              value={form.room_location}
              onChange={handleChange}
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl shadow-lg shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-4"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </span>
            ) : (
              'Save Class'
            )}
          </button>
        </form>
      )}
    </main>
  )
}
