'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'motion/react'
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

interface Props {
  onClose: () => void
  onSuccess: () => void
  activeDay: string
}

export default function ScheduleClassModal({ onClose, onSuccess, activeDay }: Props) {
  const [loading, setLoading] = useState(false)
  const [fetchingSubjects, setFetchingSubjects] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [error, setError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    subject_id: '',
    start_time: '09:00',
    end_time: '10:00',
    room_location: '',
  })

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const loadSubjects = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      onClose()
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
  }, [onClose])

  useEffect(() => {
    loadSubjects()
  }, [loadSubjects])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.subject_id) {
      setError('Please select a subject.')
      return
    }

    if (timeToMins(form.start_time) >= timeToMins(form.end_time)) {
      setError('End time must be after the start time.')
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        onClose()
        return
      }

      const newStart = `${form.start_time}:00`
      const newEnd = `${form.end_time}:00`

      // Detect collisions for this specific day
      const { data: existingSlots, error: fetchError } = await supabase
        .from('timetable')
        .select('start_time, end_time')
        .eq('user_id', session.user.id)
        .eq('day_of_week', activeDay)

      if (fetchError) throw fetchError

      const hasOverlap = existingSlots?.some((slot) => {
        return newStart < slot.end_time && newEnd > slot.start_time
      })

      if (hasOverlap) {
        setError('You already have a class scheduled during this time slot on ' + activeDay + '.')
        setLoading(false)
        return
      }

      const { error: insertError } = await supabase.from('timetable').insert({
        user_id: session.user.id,
        subject_id: form.subject_id,
        day_of_week: activeDay,
        start_time: newStart,
        end_time: newEnd,
        room_location: form.room_location ? form.room_location.trim() : null,
      })

      if (insertError) throw insertError

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred while scheduling the class.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-white/95 backdrop-blur-xl border border-white shadow-2xl text-slate-800 rounded-3xl overflow-hidden"
      >
        <div className="px-6 pt-4 pb-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Schedule Class ({activeDay})</h2>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {fetchingSubjects ? (
            <div className="flex justify-center py-8">
              <svg className="animate-spin h-7 w-7 text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : subjects.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-1">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-sm text-slate-600">
                You must add a subject before scheduling classes.
              </p>
              <button
                onClick={onClose}
                className="inline-block bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-accent-glow cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="modal-subject_id" className="block text-sm font-medium text-slate-600 mb-1.5 flex justify-between">
                  <span>Subject <span className="text-red-500">*</span></span>
                </label>
                <select
                  id="modal-subject_id"
                  name="subject_id"
                  required
                  value={form.subject_id}
                  onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer transition-all"
                >
                  {subjects.map((sub) => (
                     <option key={sub.id} value={sub.id}>{sub.subject_code} – {sub.subject_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="modal-start_time" className="block text-sm font-medium text-slate-600 mb-1.5">
                    Start <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="modal-start_time"
                    name="start_time"
                    type="time"
                    required
                    value={form.start_time}
                    onChange={handleChange}
                    className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 active:bg-white transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="modal-end_time" className="block text-sm font-medium text-slate-600 mb-1.5">
                    End <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="modal-end_time"
                    name="end_time"
                    type="time"
                    required
                    value={form.end_time}
                    onChange={handleChange}
                    className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 active:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="modal-room_location" className="block text-sm font-medium text-slate-600 mb-1.5 flex justify-between">
                  <span>Room / Location</span>
                  <span className="text-slate-400 text-xs">Optional</span>
                </label>
                <input
                  id="modal-room_location"
                  name="room_location"
                  type="text"
                  placeholder="e.g. Room 402, Block A"
                  value={form.room_location}
                  onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 rounded-xl font-semibold text-sm bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-3 rounded-xl font-semibold text-sm bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {loading ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving…
                    </span>
                  ) : (
                    'Add Class'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}
