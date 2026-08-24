'use client'

import { motion, AnimatePresence } from 'motion/react'

interface Props {
  isOpen: boolean
  onClose: () => void
  url: string
  mimeType: string
  fileName?: string
}

/** Full-screen viewer for the original timetable image/PDF, so a student can cross-check the AI's read against the source. */
export default function SourceLightbox({ isOpen, onClose, url, mimeType, fileName }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex flex-col bg-black/90"
          onClick={onClose}
        >
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <p className="text-sm font-semibold text-white/80 truncate">{fileName || 'Original timetable'}</p>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-colors flex-shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0 px-2 pb-2" onClick={(e) => e.stopPropagation()}>
            {mimeType === 'application/pdf' ? (
              <iframe src={url} title={fileName || 'Original timetable'} className="w-full h-full rounded-lg bg-white" />
            ) : (
              <img src={url} alt={fileName || 'Original timetable'} className="w-full h-full object-contain" />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
