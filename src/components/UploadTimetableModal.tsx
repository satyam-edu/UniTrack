'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useRouter } from 'next/navigation'
import { parseTimetableImage, importConfirmedSchedule } from '@/app/actions/extractTimetable'
import type { ExtractedClass } from '@/app/actions/extractTimetable'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error'
interface Toast { message: string; type: ToastType }

interface Props { onClose: () => void }

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const CATEGORIES = ['Theory', 'Lab', null]

// ── Component ─────────────────────────────────────────────────────────────────

export default function UploadTimetableModal({ onClose }: Props) {
  const router = useRouter()
  const overlayRef  = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── View state ────────────────────────────────────────────────────────────
  const [file, setFile]               = useState<File | null>(null)
  const [isDragging, setIsDragging]   = useState(false)
  const [isParsing, setIsParsing]     = useState(false)   // Gemini in flight
  const [isImporting, setIsImporting] = useState(false)   // DB write in flight
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const [toast, setToast]             = useState<Toast | null>(null)

  // ── Review state ──────────────────────────────────────────────────────────
  const [extractedData, setExtractedData] = useState<ExtractedClass[] | null>(null)
  const [editingIndex, setEditingIndex]   = useState<number | null>(null)

  const isLoading = isParsing || isImporting
  const isReviewMode = extractedData !== null

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isLoading) {
        if (editingIndex !== null) { setEditingIndex(null); return }
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, isLoading, editingIndex])

  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [file])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // ── File handlers ─────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0])
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    if (['image/png', 'image/jpeg', 'application/pdf'].includes(f.type)) {
      setFile(f)
    } else {
      setToast({ message: 'Unsupported file type. Please upload PNG, JPEG, or PDF.', type: 'error' })
    }
  }

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Action 1: Parse with Gemini ───────────────────────────────────────────

  const handleParse = async () => {
    if (!file) return
    setIsParsing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) formData.append('token', session.access_token)

      const result = await parseTimetableImage(formData)
      if (result.success) {
        setExtractedData(result.classes)
      } else {
        setToast({ message: result.error, type: 'error' })
      }
    } catch (err: any) {
      setToast({ message: err?.message || 'Something went wrong. Please try again.', type: 'error' })
    } finally {
      setIsParsing(false)
    }
  }

  // ── Action 2: Confirm & import ────────────────────────────────────────────

  const handleImport = async () => {
    if (!extractedData) return
    setIsImporting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Session expired. Please log in again.')

      const result = await importConfirmedSchedule(extractedData, session.access_token)
      if (result.success) {
        setToast({ message: `${result.count} class${result.count !== 1 ? 'es' : ''} added to your schedule!`, type: 'success' })
        setTimeout(() => { router.refresh(); onClose() }, 1200)
      } else {
        setToast({ message: result.error, type: 'error' })
      }
    } catch (err: any) {
      setToast({ message: err?.message || 'Import failed. Please try again.', type: 'error' })
    } finally {
      setIsImporting(false)
    }
  }

  // ── Inline edit helpers ───────────────────────────────────────────────────

  const updateClass = (index: number, field: keyof ExtractedClass, value: string | null) => {
    setExtractedData(prev =>
      prev ? prev.map((c, i) => i === index ? { ...c, [field]: value } : c) : prev
    )
  }

  const removeClass = (index: number) => {
    setExtractedData(prev => {
      if (!prev) return prev
      const next = prev.filter((_, i) => i !== index)
      return next.length === 0 ? null : next
    })
    if (editingIndex === index) setEditingIndex(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        ref={overlayRef}
        onClick={(e) => { if (e.target === overlayRef.current && !isLoading) onClose() }}
        className="fixed inset-0 z-[50] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="w-full sm:max-w-lg bg-white shadow-2xl text-slate-800 rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
          style={{ maxHeight: '92vh' }}
        >
          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                {isReviewMode ? 'Review Extracted Schedule' : 'Upload Timetable'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isReviewMode
                  ? `${extractedData!.length} class${extractedData!.length !== 1 ? 'es' : ''} detected · Edit before importing`
                  : 'AI-powered extraction · V2.0'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isReviewMode && !isImporting && (
                <button
                  onClick={() => { setExtractedData(null); setEditingIndex(null) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                  style={{ background: 'rgba(26,158,160,0.08)', color: '#1a9ea0', border: '1px solid rgba(26,158,160,0.20)' }}
                >
                  ← Re-upload
                </button>
              )}
              <button
                onClick={onClose}
                disabled={isLoading}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <AnimatePresence mode="wait" initial={false}>
            {!isReviewMode ? (
              /* ── Upload View ─────────────────────────────────────────── */
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="px-5 pb-5 pt-4 flex flex-col gap-4"
              >
                {/* Drop zone */}
                <div
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
                  className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    isLoading
                      ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
                      : isDragging
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-teal-400/50 bg-teal-50/50 hover:bg-teal-50 hover:border-teal-500'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/png, image/jpeg, application/pdf"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isLoading}
                  />

                  {file ? (
                    <div className="relative flex flex-col items-center">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="w-20 h-20 object-cover rounded-xl shadow-sm border border-slate-200 mb-2.5" />
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center bg-slate-100 rounded-xl border border-slate-200 mb-2.5">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                      )}
                      <p className="text-sm font-semibold text-slate-700 truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB · {file.type.split('/')[1].toUpperCase()}</p>
                      {!isLoading && (
                        <button onClick={clearFile} aria-label="Remove file"
                          className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors shadow-sm">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center pointer-events-none">
                      <svg className="w-9 h-9 mb-2.5" style={{ color: '#1a9ea0' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-sm text-slate-600 font-medium">Drag & drop or click to browse</p>
                      <p className="text-xs text-slate-400 mt-1">PNG · JPEG · PDF</p>
                    </div>
                  )}
                </div>

                {/* ⚠️ Overwrite warning */}
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-2xl bg-amber-50 border border-amber-200/70">
                  <span className="text-amber-500 text-base leading-none mt-0.5 flex-shrink-0">⚠️</span>
                  <p className="text-xs text-amber-700 font-medium leading-snug">
                    <strong>Importing will overwrite your entire existing schedule.</strong> All current subjects and timetable slots will be permanently replaced.
                  </p>
                </div>

                {/* CTA buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={onClose} disabled={isLoading}
                    className="py-3 rounded-xl font-semibold text-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                    Cancel
                  </button>
                  <button onClick={handleParse} disabled={!file || isLoading}
                    className="py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)', boxShadow: '0 4px 12px rgba(26,158,160,0.30)' }}>
                    {isParsing ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analyzing…
                      </span>
                    ) : '✨ Extract Schedule'}
                  </button>
                </div>
              </motion.div>
            ) : (
              /* ── Review View ─────────────────────────────────────────── */
              <motion.div
                key="review"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col min-h-0 flex-1"
              >
                {/* Scrollable list */}
                <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2" style={{ maxHeight: '52vh' }}>
                  {extractedData!.map((cls, i) => (
                    <div key={i}
                      className="rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden transition-shadow"
                      style={{ boxShadow: editingIndex === i ? '0 0 0 2px #1a9ea0' : undefined }}
                    >
                      {editingIndex === i ? (
                        /* ── Expanded edit form ───────────────────────── */
                        <div className="p-3 space-y-2.5">
                          {/* Subject name */}
                          <div>
                            <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1 block">Subject Name</label>
                            <input
                              value={cls.subject_name}
                              onChange={e => updateClass(i, 'subject_name', e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                            />
                          </div>
                          {/* Code + Category row */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1 block">Code</label>
                              <input
                                value={cls.subject_code ?? ''}
                                onChange={e => updateClass(i, 'subject_code', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1 block">Category</label>
                              <select
                                value={cls.category ?? ''}
                                onChange={e => updateClass(i, 'category', e.target.value || null)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                              >
                                <option value="">—</option>
                                <option value="Theory">Theory</option>
                                <option value="Lab">Lab</option>
                              </select>
                            </div>
                          </div>
                          {/* Day + Times row */}
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1 block">Day</label>
                              <select
                                value={cls.day}
                                onChange={e => updateClass(i, 'day', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                              >
                                {DAYS.map(d => <option key={d} value={d}>{d.slice(0, 3)}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1 block">Start</label>
                              <input
                                value={cls.start_time}
                                onChange={e => updateClass(i, 'start_time', e.target.value)}
                                placeholder="09:00 AM"
                                className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1 block">End</label>
                              <input
                                value={cls.end_time}
                                onChange={e => updateClass(i, 'end_time', e.target.value)}
                                placeholder="10:00 AM"
                                className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                              />
                            </div>
                          </div>
                          {/* Faculty */}
                          <div>
                            <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1 block">Faculty</label>
                            <input
                              value={cls.faculty_name ?? ''}
                              onChange={e => updateClass(i, 'faculty_name', e.target.value || null)}
                              placeholder="Optional"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                            />
                          </div>
                          {/* Actions */}
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => removeClass(i)}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 cursor-pointer transition-colors">
                              Remove
                            </button>
                            <button onClick={() => setEditingIndex(null)}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer transition-colors"
                              style={{ background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)' }}>
                              Done
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── Compact row ─────────────────────────────── */
                        <div className="flex items-center gap-3 px-3.5 py-3">
                          {/* Day pill */}
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)' }}>
                            {cls.day.slice(0, 3).toUpperCase()}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{cls.subject_name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-slate-500 font-medium">{cls.start_time} – {cls.end_time}</span>
                              {cls.category && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                  style={{
                                    background: cls.category === 'Lab' ? 'rgba(168,85,247,0.10)' : 'rgba(26,158,160,0.10)',
                                    color: cls.category === 'Lab' ? '#7c3aed' : '#0f766e',
                                  }}>
                                  {cls.category}
                                </span>
                              )}
                              {cls.subject_code && (
                                <span className="text-[10px] text-slate-400 font-mono">{cls.subject_code}</span>
                              )}
                            </div>
                          </div>
                          {/* Edit button */}
                          <button
                            onClick={() => setEditingIndex(i)}
                            aria-label="Edit"
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-teal-600 hover:bg-teal-50 cursor-pointer transition-colors flex-shrink-0"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Confirm footer */}
                <div className="px-4 pb-5 pt-3 border-t border-slate-100 flex-shrink-0 space-y-2">
                  <button
                    onClick={handleImport}
                    disabled={isImporting || !extractedData?.length}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)', boxShadow: '0 4px 16px rgba(26,158,160,0.30)' }}
                  >
                    {isImporting ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Importing…
                      </span>
                    ) : `✅ Confirm & Import ${extractedData!.length} Class${extractedData!.length !== 1 ? 'es' : ''}`}
                  </button>
                  <p className="text-center text-[11px] text-slate-400">
                    Collisions are skipped automatically · You can still edit your schedule afterwards
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.message}
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-24 left-1/2 px-5 py-3 rounded-xl shadow-lg z-[60] text-sm font-semibold max-w-[90vw] text-center text-white"
            style={{
              background: toast.type === 'success'
                ? 'linear-gradient(135deg, #1a9ea0 0%, #0d7c80 100%)'
                : '#dc2626',
              boxShadow: toast.type === 'success'
                ? '0 8px 24px rgba(26,158,160,0.35)'
                : '0 8px 24px rgba(220,38,38,0.30)',
            }}
          >
            {toast.type === 'success' ? '✅ ' : '⚠️ '}{toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
