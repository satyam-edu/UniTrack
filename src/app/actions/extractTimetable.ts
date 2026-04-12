'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedClass {
  subject_name: string
  subject_code: string
  faculty_name: string | null
  category: string | null   // 'Theory', 'Lab', or null
  day: string               // 'Monday', 'Tuesday', etc.
  start_time: string        // e.g. '09:00 AM'
  end_time: string          // e.g. '11:00 AM'
  room: string | null
}

export type ParseResult =
  | { success: true; classes: ExtractedClass[] }
  | { success: false; error: string }

export type ImportResult =
  | { success: true; count: number }
  | { success: false; error: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a 12-hour time string like "09:00 AM" to a DB-friendly "HH:MM:SS" */
function to24HourDb(timeStr: string): string {
  try {
    const trimmed = timeStr.trim()
    const date = new Date(`1970-01-01 ${trimmed}`)
    if (isNaN(date.getTime())) {
      // Already 24-hour or HH:MM — normalise
      if (trimmed.split(':').length >= 2) {
        const parts = trimmed.split(':')
        const h = parts[0].padStart(2, '0')
        const m = (parts[1] ?? '00').padStart(2, '0')
        return `${h}:${m}:00`
      }
    }
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${m}:00`
  } catch {
    return '00:00:00'
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

// ── Action 1: Parse timetable image with Gemini ───────────────────────────────

export async function parseTimetableImage(formData: FormData): Promise<ParseResult> {
  // ── Auth — token hand-off ──────────────────────────────────────────────────
  const token = formData.get('token') as string | null
  if (!token) throw new Error('You must be logged in.')

  const { data: { user }, error: authError } = await buildClient(token).auth.getUser()
  if (authError || !user) throw new Error('Invalid or expired session.')

  // ── Validate file ──────────────────────────────────────────────────────────
  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'No file provided.' }

  const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: 'Invalid file type. Please upload a PNG, JPEG, or PDF.' }
  }

  // ── Convert to base64 ─────────────────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer()
  const base64Data = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = file.type as 'image/png' | 'image/jpeg' | 'application/pdf'

  // ── Call Gemini ───────────────────────────────────────────────────────────
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview', generationConfig: { responseMimeType: "application/json" } })

  const prompt = `You are an expert data extraction assistant. Analyze the provided college timetable image and extract the schedule into a strict JSON array.

CRITICAL INSTRUCTIONS FOR READING THE TABLE:
1. Merged Cells (Multi-hour classes): Look carefully at the vertical lines separating the time columns. If a class block spans across multiple time columns visually (e.g., a single box covering both "11-12 AM" and "12-01 PM"), it is a continuous multi-hour class. 
2. Calculate the True Time: For merged cells, the "start_time" is the beginning of the first column it touches, and the "end_time" is the end of the last column it touches (e.g., a cell spanning 11-12 and 12-01 means Start: 11:00 AM, End: 01:00 PM). Do NOT split it into two duplicate classes.
3. Ignore Breaks: Ignore empty columns or general breaks (like the 1:00 PM - 1:30 PM gap).
4. Formatting: Ensure start_time and end_time are strictly formatted like "09:00 AM", "01:30 PM", etc.

Return ONLY a valid, raw JSON array (no markdown blockticks like \`\`\`json, no conversational text) matching this exact schema for every single class block found:
[
  {
    "subject_name": "string (The full name of the subject)",
    "subject_code": "string (e.g., ITE348T or ICT312P)",
    "faculty_name": "string (or null if missing)",
    "category": "string ('Theory', 'Lab', or null)",
    "day": "string (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday)",
    "start_time": "string (e.g., 09:00 AM)",
    "end_time": "string (e.g., 11:00 AM)",
    "room": "string (or null if missing)"
  }
]`

  let rawText: string
  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data: base64Data } },
    ])
    rawText = result.response.text()
  } catch (err: any) {
    console.error('[parseTimetableImage] Gemini API error:', err)
    return { success: false, error: 'AI extraction failed. Please try again.' }
  }

  // ── Parse JSON ────────────────────────────────────────────────────────────
  let classes: ExtractedClass[]
  try {
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()
    classes = JSON.parse(rawText)
    if (!Array.isArray(classes)) throw new Error('Response is not an array')
  } catch {
    console.error('[parseTimetableImage] JSON parse error. Raw text:', rawText)
    return { success: false, error: 'Could not parse the AI response. Please try a clearer image.' }
  }

  if (classes.length === 0) {
    return { success: false, error: 'No classes were detected in the image. Please try a clearer photo.' }
  }

  return { success: true, classes }
}

// ── Action 2: Confirm & import the reviewed schedule ─────────────────────────

export async function importConfirmedSchedule(
  classes: ExtractedClass[],
  token: string
): Promise<ImportResult> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  if (!token) throw new Error('You must be logged in.')

  const { data: { user }, error: authError } = await buildClient(token).auth.getUser()
  if (authError || !user) throw new Error('Invalid or expired session.')

  const userId = user.id

  // ── Overwrite: wipe existing schedule before importing ─────────────────────
  // Delete timetable first (FK references subjects), then subjects.
  await supabaseAdmin.from('timetable').delete().eq('user_id', userId)
  await supabaseAdmin.from('subjects').delete().eq('user_id', userId)

  // ── Pool & Placement logic ─────────────────────────────────────────────────
  let classesAdded = 0


  for (const cls of classes) {
    if (!cls.subject_name || !cls.day || !cls.start_time || !cls.end_time) continue

    const subjectName = cls.subject_name.trim()
    const subjectCode = (cls.subject_code ?? '').trim()
    const startTimeDb = to24HourDb(cls.start_time)
    const endTimeDb = to24HourDb(cls.end_time)
    const subjectType = normaliseType(cls.category)

    // ── STEP A: Pool — find or create the subject ──────────────────────────
    let subjectId: string

    const { data: existingSubject } = await supabaseAdmin
      .from('subjects')
      .select('id')
      .eq('user_id', userId)
      .or(
        subjectCode
          ? `subject_code.ilike.${subjectCode},subject_name.ilike.${subjectName}`
          : `subject_name.ilike.${subjectName}`
      )
      .maybeSingle()

    if (existingSubject) {
      subjectId = existingSubject.id
    } else {
      const { data: newSubject, error: subjectInsertError } = await supabaseAdmin
        .from('subjects')
        .insert({
          user_id: userId,
          subject_name: subjectName,
          subject_code: subjectCode || subjectName.slice(0, 10).toUpperCase(),
          faculty_name: cls.faculty_name?.trim() || null,
          type: subjectType,
        })
        .select('id')
        .single()

      if (subjectInsertError || !newSubject) {
        console.error('[importConfirmedSchedule] Subject insert error:', subjectInsertError)
        continue
      }
      subjectId = newSubject.id
    }

    // ── STEP B: Placement — collision check ────────────────────────────────
    const { data: existingSlots } = await supabaseAdmin
      .from('timetable')
      .select('start_time, end_time')
      .eq('user_id', userId)
      .eq('day_of_week', cls.day)

    const hasCollision = existingSlots?.some(
      (slot) => startTimeDb < slot.end_time && endTimeDb > slot.start_time
    ) ?? false

    if (hasCollision) continue

    // ── Insert slot ────────────────────────────────────────────────────────
    const { error: timetableInsertError } = await supabaseAdmin
      .from('timetable')
      .insert({
        user_id: userId,
        subject_id: subjectId,
        day_of_week: cls.day,
        start_time: startTimeDb,
        end_time: endTimeDb,
        room_location: cls.room?.trim() || null,
      })

    if (timetableInsertError) {
      console.error('[importConfirmedSchedule] Timetable insert error:', timetableInsertError)
      continue
    }

    classesAdded++
  }

  return { success: true, count: classesAdded }
}
