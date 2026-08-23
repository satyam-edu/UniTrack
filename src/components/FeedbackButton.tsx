'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'

const FEEDBACK_EMAIL = 'live.feedback.users@gmail.com'

/**
 * Floating feedback entry point for the Profile page. Starts icon-only,
 * morphs into a labelled pill once the user has scrolled a bit (so it
 * doesn't compete with the page header, but stays discoverable while
 * reading further down). Submits to the write-only `feedback` table, with
 * a mailto fallback for anyone who'd rather email directly.
 */
export default function FeedbackButton() {
  const [morphed, setMorphed] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function onScroll() {
      setMorphed(window.scrollY > 120)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('You must be logged in.'); return }
      const { error: insertError } = await supabase.from('feedback').insert({
        user_id: session.user.id,
        message: message.trim(),
      })
      if (insertError) throw insertError
      setSubmitted(true)
      setMessage('')
      setTimeout(() => { setIsOpen(false); setSubmitted(false) }, 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <motion.button
        layout
        onClick={() => setIsOpen(true)}
        aria-label="Send feedback"
        className="fixed z-40 flex items-center gap-2 text-white font-bold cursor-pointer overflow-hidden"
        style={{
          bottom: '112px',
          right: '16px',
          borderRadius: 999,
          background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)',
          boxShadow: '0 6px 20px rgba(26,158,160,0.40)',
        }}
        animate={{ padding: morphed ? '12px 18px 12px 14px' : '12px' }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <AnimatePresence initial={false}>
          {morphed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18 }}
              className="text-sm whitespace-nowrap"
            >
              Feedback
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
            >
              {submitted ? (
                <div className="text-center py-4">
                  <p className="text-2xl mb-2">🙏</p>
                  <p className="font-bold text-slate-800">Thanks for the feedback!</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Send Feedback</h3>
                    <button type="button" onClick={() => setIsOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-700 cursor-pointer">
                      ✕
                    </button>
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What's working, what's not — tell us anything."
                    rows={4}
                    required
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !message.trim()}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)' }}
                  >
                    {submitting ? 'Sending…' : 'Send'}
                  </button>
                  <p className="text-center text-xs text-slate-400">
                    Prefer email? <a href={`mailto:${FEEDBACK_EMAIL}`} className="text-accent font-semibold hover:underline">Write to us</a> instead.
                  </p>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
