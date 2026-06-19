'use client'

import { motion } from 'motion/react'

interface SlotPreview {
  group_designation?: string | null
  subject: { subject_name: string }
}

interface GroupOnboardingModalProps {
  groups: string[]
  onSelect: (group: string) => void
  schedule?: Record<string, SlotPreview[]>
}

function getGroupSubjects(group: string, schedule: Record<string, SlotPreview[]>): string[] {
  const seen = new Set<string>()
  for (const slots of Object.values(schedule)) {
    for (const slot of slots) {
      const g = (slot.group_designation ?? 'ALL').toUpperCase()
      if (g === group.toUpperCase()) {
        seen.add(slot.subject.subject_name)
      }
    }
  }
  return Array.from(seen).slice(0, 3)
}

export default function GroupOnboardingModal({ groups, onSelect, schedule }: GroupOnboardingModalProps) {
  const hasPreview = !!schedule && Object.keys(schedule).length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 backdrop-blur-sm bg-black/20"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="w-full max-w-sm rounded-3xl bg-white p-6 border border-slate-200/60"
        style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 4px 12px rgba(26,158,160,0.10)' }}
      >
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(26,158,160,0.12)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a9ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>

        {/* Title + subtitle */}
        <h2 className="text-xl font-extrabold tracking-tight text-foreground mb-1.5">
          Which batch are you in?
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed mb-5">
          Your timetable has parallel batches — different groups have different labs at the same time.
          {hasPreview ? ' Pick your group by recognizing your classes below.' : ' Select your group to filter your personal schedule.'}
        </p>

        {/* Group cards */}
        <div className="flex flex-col gap-2.5 mb-3">
          {groups.map((group) => {
            const subjects = hasPreview ? getGroupSubjects(group, schedule!) : []
            return (
              <motion.button
                key={group}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(group)}
                className="w-full p-4 rounded-2xl text-left border-2 cursor-pointer transition-all"
                style={{
                  borderColor: 'rgba(26,158,160,0.30)',
                  background: 'rgba(26,158,160,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(26,158,160,0.65)'
                  e.currentTarget.style.background = 'rgba(26,158,160,0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(26,158,160,0.30)'
                  e.currentTarget.style.background = 'rgba(26,158,160,0.04)'
                }}
              >
                <span
                  className="inline-block text-xs font-bold px-2.5 py-1 rounded-lg mb-2"
                  style={{ background: 'rgba(26,158,160,0.12)', color: '#0d7c80' }}
                >
                  Group {group}
                </span>
                {subjects.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {subjects.map((name) => (
                      <span
                        key={name}
                        className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md"
                      >
                        {name.length > 28 ? name.slice(0, 28) + '…' : name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Tap to select this group</p>
                )}
              </motion.button>
            )
          })}
        </div>

        {/* Fallback: no group */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelect('ALL')}
          className="w-full py-3 rounded-2xl text-sm font-semibold text-text-secondary bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          Show all classes (no filter)
        </motion.button>
      </motion.div>
    </div>
  )
}
