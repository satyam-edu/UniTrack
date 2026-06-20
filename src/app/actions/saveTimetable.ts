'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import type { ExtractedClass, ImportResult, SkippedClass } from './extractTimetable'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a 12-hour time string like "09:00 AM" to "HH:MM:SS". Returns null on failure. */
function to24HourDb(timeStr: string): string | null {
  try {
    const trimmed = timeStr.trim()
    const date = new Date(`1970-01-01 ${trimmed}`)
    if (isNaN(date.getTime())) {
      const parts = trimmed.split(':')
      if (parts.length >= 2) {
        const h = parts[0].padStart(2, '0')
        const m = (parts[1] ?? '00').replace(/[^0-9]/g, '').padStart(2, '0')
        return `${h}:${m}:00`
      }
      return null
    }
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${m}:00`
  } catch {
    return null
  }
}

/** Normalise AI category value to the DB-accepted enum */
function normaliseType(category: string | null): string {
  if (!category) return 'Theory'
  const lower = category.toLowerCase()
  if (lower.includes('lab') || lower.includes('practical')) return 'Lab'
  return 'Theory'
}

/** Build an authenticated supabase-js client from a hand-off token */
function buildClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

/** Normalise a subject code/name for deduplication matching */
function normaliseKey(str: string): string {
  return str
    .replace(/\s+/g, '')
    .replace(/\(P\)$/i, '')
    .replace(/\(T\)$/i, '')
    .toUpperCase()
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ExistingSlot = {
  id: string
  subject_id: string
  day_of_week: string
  group_designation: string | null
}

// ── Save Action ───────────────────────────────────────────────────────────────

export async function saveTimetableToDB(
  classes: ExtractedClass[],
  token: string
): Promise<ImportResult> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  if (!token) throw new Error('You must be logged in.')

  const { data: { user }, error: authError } = await buildClient(token).auth.getUser()
  if (authError || !user) throw new Error('Invalid or expired session.')

  const userId = user.id

  // ── Step 1: Import classes exactly as extracted ───────────────────────────
  // Unlabeled parallel classes are intentionally kept as Universal (ALL). We do NOT
  // auto-assign synthetic G1/G2 labels — the user assigns their real batch labels
  // (A, B, …) via the manual edit flow, and the Home page locks attendance on any
  // unresolved overlap until they do. This keeps group labels meaningful and consistent.
  const processedClasses: ExtractedClass[] = classes

  // ── Step 2: Deduplicate subjects by normalised code/name ──────────────────
  const subjectCanonical = new Map<
    string,
    { name: string; code: string; faculty: string | null; type: string }
  >()

  for (const cls of processedClasses) {
    const rawName = (cls.subject_name ?? '').trim()
    const rawCode = (cls.subject_code ?? '').trim()
    const key = normaliseKey(rawCode || rawName)
    if (!key) continue
    if (!subjectCanonical.has(key)) {
      subjectCanonical.set(key, {
        name: rawName,
        code: rawCode,
        faculty: cls.faculty_name?.trim() || null,
        type: normaliseType(cls.category),
      })
    }
  }

  if (subjectCanonical.size === 0) {
    return { success: false, error: 'No valid classes to import.' }
  }

  // ── Step 3: Match new subjects to existing ones → reuse IDs where possible ─
  // Reusing an existing subject_id means all attendance records for that subject
  // survive the re-upload, regardless of timetable changes.
  const { data: existingSubjects } = await supabaseAdmin
    .from('subjects')
    .select('id, subject_code, subject_name')
    .eq('user_id', userId)

  const existingSubjectByKey = new Map<string, string>() // norm_key → existing id
  for (const s of existingSubjects ?? []) {
    const key = normaliseKey((s.subject_code ?? '') || (s.subject_name ?? ''))
    if (key) existingSubjectByKey.set(key, s.id)
  }

  const subjectIdMap = new Map<string, string>() // norm_key → final id
  const keptSubjectIds  = new Set<string>()      // existing IDs we're reusing
  const subjectsToInsert: object[] = []

  for (const [key, s] of subjectCanonical) {
    const existingId = existingSubjectByKey.get(key)
    if (existingId) {
      // Reuse existing row — preserves subject_id in attendance records
      subjectIdMap.set(key, existingId)
      keptSubjectIds.add(existingId)
    } else {
      subjectsToInsert.push({
        user_id:      userId,
        subject_name: s.name,
        subject_code: s.code || s.name.slice(0, 10).toUpperCase(),
        faculty_name: s.faculty,
        type:         s.type,
      })
    }
  }

  // Insert only genuinely new subjects
  let newlyInsertedSubjectIds: string[] = []
  if (subjectsToInsert.length > 0) {
    const { data: newSubs, error: subErr } = await supabaseAdmin
      .from('subjects')
      .insert(subjectsToInsert)
      .select('id, subject_code, subject_name')

    if (subErr || !newSubs) {
      return { success: false, error: 'Failed to save subjects. Please try again.' }
    }

    for (const s of newSubs) {
      const key = normaliseKey((s.subject_code ?? '') || (s.subject_name ?? ''))
      subjectIdMap.set(key, s.id)
    }
    newlyInsertedSubjectIds = newSubs.map((s) => s.id)
  }

  // ── Step 4: Fetch existing slots for merge matching ───────────────────────
  const { data: existingSlots } = await supabaseAdmin
    .from('timetable')
    .select('id, subject_id, day_of_week, group_designation')
    .eq('user_id', userId)

  // Group existing slots by subject_id for fast lookup
  const candidatesBySubject = new Map<string, ExistingSlot[]>()
  for (const slot of existingSlots ?? []) {
    if (!candidatesBySubject.has(slot.subject_id)) {
      candidatesBySubject.set(slot.subject_id, [])
    }
    candidatesBySubject.get(slot.subject_id)!.push(slot)
  }

  // ── Step 5: Build slot actions with in-memory collision detection ──────────
  type OccupiedSlot = { day: string; group: string; start: string; end: string }
  const occupiedSlots: OccupiedSlot[]    = []
  const skippedClasses: SkippedClass[]   = []
  const slotsToUpdate: Array<{ id: string; data: object }> = []
  const slotsToInsert: object[]          = []
  const matchedSlotIds = new Set<string>()

  const pushSkipped = (cls: ExtractedClass, reason: string) => {
    skippedClasses.push({
      subject_name: cls.subject_name || 'Unknown',
      day:          cls.day          || '?',
      start_time:   cls.start_time   || '?',
      end_time:     cls.end_time     || '?',
      reason,
    })
  }

  for (const cls of processedClasses) {
    if (!cls.subject_name || !cls.day || !cls.start_time || !cls.end_time) {
      pushSkipped(cls, 'Missing required fields')
      continue
    }

    const startTimeDb = to24HourDb(cls.start_time)
    const endTimeDb   = to24HourDb(cls.end_time)

    if (!startTimeDb || !endTimeDb) {
      pushSkipped(cls, 'Could not parse time format')
      continue
    }

    const rawCode = (cls.subject_code ?? '').trim()
    const rawName = (cls.subject_name ?? '').trim()
    const key       = normaliseKey(rawCode || rawName)
    const subjectId = subjectIdMap.get(key)

    if (!subjectId) {
      pushSkipped(cls, 'Could not match subject')
      continue
    }

    const groupDesignation = (cls.group_designation?.trim().toUpperCase() || 'ALL')

    // In-memory collision check
    const collision = occupiedSlots.some((slot) => {
      if (slot.day !== cls.day) return false
      if (groupDesignation !== 'ALL' && slot.group !== 'ALL' && groupDesignation !== slot.group) return false
      return startTimeDb < slot.end && endTimeDb > slot.start
    })

    if (collision) {
      pushSkipped(cls, `Time overlap with another ${groupDesignation !== 'ALL' ? 'Group ' + groupDesignation : ''} class`)
      continue
    }

    occupiedSlots.push({ day: cls.day, group: groupDesignation, start: startTimeDb, end: endTimeDb })

    const slotData = {
      day_of_week:       cls.day,
      start_time:        startTimeDb,
      end_time:          endTimeDb,
      room_location:     cls.room?.trim() || null,
      group_designation: groupDesignation,
      is_elective:       cls.is_elective || false,
    }

    // ── Merge: find the best matching existing slot to UPDATE in place ───────
    // Priority: exact match (same day + group) → same day → same group → any
    // Updating in place preserves timetable_id → all attendance records survive.
    const candidates = candidatesBySubject.get(subjectId) ?? []

    const match =
      candidates.find((c) =>
        !matchedSlotIds.has(c.id) &&
        c.day_of_week === cls.day &&
        (c.group_designation ?? 'ALL').toUpperCase() === groupDesignation
      ) ??
      candidates.find((c) =>
        !matchedSlotIds.has(c.id) &&
        c.day_of_week === cls.day
      ) ??
      candidates.find((c) =>
        !matchedSlotIds.has(c.id) &&
        (c.group_designation ?? 'ALL').toUpperCase() === groupDesignation
      ) ??
      candidates.find((c) => !matchedSlotIds.has(c.id))

    if (match) {
      matchedSlotIds.add(match.id)
      slotsToUpdate.push({ id: match.id, data: slotData })
    } else {
      slotsToInsert.push({ user_id: userId, subject_id: subjectId, ...slotData })
    }
  }

  // ── Step 6: Apply updates (preserves timetable_id → attendance survives) ──
  for (const { id, data } of slotsToUpdate) {
    const { error } = await supabaseAdmin.from('timetable').update(data).eq('id', id)
    if (error) console.error('[saveTimetable] slot update failed:', id, error.message)
  }

  // ── Step 7: Insert net-new slots ──────────────────────────────────────────
  if (slotsToInsert.length > 0) {
    const { error: insertErr } = await supabaseAdmin.from('timetable').insert(slotsToInsert)

    if (insertErr) {
      // Roll back newly inserted subjects (kept subjects are untouched)
      if (newlyInsertedSubjectIds.length > 0) {
        await supabaseAdmin.from('subjects').delete().in('id', newlyInsertedSubjectIds)
      }
      return {
        success: false,
        error: 'Failed to save timetable. Your existing schedule is unchanged.',
      }
    }
  }

  // ── Step 8: Delete stale slots (removed from the new timetable) ───────────
  const staleSlotIds = (existingSlots ?? [])
    .map((s) => s.id)
    .filter((id) => !matchedSlotIds.has(id))

  if (staleSlotIds.length > 0) {
    await supabaseAdmin.from('timetable').delete().in('id', staleSlotIds)
  }

  // ── Step 9: Delete stale subjects (no longer in the new timetable) ─────────
  const staleSubjectIds = (existingSubjects ?? [])
    .map((s) => s.id)
    .filter((id) => !keptSubjectIds.has(id))

  if (staleSubjectIds.length > 0) {
    await supabaseAdmin.from('subjects').delete().in('id', staleSubjectIds)
  }

  const totalCount = slotsToUpdate.length + slotsToInsert.length
  return { success: true, count: totalCount, skipped: skippedClasses.length, skippedClasses }
}
