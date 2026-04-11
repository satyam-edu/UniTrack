'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import ProtectedRoute from '@/components/ProtectedRoute'
import EditSubjectModal from '@/components/EditSubjectModal'
import SubjectStatsDetail from '@/components/SubjectStatsDetail'

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
  recentDates: string[]     // last 10 'Present' dates, newest first
  scheduledDays: string[]   // unique timetable days, e.g. ['Monday', 'Wednesday']
}

type ViewMode = 'list' | 'grid'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_PALETTES = [
  { bg: 'rgba(20,184,166,0.12)',  color: '#0f766e' },
  { bg: 'rgba(139,92,246,0.12)', color: '#7c3aed' },
  { bg: 'rgba(249,115,22,0.12)', color: '#ea580c' },
  { bg: 'rgba(236,72,153,0.12)', color: '#db2777' },
  { bg: 'rgba(34,197,94,0.12)',  color: '#16a34a' },
  { bg: 'rgba(59,130,246,0.12)', color: '#2563eb' },
]

function avatarColors(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length]
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-3xl p-4 flex items-center gap-3 animate-pulse bg-white border border-slate-200/60">
      <div className="w-11 h-11 rounded-full flex-shrink-0 bg-slate-100" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 rounded-full w-2/3 bg-slate-100" />
        <div className="h-2.5 rounded-full w-1/2 bg-slate-100" />
      </div>
      <div className="w-12 h-12 rounded-full flex-shrink-0 bg-slate-100" />
    </div>
  )
}

// ─── View-mode icon buttons ───────────────────────────────────────────────────

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/60">
      <button
        onClick={() => onChange('list')}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
          mode === 'list' ? 'bg-white text-teal-600 border border-slate-200/80' : 'text-slate-400 hover:text-slate-600'
        }`}
        aria-label="List view"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
      <button
        onClick={() => onChange('grid')}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
          mode === 'grid' ? 'bg-white text-teal-600 border border-slate-200/80' : 'text-slate-400 hover:text-slate-600'
        }`}
        aria-label="Grid view"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>
    </div>
  )
}

// ─── Grid Subject Modal ───────────────────────────────────────────────────────

function GridSubjectModal({
  subject,
  targetAttendance,
  onClose,
  onEdit,
  onDelete,
  deletingId,
}: {
  subject: Subject
  targetAttendance: number
  onClose: () => void
  onEdit: () => void
  onDelete: (id: string) => void
  deletingId: string | null
}) {
  const palette = avatarColors(subject.subject_name)
  const abbr    = initials(subject.subject_name)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200/60 overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: palette.bg, color: palette.color }}>
            {abbr}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-base leading-tight line-clamp-2">{subject.subject_name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">{subject.subject_code}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${subject.type === 'Lab' ? 'bg-purple-50 text-purple-700' : 'bg-teal-50 text-teal-700'}`}>
                {subject.type}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Stats */}
        <div className="overflow-y-auto px-5 py-4">
          <SubjectStatsDetail
            stats={subject.stats}
            targetAttendance={targetAttendance}
            recentDates={subject.recentDates}
            scheduledDays={subject.scheduledDays}
            compact
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-slate-100">
          <button
            onClick={onEdit}
            className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 cursor-pointer transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(subject.id)}
            disabled={deletingId === subject.id}
            className="w-11 h-10 flex items-center justify-center rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {deletingId === subject.id ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubjectsPage() {
  const [subjects, setSubjects]         = useState<Subject[]>([])
  const [loading, setLoading]           = useState(true)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [targetAttendance, setTarget]   = useState<number>(75)
  const [errorMsg, setErrorMsg]         = useState<string | null>(null)
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [isEditModalOpen, setEditOpen]  = useState(false)
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null)
  const [viewMode, setViewMode]         = useState<ViewMode>('list')
  const [gridSelected, setGridSelected] = useState<Subject | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const loadSubjects = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const userId = session.user.id

    const { data: profile } = await supabase
      .from('users').select('target_attendance').eq('id', userId).single()
    if (profile?.target_attendance) setTarget(profile.target_attendance)

    const { data: subjectsData, error: subjectsError } = await supabase
      .from('subjects')
      .select('id, subject_name, subject_code, faculty_name, type')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (subjectsError) { setErrorMsg(subjectsError.message); setLoading(false); return }
    if (!subjectsData || subjectsData.length === 0) { setSubjects([]); setLoading(false); return }

    const { data: attendance } = await supabase
      .from('attendance')
      .select('subject_id, status, date')
      .eq('user_id', userId)

    const { data: timetable } = await supabase
      .from('timetable')
      .select('subject_id, day_of_week')
      .eq('user_id', userId)

    const DAY_ORDER: Record<string, number> = {
      Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4,
      Friday: 5, Saturday: 6, Sunday: 7,
    }

    const enriched: Subject[] = subjectsData.map((sub) => {
      const records = (attendance || []).filter((a: any) => a.subject_id === sub.id)
      const present  = records.filter((r: any) => r.status === 'Present').length
      const absent   = records.filter((r: any) => r.status === 'Absent').length
      const total    = present + absent
      const percentage = total > 0 ? (present / total) * 100 : 0

      const recentDates = records
        .filter((r: any) => r.status === 'Present' && r.date)
        .map((r: any) => r.date as string)
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 10)

      const scheduledDays = Array.from(
        new Set(
          (timetable || [])
            .filter((t: any) => t.subject_id === sub.id)
            .map((t: any) => t.day_of_week as string)
        )
      ).sort((a, b) => (DAY_ORDER[a] ?? 99) - (DAY_ORDER[b] ?? 99))

      return {
        id:           sub.id,
        subject_name: sub.subject_name,
        subject_code: sub.subject_code,
        faculty_name: sub.faculty_name ?? '',
        type:         sub.type,
        stats:        { attended: present, total, percentage },
        recentDates,
        scheduledDays,
      }
    })

    setSubjects(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { loadSubjects() }, [loadSubjects])

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Delete this subject and all its attendance records?')) return
    setDeletingId(id)
    const { error } = await supabase.from('subjects').delete().eq('id', id)
    if (error) { alert(`Failed to delete: ${error.message}`); setDeletingId(null); return }
    setSubjects((prev) => prev.filter((s) => s.id !== id))
    if (expandedId === id) setExpandedId(null)
    if (gridSelected?.id === id) setGridSelected(null)
    setDeletingId(null)
  }

  const theoryCount = subjects.filter((s) => s.type === 'Theory').length
  const labCount    = subjects.filter((s) => s.type === 'Lab').length

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <ProtectedRoute>
        <main className="flex-1 flex flex-col px-4 py-6 pb-32 max-w-lg mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Subjects</h1>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[0,1,2].map((i) => <div key={i} className="rounded-3xl h-16 animate-pulse bg-white border border-slate-200/60" />)}
          </div>
          <div className="space-y-3">{[0,1,2,3].map((i) => <SkeletonCard key={i} />)}</div>
        </main>
        <BottomNav />
      </ProtectedRoute>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute>
      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] }}
        className="flex-1 flex flex-col px-4 py-6 pb-32 max-w-lg mx-auto w-full"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Subjects</h1>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
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
              transition={{ delay: i * 0.06, type: 'spring' as const, damping: 25 }}
              className="rounded-3xl p-4 flex flex-col items-center justify-center bg-white border border-slate-200/60"
            >
              <span className="text-2xl font-bold text-teal-500">{value}</span>
              <span className="text-[10px] font-bold tracking-widest text-slate-400 mt-0.5">{label}</span>
            </motion.div>
          ))}
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {errorMsg && (
          <div className="rounded-3xl p-5 mb-4 bg-red-50 border border-red-100">
            <p className="font-semibold text-red-600 text-sm mb-1">Error Loading Subjects</p>
            <p className="text-red-400 text-xs">{errorMsg}</p>
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!errorMsg && subjects.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 rounded-3xl bg-white border border-dashed border-teal-300/50"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-teal-50">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <p className="font-semibold text-slate-700 mb-1">No subjects yet</p>
            <p className="text-sm text-slate-400">Go to Timetable to add your first subject.</p>
          </motion.div>
        )}

        {/* ── LIST VIEW ───────────────────────────────────────────────────── */}
        {!errorMsg && subjects.length > 0 && viewMode === 'list' && (
          <div className="space-y-3">
            {subjects.map((subject, i) => {
              const isExpanded = expandedId === subject.id
              const palette    = avatarColors(subject.subject_name)
              const abbr       = initials(subject.subject_name)

              return (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, type: 'spring' as const, damping: 25 }}
                  className="rounded-3xl overflow-hidden bg-white border border-slate-200/60 cursor-pointer active:scale-[0.99] transition-transform"
                  style={{ borderColor: isExpanded ? 'rgba(20,184,166,0.35)' : undefined }}
                  onClick={() => setExpandedId(isExpanded ? null : subject.id)}
                >
                  {/* Main row */}
                  <div className="p-4 flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: palette.bg, color: palette.color }}>
                      {abbr}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 leading-tight line-clamp-2">{subject.subject_name}</h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">{subject.subject_code}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${subject.type === 'Lab' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                          {subject.type}
                        </span>
                        {subject.faculty_name && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{subject.faculty_name}</span>
                        )}
                      </div>
                    </div>

                    {/* Percentage + chevron */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="text-sm font-extrabold"
                        style={{ color: subject.stats.total === 0 ? '#94a3b8' : subject.stats.percentage >= targetAttendance ? '#16a34a' : '#ef4444' }}
                      >
                        {subject.stats.total === 0 ? '–' : `${Math.round(subject.stats.percentage)}%`}
                      </span>
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ type: 'spring' as const, damping: 22, stiffness: 260 }}
                        className="text-slate-400"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </motion.div>
                    </div>
                  </div>

                  {/* Accordion: stats + actions */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        key="expanded"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="mx-4 mb-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-4">
                          <SubjectStatsDetail
                            stats={subject.stats}
                            targetAttendance={targetAttendance}
                            recentDates={subject.recentDates}
                            scheduledDays={subject.scheduledDays}
                          />

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSubjectToEdit(subject); setEditOpen(true) }}
                              className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 cursor-pointer transition-colors"
                            >
                              Edit Subject
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(subject.id) }}
                              disabled={deletingId === subject.id}
                              className="w-11 h-10 flex items-center justify-center rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer disabled:opacity-50 transition-colors flex-shrink-0"
                            >
                              {deletingId === subject.id ? (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              )}
                            </button>
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

        {/* ── GRID VIEW ───────────────────────────────────────────────────── */}
        {!errorMsg && subjects.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-2 gap-3">
            {subjects.map((subject, i) => {
              const palette = avatarColors(subject.subject_name)
              const abbr    = initials(subject.subject_name)
              const { percentage, total } = subject.stats
              const noData   = total === 0
              const healthy  = percentage >= targetAttendance
              const pctColor = noData ? '#94a3b8' : healthy ? '#16a34a' : '#ef4444'

              return (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04, type: 'spring' as const, damping: 25 }}
                  className="rounded-3xl p-4 bg-white border border-slate-200/60 cursor-pointer active:scale-[0.97] transition-transform flex flex-col gap-3"
                  onClick={() => setGridSelected(subject)}
                >
                  {/* Avatar + percentage */}
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs flex-shrink-0"
                      style={{ background: palette.bg, color: palette.color }}>
                      {abbr}
                    </div>
                    <span className="text-base font-extrabold" style={{ color: pctColor }}>
                      {noData ? '–' : `${Math.round(percentage)}%`}
                    </span>
                  </div>

                  {/* Name + badges */}
                  <div>
                    <p className="font-bold text-sm text-slate-900 leading-tight line-clamp-2 mb-1.5">{subject.subject_name}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">{subject.subject_code}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${subject.type === 'Lab' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                        {subject.type}
                      </span>
                    </div>
                  </div>

                  {/* Mini attendance bar */}
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${noData ? 0 : Math.min(100, percentage)}%`, background: pctColor }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.main>

      <BottomNav />

      {/* Grid modal */}
      <AnimatePresence>
        {gridSelected && (
          <GridSubjectModal
            subject={gridSelected}
            targetAttendance={targetAttendance}
            onClose={() => setGridSelected(null)}
            onEdit={() => { setSubjectToEdit(gridSelected); setEditOpen(true); setGridSelected(null) }}
            onDelete={async (id) => { await handleDelete(id); setGridSelected(null) }}
            deletingId={deletingId}
          />
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {isEditModalOpen && subjectToEdit && (
          <EditSubjectModal
            subject={subjectToEdit}
            onClose={() => setEditOpen(false)}
            onSuccess={() => { setEditOpen(false); loadSubjects() }}
            existingSubjects={subjects}
          />
        )}
      </AnimatePresence>
    </ProtectedRoute>
  )
}
