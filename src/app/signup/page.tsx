'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    enrollment_no: '',
    branch: '',
    college: '',
    mobile_no: '',
    email: '',
    batch: '',
    password: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Sign up with Supabase Auth using real email + password
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      const userId = authData.user?.id
      if (!userId) {
        setError('Signup failed. Please try again.')
        setLoading(false)
        return
      }

      // 2. Insert profile data into public users table
      const { error: insertError } = await supabase.from('users').insert({
        id: userId,
        name: form.name,
        enrollment_no: form.enrollment_no,
        branch: form.branch,
        college: form.college,
        mobile_no: form.mobile_no,
        email: form.email,
        batch: form.batch,
      })

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }

      // 3. Redirect to profile on success
      router.push('/profile')
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-text-muted mt-1 text-sm">Join UniTrack to start tracking attendance</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-card-bg border border-card-border rounded-2xl p-6 space-y-4 shadow-lg shadow-black/20"
        >
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1.5">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="John Doe"
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1.5">
              Email <span className="text-danger">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="john@university.edu"
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1.5">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={handleChange}
              placeholder="Minimum 6 characters"
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>

          {/* Enrollment No */}
          <div>
            <label htmlFor="enrollment_no" className="block text-sm font-medium text-text-secondary mb-1.5">
              Enrollment No
            </label>
            <input
              id="enrollment_no"
              name="enrollment_no"
              type="text"
              required
              value={form.enrollment_no}
              onChange={handleChange}
              placeholder="e.g. 2023BTCS001"
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>

          {/* Branch + Batch (side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="branch" className="block text-sm font-medium text-text-secondary mb-1.5">
                Branch
              </label>
              <input
                id="branch"
                name="branch"
                type="text"
                value={form.branch}
                onChange={handleChange}
                placeholder="CSE"
                className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="batch" className="block text-sm font-medium text-text-secondary mb-1.5">
                Batch
              </label>
              <input
                id="batch"
                name="batch"
                type="text"
                value={form.batch}
                onChange={handleChange}
                placeholder="2023-27"
                className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              />
            </div>
          </div>

          {/* College */}
          <div>
            <label htmlFor="college" className="block text-sm font-medium text-text-secondary mb-1.5">
              College
            </label>
            <input
              id="college"
              name="college"
              type="text"
              value={form.college}
              onChange={handleChange}
              placeholder="e.g. NIT Kurukshetra"
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>

          {/* Mobile No */}
          <div>
            <label htmlFor="mobile_no" className="block text-sm font-medium text-text-secondary mb-1.5">
              Mobile No
            </label>
            <input
              id="mobile_no"
              name="mobile_no"
              type="tel"
              value={form.mobile_no}
              onChange={handleChange}
              placeholder="+91 98765 43210"
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl shadow-lg shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating account…
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Footer link */}
        <p className="text-center text-sm text-text-muted mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:text-accent-hover font-medium">
            Log in
          </Link>
        </p>
      </div>
    </main>
  )
}
