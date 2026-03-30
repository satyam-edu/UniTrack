'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import ProtectedRoute from '@/components/ProtectedRoute'
import OnboardingModal from '@/components/OnboardingModal'

interface UserProfile {
  id: string
  name: string
  enrollment_no: string
  branch: string
  college: string
  mobile_no: string
  email: string
  batch: string
  created_at: string
  target_attendance: number | null
  theory_mode: string | null
  lab_mode: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Settings edit state
  const [editingSettings, setEditingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    target_attendance: '75',
    theory_mode: 'class',
    lab_mode: 'class',
  })

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (error || !data) return

      setUser(data)

      // Check if onboarding is needed
      if (data.target_attendance === null || data.target_attendance === undefined) {
        setShowOnboarding(true)
      }

      // Pre-fill settings form
      setSettingsForm({
        target_attendance: data.target_attendance?.toString() || '75',
        theory_mode: data.theory_mode || 'class',
        lab_mode: data.lab_mode || 'class',
      })

      setLoading(false)
    }

    loadProfile()
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSavingSettings(true)

    const target = parseInt(settingsForm.target_attendance, 10)
    const { error } = await supabase
      .from('users')
      .update({
        target_attendance: target,
        theory_mode: settingsForm.theory_mode,
        lab_mode: settingsForm.lab_mode,
      })
      .eq('id', user.id)

    if (!error) {
      setUser((prev) =>
        prev
          ? {
              ...prev,
              target_attendance: target,
              theory_mode: settingsForm.theory_mode,
              lab_mode: settingsForm.lab_mode,
            }
          : prev
      )
      setEditingSettings(false)
    }
    setSavingSettings(false)
  }

  function handleOnboardingComplete() {
    setShowOnboarding(false)
    // Reload to get updated user data
    window.location.reload()
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-text-muted text-sm">Loading your profile…</p>
          </div>
        </main>
        <BottomNav />
      </ProtectedRoute>
    )
  }

  if (!user) return null

  const profileFields = [
    { label: 'Enrollment No', value: user.enrollment_no, icon: '🆔' },
    { label: 'Email', value: user.email, icon: '✉️' },
    { label: 'Branch', value: user.branch, icon: '🎓' },
    { label: 'College', value: user.college, icon: '🏛️' },
    { label: 'Batch', value: user.batch, icon: '📅' },
    { label: 'Mobile', value: user.mobile_no, icon: '📱' },
  ]

  const modeLabel = (mode: string | null) =>
    mode === 'hour' ? 'Per Hour' : 'Per Class'

  return (
    <ProtectedRoute>
      {/* Onboarding Modal for new users */}
      {showOnboarding && (
        <OnboardingModal userId={user.id} onComplete={handleOnboardingComplete} />
      )}

      <main className="flex-1 flex flex-col px-4 py-6 pb-24 max-w-lg mx-auto w-full">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        </div>

        {/* User Info Section */}
        <div className="bg-card-bg border border-card-border rounded-2xl p-6 flex flex-col items-center text-center shadow-lg shadow-black/20 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
          <div className="w-24 h-24 rounded-full bg-accent/15 flex items-center justify-center text-4xl font-bold text-accent mb-4 shadow-inner ring-4 ring-background z-10">
            {user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <h2 className="text-xl font-bold z-10">{user.name}</h2>
          <p className="text-text-secondary font-medium mt-0.5 z-10">{user.email}</p>
          <span className="inline-block mt-3 text-xs font-semibold bg-accent/10 text-accent px-4 py-1.5 rounded-full border border-accent/20 z-10">
            {user.enrollment_no} • {user.branch} • {user.batch}
          </span>
        </div>

        {/* Attendance Settings Card */}
        <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden shadow-lg shadow-black/20 mb-4">
          <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
              Attendance Settings
            </h3>
            {!editingSettings && (
              <button
                onClick={() => setEditingSettings(true)}
                className="text-xs text-accent font-medium hover:text-accent-hover cursor-pointer"
              >
                Edit
              </button>
            )}
          </div>

          {editingSettings ? (
            <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Target Attendance (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={settingsForm.target_attendance}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, target_attendance: e.target.value }))}
                  className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1.5">Theory Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {['class', 'hour'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSettingsForm((f) => ({ ...f, theory_mode: mode }))}
                      className={`py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        settingsForm.theory_mode === mode
                          ? 'bg-accent/15 border-accent text-accent'
                          : 'bg-input-bg border-input-border text-text-muted hover:border-text-muted'
                      }`}
                    >
                      {mode === 'class' ? 'Per Class' : 'Per Hour'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1.5">Lab Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {['class', 'hour'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSettingsForm((f) => ({ ...f, lab_mode: mode }))}
                      className={`py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        settingsForm.lab_mode === mode
                          ? 'bg-accent/15 border-accent text-accent'
                          : 'bg-input-bg border-input-border text-text-muted hover:border-text-muted'
                      }`}
                    >
                      {mode === 'class' ? 'Per Class' : 'Per Hour'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex-1 bg-accent hover:bg-accent-hover text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {savingSettings ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSettings(false)}
                  className="flex-1 bg-input-bg border border-input-border text-text-secondary text-sm font-semibold py-2.5 rounded-xl hover:border-text-muted cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="divide-y divide-card-border">
              <div className="flex items-center gap-3 px-6 py-4">
                <span className="text-lg">🎯</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-muted">Target Attendance</p>
                  <p className="text-sm font-medium">{user.target_attendance ?? '—'}%</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-4">
                <span className="text-lg">📖</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-muted">Theory Mode</p>
                  <p className="text-sm font-medium">{modeLabel(user.theory_mode)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-4">
                <span className="text-lg">🔬</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-muted">Lab Mode</p>
                  <p className="text-sm font-medium">{modeLabel(user.lab_mode)}</p>
                </div>
              </div>
            </div>
          )}
        </div>


        {/* Details card */}
        <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden shadow-lg shadow-black/20">
          <div className="px-6 py-4 border-b border-card-border">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
              Details
            </h3>
          </div>

          <div className="divide-y divide-card-border">
            {profileFields.map((field) => (
              <div key={field.label} className="flex items-center gap-3 px-6 py-4">
                <span className="text-lg">{field.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-muted">{field.label}</p>
                  <p className="text-sm font-medium truncate">
                    {field.value || '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Primary Logout Button */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-8 w-full bg-danger/10 hover:bg-danger text-danger hover:text-white font-bold py-4 rounded-xl transition-all shadow-sm shadow-danger/5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-danger/20 hover:border-danger"
        >
          {loggingOut ? (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          )}
          <span>{loggingOut ? 'Signing out...' : 'Log Out'}</span>
        </button>

        {/* Joined date */}
        <p className="text-center text-xs text-text-muted mt-6">
          Joined{' '}
          {new Date(user.created_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </main>
      <BottomNav />
    </ProtectedRoute>
  )
}
