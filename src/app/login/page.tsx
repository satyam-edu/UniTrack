'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { lookupEmailByEnrollment } from '@/app/actions/auth'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [form, setForm] = useState({
    enrollment_no: '',
    password: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage('')
    setLoading(true)

    try {
      // Step 1: Look up email from enrollment number via Server Action
      const result = await lookupEmailByEnrollment(form.enrollment_no)

      if (result.error || !result.email) {
        setErrorMessage(result.error || 'No account found with this enrollment number.')
        return // STOP — do not call signInWithPassword
      }

      // Step 2: Sign in with the resolved email + user's password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: form.password,
      })

      if (authError) {
        setErrorMessage(authError.message)
        return
      }

      // Step 3: Login successful — redirect into the app
      router.push('/')
    } catch (err: unknown) {
      console.error('Login failed:', err)
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.'
      )
    } finally {
      // CRITICAL: Always stop the loading spinner
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
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-text-muted mt-1 text-sm">Sign in with your enrollment number</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-card-bg border border-card-border rounded-2xl p-6 space-y-5 shadow-lg shadow-black/20"
        >
          {errorMessage && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl px-4 py-3">
              {errorMessage}
            </div>
          )}

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
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-foreground placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl shadow-lg shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in…
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer link */}
        <p className="text-center text-sm text-text-muted mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-accent hover:text-accent-hover font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  )
}
