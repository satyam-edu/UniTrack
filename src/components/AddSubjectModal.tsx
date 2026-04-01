'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { supabase } from '@/lib/supabase'

interface Subject {
  id: string
  subject_name: string
  subject_code: string
}

interface Props {
  onClose: () => void
  onSuccess: () => void
  existingSubjects: Subject[]
}

export default function AddSubjectModal({ onClose, onSuccess, existingSubjects }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    subject_name: '',
    subject_code: '',
    faculty_name: '',
    type: 'Theory',
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Duplicate Check
    const isDuplicate = existingSubjects.some(
      (sub) => sub.subject_code.toLowerCase() === form.subject_code.trim().toLowerCase()
    )

    if (isDuplicate) {
      setError('This subject code already exists!')
      return
    }

    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        onClose()
        return
      }

      const { error: insertError } = await supabase.from('subjects').insert({
        user_id: session.user.id,
        subject_name: form.subject_name.trim(),
        subject_code: form.subject_code.trim(),
        faculty_name: form.faculty_name.trim(),
        type: form.type,
      })

      if (insertError) throw insertError

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred while adding the subject.')
    } finally {
      setLoading(false)
    }
  }

  return (
    /* Backdrop — always centered */
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      {/* Floating dialog - Strict Light Glassmorphism */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-white/95 backdrop-blur-xl border border-white shadow-2xl text-slate-800 rounded-3xl overflow-hidden"
      >
        <div className="px-6 pt-4 pb-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">New Subject</h2>
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

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="modal-subject_name" className="block text-sm font-medium text-slate-600 mb-1.5">
                Subject Name <span className="text-red-500">*</span>
              </label>
              <input
                id="modal-subject_name"
                name="subject_name"
                type="text"
                required
                autoFocus
                value={form.subject_name}
                onChange={handleChange}
                placeholder="e.g. Data Structures"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="modal-subject_code" className="block text-sm font-medium text-slate-600 mb-1.5">
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="modal-subject_code"
                  name="subject_code"
                  type="text"
                  required
                  value={form.subject_code}
                  onChange={handleChange}
                  placeholder="e.g. CS201"
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent ${
                    error === 'This subject code already exists!' ? 'border-red-500 ring-red-500/20' : 'border-slate-200'
                  }`}
                />
                {error === 'This subject code already exists!' && (
                  <p className="text-red-500 text-xs mt-1 font-medium ml-1">
                    {error}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="modal-type" className="block text-sm font-medium text-slate-600 mb-1.5">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="modal-type"
                  name="type"
                  required
                  value={form.type}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent appearance-none cursor-pointer transition-all"
                >
                  <option value="Theory">Theory</option>
                  <option value="Lab">Lab</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="modal-faculty_name" className="block text-sm font-medium text-slate-600 mb-1.5">
                Teacher
                <span className="text-slate-400 text-xs ml-2">Optional</span>
              </label>
              <input
                id="modal-faculty_name"
                name="faculty_name"
                type="text"
                value={form.faculty_name}
                onChange={handleChange}
                placeholder="e.g. Dr. Alan Turing"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              />
            </div>

            {/* Actions */}
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
                style={{ background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)', boxShadow: '0 4px 12px rgba(26,158,160,0.30)' }}
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
                  'Add Subject'
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
