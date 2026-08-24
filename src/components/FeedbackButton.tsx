'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'

const FEEDBACK_EMAIL = 'live.feedback.users@gmail.com'
const TRIGGER_LAYOUT_ID = 'feedback-trigger'

function FeedbackIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

/**
 * Feedback entry point for the Profile page. A floating pill sits bottom-left
 * until the reserved slot between the account-action buttons scrolls into
 * view, at which point it morphs (shared layout transition) into the inline
 * button occupying that slot. Scrolling back up reverses the morph.
 */
export default function FeedbackButton() {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  // The floating trigger and the modal both use position:fixed, which needs
  // to escape this component's DOM ancestors (motion.main sets a permanent
  // `willChange: transform`, which — like an active transform — creates a
  // CSS containing block that traps position:fixed descendants inside its
  // own box instead of the viewport). Portaling to document.body sidesteps
  // that regardless of what any ancestor does with transforms.
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '0px 0px -15% 0px', threshold: 0.4 }
    )
    observer.observe(el)
    return () => observer.disconnect()
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

  const morphTransition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <>
      {/* Reserved slot in the account-actions flow; stays empty (and this
          size) while the floating button hasn't arrived here yet. */}
      <div ref={anchorRef} className="relative h-14">
        <AnimatePresence initial={false}>
          {inView && (
            <motion.button
              key="inline"
              layoutId={TRIGGER_LAYOUT_ID}
              type="button"
              onClick={() => setIsOpen(true)}
              className="absolute inset-0 w-full flex items-center justify-center gap-2.5 font-bold text-sm cursor-pointer"
              style={{
                borderRadius: 16,
                background: 'rgba(26,158,160,0.08)',
                border: '1.5px solid rgba(26,158,160,0.20)',
                color: '#1a9ea0',
              }}
              transition={morphTransition}
            >
              <FeedbackIcon />
              Send Feedback
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {mounted && createPortal(
        <AnimatePresence initial={false}>
          {!inView && (
            <motion.button
              key="floating"
              layoutId={TRIGGER_LAYOUT_ID}
              type="button"
              onClick={() => setIsOpen(true)}
              aria-label="Send feedback"
              className="fixed z-40 flex items-center justify-center text-white cursor-pointer"
              style={{
                bottom: 112,
                left: 16,
                width: 56,
                height: 56,
                borderRadius: 999,
                background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)',
                boxShadow: '0 6px 20px rgba(26,158,160,0.40)',
              }}
              transition={morphTransition}
            >
              <FeedbackIcon size={20} />
            </motion.button>
          )}
        </AnimatePresence>,
        document.body
      )}

      {mounted && createPortal(
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
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
