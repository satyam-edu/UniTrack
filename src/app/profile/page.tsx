'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { deleteUserAccount } from '@/app/actions/auth'
import BottomNav from '@/components/BottomNav'
import ProtectedRoute from '@/components/ProtectedRoute'
import OnboardingModal from '@/components/OnboardingModal'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

function modeLabel(mode: string | null) {
  return mode === 'hour' ? 'Per Hour' : 'Per Class'
}

// ─── Glass card style ─────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
}

const GLASS_CARD_CLASS = 'bg-white/80 border border-white/60'

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({ onClose, userEmail }: { onClose: () => void; userEmail: string }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    try {
      // Step 1: Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      })
      if (signInError) {
        setError('Incorrect current password.')
        return
      }

      // Step 2: Current password confirmed — update to new password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) { setError(updateError.message); return }
      setSuccess(true)
      setTimeout(onClose, 1800)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,15,28,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring' as const, damping: 25, stiffness: 300 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden bg-white/95 border border-white/70"
        style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}
      >
        <div className="px-6 pt-5 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Change Password</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
              style={{ background: 'rgba(26,158,160,0.08)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl px-4 py-3 text-sm text-danger" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.20)' }}>
              {error}
            </div>
          )}

          {success ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(26,158,160,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-900">Password updated!</p>
                <p className="text-sm text-slate-500 mt-0.5">Your new password is active.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Your current password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                  />
                  <button type="button" onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                    aria-label={showCurrent ? 'Hide' : 'Show'}
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'rgba(26,158,160,0.10)' }} />

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                  />
                  <button type="button" onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                    aria-label={showNew ? 'Hide' : 'Show'}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                    aria-label={showConfirm ? 'Hide' : 'Show'}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="py-3 rounded-xl text-sm font-semibold text-text-secondary cursor-pointer transition-colors"
                  style={{ background: 'rgba(26,158,160,0.06)', border: '1px solid rgba(26,158,160,0.15)' }}
                >
                  Cancel
                </button>
                <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.96 }}
                  className="py-3 rounded-xl text-sm font-bold text-white cursor-pointer disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)', boxShadow: '0 4px 12px rgba(26,158,160,0.35)' }}
                >
                  {loading ? 'Saving…' : 'Update Password'}
                </motion.button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserProfile
  onClose: () => void
  onSaved: (updated: Partial<UserProfile>) => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    enrollment_no: user.enrollment_no || '',
    branch: user.branch || '',
    college: user.college || '',
    batch: user.batch || '',
    mobile_no: user.mobile_no || '',
  })

  // Lock scroll + Escape key
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: form.name.trim(),
          email: form.email.trim(),
          enrollment_no: form.enrollment_no.trim(),
          branch: form.branch.trim(),
          college: form.college.trim(),
          batch: form.batch.trim(),
          mobile_no: form.mobile_no.trim(),
        })
        .eq('id', user.id)

      if (updateError) throw updateError
      onSaved({ ...form })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,15,28,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring' as const, damping: 25, stiffness: 300 }}
        className="w-full max-w-md rounded-3xl overflow-hidden bg-white/95 border border-white/70"
        style={{
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
        }}
      >
        <div className="px-6 pt-5 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Edit Profile</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
              style={{ background: 'rgba(26,158,160,0.08)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl px-4 py-3 text-sm text-danger" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.20)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Full Name</label>
              <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Satyam Sharma"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
            </div>

            {/* Email — read-only */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                Email
                <span className="ml-1.5 text-[10px] font-normal text-slate-400 tracking-wide">(cannot be changed)</span>
              </label>
              <input
                name="email" type="email" value={form.email}
                readOnly
                placeholder="e.g. satyam@university.edu"
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-400 placeholder:text-slate-300 cursor-not-allowed opacity-70 select-none"
              />
            </div>

            {/* Enrollment + Branch */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Enrollment No
                  <span className="ml-1 text-[9px] font-normal text-slate-400">(locked)</span>
                </label>
                <input
                  name="enrollment_no" value={form.enrollment_no}
                  readOnly
                  placeholder="2023BTCS001"
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-400 placeholder:text-slate-300 cursor-not-allowed opacity-70 select-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Branch</label>
                <input name="branch" value={form.branch} onChange={handleChange} placeholder="CSE"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
              </div>
            </div>

            {/* College + Batch */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">College</label>
                <input name="college" value={form.college} onChange={handleChange} placeholder="NIT Kurukshetra"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Batch</label>
                <input name="batch" value={form.batch} onChange={handleChange} placeholder="2023-27"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
              </div>
            </div>

            {/* Mobile */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mobile No</label>
              <input name="mobile_no" type="tel" value={form.mobile_no} onChange={handleChange} placeholder="+91 98765 43210"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="py-3 rounded-xl text-sm font-semibold text-text-secondary cursor-pointer transition-colors"
                style={{ background: 'rgba(26,158,160,0.06)', border: '1px solid rgba(26,158,160,0.15)' }}
              >
                Cancel
              </button>
              <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.96 }}
                className="py-3 rounded-xl text-sm font-bold text-white cursor-pointer disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)', boxShadow: '0 4px 12px rgba(26,158,160,0.35)' }}
              >
                {loading ? 'Saving…' : 'Save Changes'}
              </motion.button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Row item inside a glass card ─────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(26,158,160,0.10)' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold tracking-wider text-text-muted uppercase">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate mt-0.5">{value || '—'}</p>
      </div>
    </div>
  )
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const Icon = {
  Target: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  Book: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  Flask: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v7.5L4 20h16L15 9.5V2"/><line x1="9" y1="2" x2="15" y2="2"/>
    </svg>
  ),
  Id: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/>
    </svg>
  ),
  Mail: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  GradCap: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  Building: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Phone: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91A16 16 0 0 0 15 15.91l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  Sun: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  Moon: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Attendance settings
  const [editingSettings, setEditingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    target_attendance: '75',
    theory_mode: 'class',
    lab_mode: 'class',
  })

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase.from('users').select('*').eq('id', session.user.id).single()
      if (error || !data) return

      setUser(data)
      if (data.target_attendance === null || data.target_attendance === undefined) setShowOnboarding(true)
      setSettingsForm({
        target_attendance: data.target_attendance?.toString() || '75',
        theory_mode: data.theory_mode || 'class',
        lab_mode: data.lab_mode || 'class',
      })
      setLoading(false)
    }
    loadProfile()
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleDelete() {
    if (!user) return
    setIsDeleting(true)
    try {
      const res = await deleteUserAccount(user.id)
      if (res.error) {
        setToastMessage(res.error)
        setTimeout(() => setToastMessage(''), 3000)
        return
      }
      await supabase.auth.signOut()
      router.push('/signup')
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to delete account')
      setTimeout(() => setToastMessage(''), 3000)
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSavingSettings(true)
    const target = parseInt(settingsForm.target_attendance, 10)
    const { error } = await supabase.from('users').update({
      target_attendance: target,
      theory_mode: settingsForm.theory_mode,
      lab_mode: settingsForm.lab_mode,
    }).eq('id', user.id)

    if (!error) {
      setUser((prev) => prev ? { ...prev, target_attendance: target, theory_mode: settingsForm.theory_mode, lab_mode: settingsForm.lab_mode } : prev)
      setEditingSettings(false)
    }
    setSavingSettings(false)
  }

  function handleProfileSaved(updated: Partial<UserProfile>) {
    setUser((prev) => prev ? { ...prev, ...updated } : prev)
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (!user) return null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute>
      {/* Onboarding */}
      {showOnboarding && (
        <OnboardingModal userId={user.id} onComplete={() => { setShowOnboarding(false); window.location.reload() }} />
      )}

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditProfile && (
          <EditProfileModal
            user={user}
            onClose={() => setShowEditProfile(false)}
            onSaved={handleProfileSaved}
          />
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showChangePassword && (
          <ChangePasswordModal
            onClose={() => setShowChangePassword(false)}
            userEmail={user.email}
          />
        )}
      </AnimatePresence>

      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
        className="flex-1 flex flex-col px-4 py-6 pb-28 max-w-lg mx-auto w-full"
        style={{ willChange: 'opacity, transform' }}
      >

        {/* ── Header title ───────────────────────────────────────────────── */}
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-6">Profile</h1>

        {/* ── 1. Profile Hero Card ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03, type: 'spring' as const, damping: 25 }}
          className="relative rounded-3xl overflow-hidden mb-4 shadow-xl"
          style={{ background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 55%, #0a6b70 100%)' }}
        >
          {/* Gloss overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.02) 60%, transparent 100%)' }} />
          {/* Blob */}
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.07)', filter: 'blur(24px)' }} />

          <div className="relative p-6 flex flex-col items-center text-center">
            {/* Avatar circle */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-extrabold mb-4"
              style={{ background: 'rgba(255,255,255,0.22)', border: '2.5px solid rgba(255,255,255,0.45)', color: 'white', backdropFilter: 'blur(8px)' }}
            >
              {initials(user.name)}
            </div>

            <h2 className="text-2xl font-extrabold text-white leading-tight">{user.name}</h2>
            <p className="text-white/70 text-sm font-medium mt-0.5">{user.email}</p>

            {/* Enrollment/Branch pill */}
            <div
              className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-white/90"
              style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.30)' }}
            >
              <span>{user.enrollment_no || '—'}</span>
              {user.branch && <><span className="opacity-50">·</span><span>{user.branch}</span></>}
              {user.batch  && <><span className="opacity-50">·</span><span>{user.batch}</span></>}
            </div>

            {/* Joined */}
            <p className="mt-3 text-[11px] text-white/50 font-medium">
              Joined {new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </motion.div>

        {/* ── 2. Attendance Settings Card ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, type: 'spring' as const, damping: 25 }}
          className={`rounded-3xl overflow-hidden mb-4 ${GLASS_CARD_CLASS}`}
          style={glassCard}
        >
          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(26,158,160,0.10)' }}>
            <h3 className="text-xs font-bold tracking-widest text-text-muted uppercase">Attendance Settings</h3>
            {!editingSettings && (
              <button
                onClick={() => setEditingSettings(true)}
                className="text-xs font-bold px-3 py-1 rounded-lg cursor-pointer transition-all duration-200 active:scale-95"
                style={{ background: 'rgba(26,158,160,0.10)', color: '#1a9ea0', border: '1px solid rgba(26,158,160,0.20)' }}
              >
                Edit
              </button>
            )}
          </div>

          {editingSettings ? (
            <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
              {/* Target */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">Target Attendance (%)</label>
                <input
                  type="number" min="1" max="100" required
                  value={settingsForm.target_attendance}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, target_attendance: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                />
              </div>

              {/* Theory mode */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">Theory Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['class', 'hour'] as const).map((mode) => (
                    <button key={mode} type="button" onClick={() => setSettingsForm((f) => ({ ...f, theory_mode: mode }))}
                      className="py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-all duration-200 active:scale-95"
                      style={settingsForm.theory_mode === mode
                        ? { background: 'rgba(26,158,160,0.15)', border: '1.5px solid #1a9ea0', color: '#1a9ea0' }
                        : { background: 'transparent', borderColor: 'rgba(26,158,160,0.20)', color: '#7a93a8' }
                      }
                    >
                      {mode === 'class' ? 'Per Class' : 'Per Hour'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lab mode */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">Lab Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['class', 'hour'] as const).map((mode) => (
                    <button key={mode} type="button" onClick={() => setSettingsForm((f) => ({ ...f, lab_mode: mode }))}
                      className="py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-all duration-200 active:scale-95"
                      style={settingsForm.lab_mode === mode
                        ? { background: 'rgba(26,158,160,0.15)', border: '1.5px solid #1a9ea0', color: '#1a9ea0' }
                        : { background: 'transparent', borderColor: 'rgba(26,158,160,0.20)', color: '#7a93a8' }
                      }
                    >
                      {mode === 'class' ? 'Per Class' : 'Per Hour'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button type="button" onClick={() => setEditingSettings(false)}
                  className="py-3 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ background: 'rgba(26,158,160,0.06)', border: '1px solid rgba(26,158,160,0.15)', color: '#7a93a8' }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingSettings}
                  className="py-3 rounded-xl text-sm font-bold text-white cursor-pointer disabled:opacity-60 transition-all duration-200 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #1a9ea0, #0d7c80)', boxShadow: '0 4px 12px rgba(26,158,160,0.30)' }}
                >
                  {savingSettings ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ borderTop: 'none' }}>
              <InfoRow icon={<Icon.Target />} label="Target Attendance" value={user.target_attendance != null ? `${user.target_attendance}%` : null} />
              <div style={{ height: '1px', background: 'rgba(26,158,160,0.07)', margin: '0 20px' }} />
              <InfoRow icon={<Icon.Book />} label="Theory Mode" value={modeLabel(user.theory_mode)} />
              <div style={{ height: '1px', background: 'rgba(26,158,160,0.07)', margin: '0 20px' }} />
              <InfoRow icon={<Icon.Flask />} label="Lab Mode" value={modeLabel(user.lab_mode)} />
            </div>
          )}
        </motion.div>

        {/* ── 3. Personal Details Card ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, type: 'spring' as const, damping: 25 }}
          className={`rounded-3xl overflow-hidden mb-6 ${GLASS_CARD_CLASS}`}
          style={glassCard}
        >
          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(26,158,160,0.10)' }}>
            <h3 className="text-xs font-bold tracking-widest text-text-muted uppercase">Personal Details</h3>
            <button
              onClick={() => setShowEditProfile(true)}
              className="text-xs font-bold px-3 py-1 rounded-lg cursor-pointer transition-all duration-200 active:scale-95"
              style={{ background: 'rgba(26,158,160,0.10)', color: '#1a9ea0', border: '1px solid rgba(26,158,160,0.20)' }}
            >
              Edit
            </button>
          </div>

          <div>
            {[
              { icon: <Icon.Id />,       label: 'Enrollment No', value: user.enrollment_no },
              { icon: <Icon.Mail />,     label: 'Email',         value: user.email },
              { icon: <Icon.GradCap />,  label: 'Branch',        value: user.branch },
              { icon: <Icon.Building />, label: 'College',       value: user.college },
              { icon: <Icon.Calendar />, label: 'Batch',         value: user.batch },
              { icon: <Icon.Phone />,    label: 'Mobile',        value: user.mobile_no },
            ].map(({ icon, label, value }, i, arr) => (
              <div key={label}>
                <InfoRow icon={icon} label={label} value={value} />
                {i < arr.length - 1 && <div style={{ height: '1px', background: 'rgba(26,158,160,0.07)', margin: '0 20px' }} />}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Account Actions ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Change Password */}
          <button
            type="button"
            onClick={() => {
              console.log('Change Password tapped — modal coming soon')
              setShowChangePassword(true)
            }}
            className="flex items-center justify-center gap-2 font-bold py-4 rounded-2xl cursor-pointer transition-all duration-200 active:scale-95"
            style={{
              background: 'rgba(26,158,160,0.08)',
              border: '1.5px solid rgba(26,158,160,0.20)',
              color: '#1a9ea0',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="text-sm">Change Password</span>
          </button>

          {/* Log Out */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center justify-center gap-2 font-bold py-4 rounded-2xl cursor-pointer disabled:opacity-50 transition-all duration-200 active:scale-95"
            style={{
              background: 'rgba(220,38,38,0.08)',
              border: '1.5px solid rgba(220,38,38,0.20)',
              color: '#dc2626',
            }}
          >
            {loggingOut ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            )}
            <span className="text-sm">{loggingOut ? 'Signing out…' : 'Log Out'}</span>
          </button>
        </div>

        {/* ── Delete Account ───────────────────────────────────────────────── */}
        <div className="mt-8 mb-4">
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-sm cursor-pointer transition-all duration-200 active:scale-95"
            style={{
              background: 'rgba(220,38,38,0.08)',
              border: '1.5px solid rgba(220,38,38,0.20)',
              color: '#dc2626',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Delete Account
          </button>
        </div>
      </motion.main>

      <BottomNav />

      {/* Delete Account Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-xl"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Account?</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                This action is irreversible and cannot be undone. All your attendance data, subjects, and profile information will be permanently lost.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 disabled:opacity-50 cursor-pointer transition-active active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 disabled:opacity-50 cursor-pointer transition-active active:scale-95"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-24 left-1/2 bg-red-600 text-white px-5 py-3 rounded-xl shadow-lg z-[60] text-sm font-semibold max-w-[90vw] text-center"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </ProtectedRoute>
  )
}
