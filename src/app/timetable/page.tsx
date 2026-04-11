'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import ProtectedRoute from '@/components/ProtectedRoute'
import AddClassModal from '@/components/AddClassModal'
import EditClassModal from '@/components/EditClassModal'
import ScheduleClassModal from '@/components/ScheduleClassModal'
import UploadTimetableModal from '@/components/UploadTimetableModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimetableSlot {
  id: string
  subject_id: string
  day_of_week: string
  start_time: string
  end_time: string
  room_location?: string | null
  subject: {
    subject_name: string
    subject_code: string
    type: string
    faculty_name?: string
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = [
  { full: 'Monday',    short: 'Mon' },
  { full: 'Tuesday',   short: 'Tue' },
  { full: 'Wednesday', short: 'Wed' },
  { full: 'Thursday',  short: 'Thu' },
  { full: 'Friday',    short: 'Fri' },
  { full: 'Saturday',  short: 'Sat' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(timeStr: string) {
  return new Date(`1970-01-01T${timeStr}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// ─── Dummy Data Initialization ────────────────────────────────────────────────

const DUMMY_SCHEDULE: Record<string, TimetableSlot[]> = {
  Monday: [
    {
      id: 'dummy-1', subject_id: 'sub-1', day_of_week: 'Monday',
      start_time: '09:00:00', end_time: '10:00:00', room_location: 'Room 402, Block A',
      subject: { subject_name: 'Data Structures and Algorithms', subject_code: 'CS201', type: 'Theory' }
    },
    {
      id: 'dummy-2', subject_id: 'sub-2', day_of_week: 'Monday',
      start_time: '10:00:00', end_time: '11:00:00', room_location: 'Room 405, Block A',
      subject: { subject_name: 'Database Management Systems', subject_code: 'CS202', type: 'Theory' }
    },
    {
      id: 'dummy-3', subject_id: 'sub-3', day_of_week: 'Monday',
      start_time: '11:00:00', end_time: '13:00:00', room_location: 'Lab 2, Block C',
      subject: { subject_name: 'Computer Networks', subject_code: 'CS203', type: 'Lab' }
    }
  ]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimetablePage() {
  const [schedule, setSchedule] = useState<Record<string, TimetableSlot[]>>(DUMMY_SCHEDULE)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string>('Monday')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [classToEdit, setClassToEdit] = useState<TimetableSlot | null>(null)
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadTimetable = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data, error } = await supabase
      .from('timetable')
      .select('id, subject_id, day_of_week, start_time, end_time, room_location, subject:subjects(subject_name, subject_code, type, faculty_name)')
      .eq('user_id', session.user.id)
      .order('start_time', { ascending: true })

    if (error || !data) return

    const grouped: Record<string, TimetableSlot[]> = {}
    data.forEach((slot: any) => {
      if (!grouped[slot.day_of_week]) grouped[slot.day_of_week] = []
      grouped[slot.day_of_week].push(slot as TimetableSlot)
    })

    setSchedule(grouped)
  }, [])

  useEffect(() => { loadTimetable() }, [loadTimetable])

  // ── Action menu handlers ──────────────────────────────────────────────────────

  function handleUploadTimetable() {
    setIsActionMenuOpen(false)
    setIsUploadModalOpen(true)
  }

  function handleAddManually() {
    setIsActionMenuOpen(false)
    setIsModalOpen(true)
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Delete this class slot?')) return
    setDeletingId(id)
    const { error } = await supabase.from('timetable').delete().eq('id', id)
    if (!error) {
      setSchedule((prev) => {
        const next = { ...prev }
        for (const day of Object.keys(next)) {
          next[day] = next[day].filter((s) => s.id !== id)
          if (next[day].length === 0) delete next[day]
        }
        return next
      })
    }
    setDeletingId(null)
  }

  // ── Loading state rendered inline — no full-page gate
  const slotsForDay = schedule[selectedDay] ?? []

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute>
      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] }}
        className="flex-1 flex flex-col px-4 py-6 pb-28 max-w-lg mx-auto w-full"
        style={{ willChange: 'opacity, transform' }}
      >

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Timetable</h1>

          {/* ── Add button + dropdown ─────────────────────────────────────────── */}
          <div ref={actionMenuRef} className="relative">
            <motion.button
              id="timetable-add-btn"
              onClick={() => setIsActionMenuOpen((o) => !o)}
              whileTap={{ scale: 0.93 }}
              className="flex items-center gap-1.5 text-white text-sm font-bold px-4 py-2.5 rounded-2xl cursor-pointer shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)',
                boxShadow: '0 4px 14px rgba(26,158,160,0.40)',
              }}
            >
              <motion.svg
                width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.8"
                strokeLinecap="round" strokeLinejoin="round"
                animate={{ rotate: isActionMenuOpen ? 45 : 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </motion.svg>
              Add
            </motion.button>

            {/* ── Action dropdown ───────────────────────────────────────────── */}
            <AnimatePresence>
              {isActionMenuOpen && (
                <>
                  {/* Invisible backdrop to close on outside click */}
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsActionMenuOpen(false)}
                  />

                  <motion.div
                    id="timetable-action-menu"
                    initial={{ opacity: 0, scale: 0.92, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -6 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="absolute right-0 top-full mt-2 z-40 w-56 rounded-2xl overflow-hidden"
                    style={{
                      background: 'rgba(255,255,255,0.88)',
                      backdropFilter: 'blur(24px)',
                      WebkitBackdropFilter: 'blur(24px)',
                      border: '1px solid rgba(255,255,255,0.70)',
                      boxShadow: '0 12px 36px rgba(0,0,0,0.12), 0 2px 8px rgba(26,158,160,0.10)',
                    }}
                  >
                    {/* Upload Timetable */}
                    <button
                      id="action-upload-timetable"
                      onClick={handleUploadTimetable}
                      className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-teal-50/80 transition-colors cursor-pointer border-b border-slate-100/80"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(26,158,160,0.12)' }}
                      >
                        {/* Sparkles / magic icon */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
                          <path d="M5 18l1 2 2-1-1-2-2 1z"/>
                          <path d="M19 15l1 2 2-1-1-2-2 1z"/>
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-700 leading-snug">Upload Timetable</p>
                        <p className="text-xs text-slate-400 mt-0.5">Auto-extract from image</p>
                      </div>
                    </button>

                    {/* Add Manually */}
                    <button
                      id="action-add-manually"
                      onClick={handleAddManually}
                      className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-teal-50/80 transition-colors cursor-pointer"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(100,116,139,0.10)' }}
                      >
                        {/* Pen icon */}
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9"/>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-700 leading-snug">Add Manually</p>
                        <p className="text-xs text-slate-400 mt-0.5">Enter details yourself</p>
                      </div>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Day Selector ───────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-1 mb-6 p-1.5 rounded-2xl overflow-x-auto scrollbar-hide bg-white border border-slate-200/60"
        >
          {DAYS.map(({ full, short }) => {
            const isActive = selectedDay === full
            const hasSlots = (schedule[full]?.length ?? 0) > 0

            return (
              <button
                key={full}
                onClick={() => setSelectedDay(full)}
                className="relative flex-1 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap min-w-[44px] flex flex-col items-center gap-0.5"
                style={{ color: isActive ? '#fff' : '#64748b' }}
              >
                {/* Animated pill background */}
                {isActive && (
                  <motion.div
                    layoutId="activeDay"
                    className="absolute inset-0 rounded-full bg-teal-500"
                    style={{ boxShadow: '0 4px 14px rgba(20,184,166,0.35)' }}
                    transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                  />
                )}
                <span className="relative z-10 text-xs font-bold">{short}</span>
                {/* Dot indicator for days with classes */}
                {hasSlots && !isActive && (
                  <span className="relative z-10 w-1 h-1 rounded-full" style={{ background: '#1a9ea0' }} />
                )}
                {hasSlots && isActive && (
                  <span className="relative z-10 w-1 h-1 rounded-full bg-white/60" />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Timeline + Cards ──────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {slotsForDay.length === 0 ? (
            <motion.div
              key={`empty-${selectedDay}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center justify-center py-16 rounded-3xl mt-4 bg-white border border-dashed border-teal-300/50"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(26,158,160,0.10)' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-accent">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <p className="font-semibold text-foreground mb-3">No classes on {selectedDay}</p>
              <button
                onClick={() => setIsScheduleModalOpen(true)}
                className="bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-accent-glow cursor-pointer transition-colors"
              >
                + Schedule Class
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={`slots-${selectedDay}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              {/* Vertical timeline line */}
              <div
                className="absolute left-[9px] top-3 bottom-3 w-px"
                style={{
                  background: 'linear-gradient(to bottom, rgba(26,158,160,0.50), rgba(26,158,160,0.10))',
                }}
              />

              <div className="space-y-4">
                {slotsForDay.map((slot, i) => (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: i * 0.06,
                      type: 'spring' as const,
                      damping: 25,
                    }}
                    className="flex gap-4 items-start"
                    style={{ willChange: 'transform, opacity' }}
                  >
                    {/* Timeline dot */}
                    <div className="flex-shrink-0 mt-3.5 z-10">
                      <div
                        className="w-[18px] h-[18px] rounded-full border-2 border-white flex items-center justify-center"
                        style={{
                          background: '#1a9ea0',
                          boxShadow: '0 0 0 3px rgba(26,158,160,0.20)',
                        }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    </div>

                    {/* Glass card */}
                    <div
                      className="flex-1 rounded-3xl overflow-hidden bg-white border border-slate-200/60"
                      style={{ borderLeft: slot.subject.type === 'Lab' ? '4px solid #a855f7' : '4px solid #14b8a6' }}
                    >
                      <div className="p-4 flex items-start justify-between gap-3">
                        {/* Left: Subject info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base text-foreground mb-1.5 truncate">
                            {slot.subject.subject_name}
                          </h3>

                          {/* Badges row */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-600">
                              {slot.subject.subject_code}
                            </span>
                            <span
                              className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                              style={slot.subject.type === 'Lab'
                                ? { background: 'rgba(168,85,247,0.10)', color: '#7c3aed' }
                                : { background: 'rgba(20,184,166,0.10)', color: '#0d9488' }
                              }
                            >
                              {slot.subject.type}
                            </span>
                          </div>

                          {/* Time */}
                          <p className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                          </p>

                          {/* Room location (optional) */}
                          {slot.room_location && (
                            <p className="text-xs text-text-muted mt-1 flex items-center gap-1.5">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              <span className="truncate">{slot.room_location}</span>
                            </p>
                          )}
                        </div>

                        {/* Right: Edit + Delete */}
                        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                          <button
                            onClick={() => {
                              setClassToEdit(slot);
                              setIsEditModalOpen(true);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors cursor-pointer"
                            style={{
                              background: 'rgba(26,158,160,0.08)',
                              color: '#1a9ea0',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </button>

                          <motion.button
                            whileTap={{ scale: 0.88 }}
                            onClick={() => handleDelete(slot.id)}
                            disabled={deletingId === slot.id}
                            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                            style={{
                              background: 'rgba(220,38,38,0.08)',
                              color: '#dc2626',
                            }}
                          >
                            {deletingId === slot.id ? (
                              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            )}
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              {/* Inline Add Class Button */}
              <div className="ml-[34px] mt-6">
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="w-full border-2 border-dashed border-slate-200/80 bg-white text-slate-400 rounded-2xl py-3 text-sm font-medium hover:bg-slate-50 hover:text-teal-600 hover:border-teal-300/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add class to {selectedDay}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>

      <BottomNav />

      {isModalOpen && (
        <AddClassModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { loadTimetable() }}
        />
      )}

      {isScheduleModalOpen && (
        <ScheduleClassModal
          activeDay={selectedDay}
          onClose={() => setIsScheduleModalOpen(false)}
          onSuccess={() => { loadTimetable() }}
        />
      )}

      <AnimatePresence>
        {isEditModalOpen && classToEdit && (
          <EditClassModal
            slot={classToEdit}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={() => { loadTimetable() }}
          />
        )}
      </AnimatePresence>

      {isUploadModalOpen && (
        <UploadTimetableModal onClose={() => setIsUploadModalOpen(false)} />
      )}
    </ProtectedRoute>
  )
}
