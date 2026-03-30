'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AddSubjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    subject_name: '',
    subject_code: '',
    faculty_name: '',
    type: 'Theory',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
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

      router.push('/subjects')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred while adding the subject.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/subjects" className="text-text-muted hover:text-foreground transition-colors p-2 -ml-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Add Subject</h1>
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
          <label htmlFor="subject_name" className="block text-sm font-medium text-text-secondary mb-1.5">
            Subject Name <span className="text-danger">*</span>
          </label>
          <input
            id="subject_name"
            name="subject_name"
            type="text"
            required
            value={form.subject_name}
            onChange={handleChange}
            placeholder="e.g. Data Structures"
            className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="subject_code" className="block text-sm font-medium text-text-secondary mb-1.5">
            Subject Code <span className="text-danger">*</span>
          </label>
          <input
            id="subject_code"
            name="subject_code"
            type="text"
            required
            value={form.subject_code}
            onChange={handleChange}
            placeholder="e.g. CS201"
            className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="faculty_name" className="block text-sm font-medium text-text-secondary mb-1.5">
            Faculty Name
          </label>
          <input
            id="faculty_name"
            name="faculty_name"
            type="text"
            value={form.faculty_name}
            onChange={handleChange}
            placeholder="e.g. Dr. Alan Turing"
            className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-text-secondary mb-1.5">
            Type <span className="text-danger">*</span>
          </label>
          <select
            id="type"
            name="type"
            required
            value={form.type}
            onChange={handleChange}
            className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent appearance-none cursor-pointer"
          >
            <option value="Theory">Theory</option>
            <option value="Lab">Lab</option>
          </select>
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
            'Save Subject'
          )}
        </button>
      </form>
    </main>
  )
}
