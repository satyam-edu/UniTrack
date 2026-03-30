'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Subject {
  id: string
  subject_name: string
  subject_code: string
}

export default function EditTimetablePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    subject_id: '',
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '10:00',
  })

  const loadData = useCallback(async () => {
    if (!id) return

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/login')
      return
    }

    // Fetch subjects globally for dropdown
    const { data: subs } = await supabase
      .from('subjects')
      .select('id, subject_name, subject_code')
      .eq('user_id', session.user.id)
      .order('subject_name', { ascending: true })

    if (subs) setSubjects(subs)

    // Fetch the specific timetable slot
    const { data: slot, error } = await supabase
      .from('timetable')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single()

    if (error || !slot) {
      setError('Slot not found or you do not have permission.')
      setFetching(false)
      return
    }

    // Postrgres returns TIME without timezone e.g. "09:00:00", trim seconds for HTML time input
    const formattedStartTime = slot.start_time.substring(0, 5)
    const formattedEndTime = slot.end_time.substring(0, 5)

    setForm({
      subject_id: slot.subject_id,
      day_of_week: slot.day_of_week,
      start_time: formattedStartTime,
      end_time: formattedEndTime,
    })

    setFetching(false)
  }, [id, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    
    // Quick validation
    if (form.start_time >= form.end_time) {
      setError('Start time must be before end time.')
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

      const { error: updateError } = await supabase
        .from('timetable')
        .update({
          subject_id: form.subject_id,
          day_of_week: form.day_of_week,
          start_time: `${form.start_time}:00`,
          end_time: `${form.end_time}:00`,
        })
        .eq('id', id)
        .eq('user_id', session.user.id)

      if (updateError) throw updateError

      router.push('/timetable')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating the slot.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </main>
    )
  }

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <main className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/timetable" className="text-text-muted hover:text-foreground transition-colors p-2 -ml-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Edit Class</h1>
      </div>

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
              Updating…
            </span>
          ) : (
            'Update Class'
          )}
        </button>
      </form>
    </main>
  )
}
