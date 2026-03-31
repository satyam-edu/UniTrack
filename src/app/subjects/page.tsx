'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import ProtectedRoute from '@/components/ProtectedRoute'
import AddSubjectModal from '@/components/AddSubjectModal'
import EditSubjectModal from '@/components/EditSubjectModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubjectStats {
  attended: number
  total: number
  percentage: number
}

interface Subject {
  id: string
  subject_name: string
  subject_code: string
  faculty_name: string
  type: string
  stats: SubjectStats
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHoursDiff(start: string, end: string) {
  const d1 = new Date(`1970-01-01T${start}`)
  const d2 = new Date(`1970-01-01T${end}`)
  let diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60)
  if (diff <= 0) diff = 1
  return diff
}

/** Pick a consistent pastel colour bucket for a subject's avatar */
const AVATAR_PALETTES = [
  { bg: 'rgba(26,158,160,0.15)',  color: '#1a9ea0' }, // teal
  { bg: 'rgba(139,92,246,0.15)', color: '#7c3aed' }, // violet
  { bg: 'rgba(249,115,22,0.15)', color: '#ea580c' }, // orange
  { bg: 'rgba(236,72,153,0.15)', color: '#db2777' }, // pink
  { bg: 'rgba(34,197,94,0.15)',  color: '#16a34a' }, // green
  { bg: 'rgba(59,130,246,0.15)', color: '#2563eb' }, // blue
]

function avatarColors(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length]
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

/** Inline mini progress ring — no external component needed */
function MiniRing({
  percentage,
  target,
  size = 52,
}: {
  percentage: number
  target: number
  size?: number
}) {
  const noData = isNaN(percentage) || percentage === 0
  const safe = noData ? 0 : Math.min(100, Math.max(0, percentage))
  const isHealthy = safe >= target
  const strokeW = 3.5
  const r = (size - strokeW * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (safe / 100) * circ
  const stroke = noData ? '#cbd5e1' : isHealthy ? '#16a34a' : '#dc2626'

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90 absolute inset-0 w-full h-full" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(26,158,160,0.12)" strokeWidth={strokeW} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={stroke}
          strokeWidth={strokeW}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        {noData
          ? <span className="text-[10px] font-bold text-text-muted">–%</span>
          : <span className="text-[11px] font-extrabold leading-none" style={{ color: stroke }}>
              {Math.round(safe)}%
            </span>
        }
        {/* Red dot when 0% but has data */}
        {!noData && safe === 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-danger mt-0.5" />
        )}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [targetAttendance, setTargetAttendance] = useState<number>(75)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null)

  // ── Data ─────────────────────────────────────────────────────────────────────

  const loadSubjects = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const userId = session.user.id

    const { data: userData } = await supabase
      .from('users')
      .select('target_attendance, theory_mode, lab_mode')
      .eq('id', userId)
      .single()

    if (userData?.target_attendance) setTargetAttendance(userData.target_attendance)
    const theoryMode = userData?.theory_mode || 'class'
    const labMode    = userData?.lab_mode    || 'class'

    const { data: rawSubjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (subjectsError) { setErrorMsg(`Failed to load subjects: ${subjectsError.message}`); setLoading(false); return }
    if (!rawSubjects || rawSubjects.length === 0) { setSubjects([]); setLoading(false); return }

    const { data: rawTimetable } = await supabase
      .from('timetable').select('id, subject_id, start_time, end_time').eq('user_id', userId)

    const { data: rawAttendance } = await supabase
      .from('attendance').select('timetable_id, status').eq('user_id', userId)

    const computedSubjects = rawSubjects.map((subjectRow: any) => {
      let attended = 0, total = 0
      const mode = subjectRow.type === 'Theory' ? theoryMode : labMode
      const slots = rawTimetable?.filter((t) => t.subject_id === subjectRow.id) || []

      slots.forEach((slot: any) => {
        const pv = mode === 'hour' ? getHoursDiff(slot.start_time, slot.end_time) : 1
        const records = rawAttendance?.filter((a) => a.timetable_id === slot.id) || []
        records.forEach((r: any) => {
          if (r.status === 'Present')      { attended += pv; total += pv }
          else if (r.status === 'Absent')  { total += pv }
        })
      })

      const percentage = total > 0 ? (attended / total) * 100 : 0
      return {
        ...subjectRow,
        stats: {
          attended: Number((attended || 0).toFixed(1).replace(/\.0$/, '')),
          total:    Number((total    || 0).toFixed(1).replace(/\.0$/, '')),
          percentage,
        },
      } as Subject
    })

    setSubjects(computedSubjects)
    setErrorMsg(null)
    setLoading(false)
  }, [])

  useEffect(() => { loadSubjects() }, [loadSubjects])

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Delete this subject? All timetable and attendance records will also be removed.')) return
    setDeletingId(id)
    const { error } = await supabase.from('subjects').delete().eq('id', id)
    if (!error) setSubjects((prev) => prev.filter((s) => s.id !== id))
    else alert('Failed to delete subject')
    setDeletingId(null)
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ProtectedRoute>
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
            <p className="text-sm text-text-muted">Loading subjects…</p>
          </div>
        </main>
        <BottomNav />
      </ProtectedRoute>
    )
  }

  // ── Derived counts ─────────────────────────────────────────────────────────

  const theoryCount = subjects.filter((s) => s.type === 'Theory').length
  const labCount    = subjects.filter((s) => s.type === 'Lab').length

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute>
      <motion.main
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] }}
        className="flex-1 flex flex-col px-4 py-6 pb-28 max-w-lg mx-auto w-full"
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Subjects</h1>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 text-white text-sm font-bold px-4 py-2.5 rounded-2xl cursor-pointer shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)',
              boxShadow: '0 4px 14px rgba(26,158,160,0.40)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </motion.button>
        </div>

        {/* ── Stats row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'SUBJECTS', value: subjects.length },
            { label: 'THEORY',   value: theoryCount },
            { label: 'LAB',      value: labCount },
          ].map(({ label, value }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: 'spring' as const, damping: 26, stiffness: 220 }}
              className="rounded-2xl p-4 flex flex-col items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.78)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.60)',
                boxShadow: '0 2px 12px rgba(26,158,160,0.07), 0 1px 0 rgba(255,255,255,0.9) inset',
              }}
            >
              <span className="text-2xl font-extrabold" style={{ color: '#1a9ea0' }}>{value}</span>
              <span className="text-[10px] font-bold tracking-widest text-text-muted mt-0.5">{label}</span>
            </motion.div>
          ))}
        </div>

        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {errorMsg && (
          <div
            className="rounded-2xl p-5 text-center mb-4"
            style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.20)' }}
          >
            <p className="font-semibold text-danger text-sm mb-1">Error Loading Subjects</p>
            <p className="text-danger/70 text-xs">{errorMsg}</p>
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────────────── */}
        {!errorMsg && subjects.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 rounded-3xl"
            style={{
              background: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1.5px dashed rgba(26,158,160,0.25)',
            }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(26,158,160,0.10)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-accent">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <p className="font-semibold text-foreground mb-1">No subjects yet</p>
            <p className="text-sm text-text-muted">Tap "+ Add" to create your first subject.</p>
          </motion.div>
        )}

        {/* ── Subject cards ──────────────────────────────────────────────────── */}
        {!errorMsg && subjects.length > 0 && (
          <div className="space-y-3">
            {subjects.map((subject, i) => {
              const { attended, total, percentage } = subject.stats
              const isHealthy = percentage >= targetAttendance
              const noData = total === 0
              const isExpanded = expandedId === subject.id
              const palette = avatarColors(subject.subject_name)
              const abbr = initials(subject.subject_name)

              return (
                <motion.div
                  key={subject.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, type: 'spring' as const, damping: 26, stiffness: 210 }}
                  className="rounded-2xl overflow-hidden cursor-pointer"
                  style={{
                    background: 'rgba(255,255,255,0.80)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: isExpanded
                      ? '1.5px solid rgba(26,158,160,0.35)'
                      : '1px solid rgba(255,255,255,0.60)',
                    boxShadow: isExpanded
                      ? '0 8px 28px rgba(26,158,160,0.12), 0 1px 0 rgba(255,255,255,0.9) inset'
                      : '0 2px 12px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,0.9) inset',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : subject.id)}
                >
                  {/* ── Main row ──────────────────────────────────────────── */}
                  <div className="p-4 flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: palette.bg, color: palette.color }}
                    >
                      {abbr}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base text-foreground leading-snug truncate">
                        {subject.subject_name}
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span>{subject.subject_code}</span>
                        <span className="opacity-40">·</span>
                        <span>{subject.type}</span>
                        {subject.faculty_name && (
                          <>
                            <span className="opacity-40">·</span>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 flex-shrink-0">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                              <span className="whitespace-normal break-words">{subject.faculty_name}</span>
                            </div>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Ring + chevron */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <MiniRing
                        percentage={noData ? NaN : percentage}
                        target={targetAttendance}
                        size={52}
                      />
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ type: 'spring' as const, damping: 22, stiffness: 260 }}
                        className="text-text-muted"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </motion.div>
                    </div>
                  </div>

                  {/* ── Expanded accordion ────────────────────────────────── */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        key="expanded"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring' as const, damping: 30, stiffness: 260 }}
                        style={{ overflow: 'hidden' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          className="mx-4 mb-4 p-4 rounded-2xl space-y-3"
                          style={{ background: 'rgba(26,158,160,0.05)', border: '1px solid rgba(26,158,160,0.12)' }}
                        >
                          {/* Attendance progress bar */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-text-secondary">Attendance</span>
                              <span className="text-xs font-bold" style={{ color: noData ? '#7a93a8' : isHealthy ? '#16a34a' : '#dc2626' }}>
                                {noData ? '–' : `${attended} / ${total}`}
                              </span>
                            </div>
                            {/* Bar */}
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(26,158,160,0.12)' }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${noData ? 0 : Math.min(100, percentage)}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                className="h-full rounded-full"
                                style={{ background: noData ? '#94a3b8' : isHealthy ? '#16a34a' : '#dc2626' }}
                              />
                            </div>
                          </div>

                          {/* Target line */}
                          <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                            </svg>
                            Target: <span className="font-semibold text-foreground">{targetAttendance}%</span>
                            {!noData && (
                              <span className={`ml-auto font-bold ${isHealthy ? 'text-success' : 'text-danger'}`}>
                                {isHealthy ? '✓ On track' : '✗ Below target'}
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubjectToEdit(subject);
                                setIsEditModalOpen(true);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                              style={{ background: 'rgba(26,158,160,0.12)', color: '#1a9ea0', border: '1px solid rgba(26,158,160,0.20)' }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                              </svg>
                              Edit
                            </button>

                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); handleDelete(subject.id) }}
                              disabled={deletingId === subject.id}
                              className="w-11 h-11 flex items-center justify-center rounded-xl cursor-pointer disabled:opacity-50 flex-shrink-0"
                              style={{ background: 'rgba(220,38,38,0.09)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.15)' }}
                            >
                              {deletingId === subject.id ? (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              )}
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.main>

      <BottomNav />

      {isModalOpen && (
        <AddSubjectModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { loadSubjects() }}
        />
      )}

      <AnimatePresence>
        {isEditModalOpen && subjectToEdit && (
          <EditSubjectModal
            subject={subjectToEdit}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={() => { loadSubjects() }}
          />
        )}
      </AnimatePresence>
    </ProtectedRoute>
  )
}
