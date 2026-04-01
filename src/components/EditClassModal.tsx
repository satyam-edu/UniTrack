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

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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

interface Props {
  slot: TimetableSlot
  onClose: () => void
  onSuccess: () => void
}

export default function EditClassModal({ slot, onClose, onSuccess }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [fetchingSubjects, setFetchingSubjects] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [error, setError] = useState('')

  // Truncate from "HH:MM:SS" back to "HH:MM" for HTML time inputs
  const formatForInput = (timeStr: string) => {
    if (!timeStr) return ''
    return timeStr.slice(0, 5)
  }

  const [form, setForm] = useState({
    subject_id: slot.subject_id,
    day_of_week: slot.day_of_week,
    start_time: formatForInput(slot.start_time),
    end_time: formatForInput(slot.end_time),
    room_location: slot.room_location || '',
  })

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close on Escape key
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

    if (timeToMins(form.start_time) >= timeToMins(form.end_time)) {
      setError('End time must be after the start time.')
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { onClose(); return }

      const newStart = `${form.start_time}:00`
      const newEnd = `${form.end_time}:00`

      // Overlap check
      const { data: existingSlots, error: fetchError } = await supabase
        .from('timetable')
        .select('id, start_time, end_time')
        .eq('user_id', session.user.id)
        .eq('day_of_week', form.day_of_week)

      if (fetchError) throw fetchError

      const hasOverlap = existingSlots?.some((s) => {
        if (s.id === slot.id) return false // allow self overlap
        return newStart < s.end_time && newEnd > s.start_time
      })

      if (hasOverlap) {
        setError('You already have a class scheduled during this time slot.')
        setLoading(false)
        return
      }

      const { error: updateError } = await supabase
        .from('timetable')
        .update({
          subject_id: form.subject_id,
          day_of_week: form.day_of_week,
          start_time: newStart,
          end_time: newEnd,
          room_location: form.room_location ? form.room_location : null,
        })
        .eq('id', slot.id)

      if (updateError) throw updateError

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating the slot.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      className="fixed inset-0 z-[50] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-white/95 backdrop-blur-xl border border-white shadow-2xl text-slate-800 rounded-3xl overflow-hidden"
      >
        <div className="px-6 pt-5 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Edit Class</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Loading subjects */}
          {fetchingSubjects ? (
            <div className="flex justify-center py-8">
              <svg className="animate-spin h-7 w-7 text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error */}
              {error && (
                <div className="mb-4 rounded-xl px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200">
                  {error}
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  Subject <span className="text-red-500">*</span>
                </label>
                <select
                  name="subject_id" required value={form.subject_id} onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer transition-all"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.subject_code} – {sub.subject_name}</option>
                  ))}
                </select>
              </div>

              {/* Day */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  Day <span className="text-red-500">*</span>
                </label>
                <select
                  name="day_of_week" required value={form.day_of_week} onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer transition-all"
                >
                  {daysOfWeek.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              {/* Time row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Start <span className="text-red-500">*</span></label>
                  <input name="start_time" type="time" required value={form.start_time} onChange={handleChange}
                    className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 active:bg-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">End <span className="text-red-500">*</span></label>
                  <input name="end_time" type="time" required value={form.end_time} onChange={handleChange}
                    className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 active:bg-white transition-all" />
                </div>
              </div>

              {/* Room */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5 flex justify-between">
                  <span>Room / Location</span>
                  <span className="text-slate-400 text-xs">Optional</span>
                </label>
                <input name="room_location" type="text" placeholder="e.g. Room 402, Block A" value={form.room_location} onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all" />
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={onClose}
                  className="py-3 rounded-xl font-semibold text-sm bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  style={{ background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)', boxShadow: '0 4px 12px rgba(26,158,160,0.30)' }}
                >
                  {loading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}
