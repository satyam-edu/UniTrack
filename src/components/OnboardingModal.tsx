'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface OnboardingModalProps {
  userId: string
  onComplete: () => void
}

export default function OnboardingModal({ userId, onComplete }: OnboardingModalProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    target_attendance: '75',
    theory_mode: 'class',
    lab_mode: 'class',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const target = parseInt(form.target_attendance, 10)
      if (isNaN(target) || target < 1 || target > 100) {
        setError('Target attendance must be between 1 and 100.')
        setSaving(false)
        return
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          target_attendance: target,
          theory_mode: form.theory_mode,
          lab_mode: form.lab_mode,
        })
        .eq('id', userId)

      if (updateError) throw updateError

      onComplete()
    } catch (err: any) {
      setError(err.message || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-card-bg border border-card-border rounded-2xl shadow-2xl shadow-black/40 p-6 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Welcome to UniTrack! 🎉</h2>
          <p className="text-text-muted text-sm mt-1.5">
            Let&apos;s set up your attendance preferences before you begin.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Target Attendance */}
          <div>
            <label htmlFor="target_attendance" className="block text-sm font-medium text-text-secondary mb-1.5">
              Target Attendance (%) <span className="text-danger">*</span>
            </label>
            <input
              id="target_attendance"
              name="target_attendance"
              type="number"
              required
              min="1"
              max="100"
              value={form.target_attendance}
              onChange={handleChange}
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
            <p className="text-[11px] text-text-muted mt-1 px-1">
              The minimum attendance % you need to maintain (most colleges require 75%).
            </p>
          </div>

          {/* Theory Mode */}
          <div>
            <label htmlFor="theory_mode" className="block text-sm font-medium text-text-secondary mb-1.5">
              Theory Attendance Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, theory_mode: 'class' }))}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                  form.theory_mode === 'class'
                    ? 'bg-accent/15 border-accent text-accent'
                    : 'bg-input-bg border-input-border text-text-muted hover:border-text-muted'
                }`}
              >
                Per Class
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, theory_mode: 'hour' }))}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                  form.theory_mode === 'hour'
                    ? 'bg-accent/15 border-accent text-accent'
                    : 'bg-input-bg border-input-border text-text-muted hover:border-text-muted'
                }`}
              >
                Per Hour
              </button>
            </div>
            <p className="text-[11px] text-text-muted mt-1 px-1">
              &quot;Per Class&quot; counts each session as 1. &quot;Per Hour&quot; counts by timetable duration.
            </p>
          </div>

          {/* Lab Mode */}
          <div>
            <label htmlFor="lab_mode" className="block text-sm font-medium text-text-secondary mb-1.5">
              Lab/Practical Attendance Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, lab_mode: 'class' }))}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                  form.lab_mode === 'class'
                    ? 'bg-accent/15 border-accent text-accent'
                    : 'bg-input-bg border-input-border text-text-muted hover:border-text-muted'
                }`}
              >
                Per Class
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, lab_mode: 'hour' }))}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                  form.lab_mode === 'hour'
                    ? 'bg-accent/15 border-accent text-accent'
                    : 'bg-input-bg border-input-border text-text-muted hover:border-text-muted'
                }`}
              >
                Per Hour
              </button>
            </div>
            <p className="text-[11px] text-text-muted mt-1 px-1">
              Same choice for lab sessions. Pick how your college counts practical attendance.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl shadow-lg shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </span>
            ) : (
              'Save & Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
