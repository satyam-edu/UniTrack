'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
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
  group_designation?: string | null
  is_elective?: boolean
}

export interface SkippedClass {
  subject_name: string
  day: string
  start_time: string
  end_time: string
  reason: string
}

export type ParseResult =
  | { success: true; classes: ExtractedClass[] }
  | { success: false; error: string }

export type ImportResult =
  | { success: true; count: number; skipped: number; skippedClasses: SkippedClass[] }
  | { success: false; error: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

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

  const extractionPrompt = `You are a world-class data extraction AI. Your job is to convert complex, messy visual university timetables into a strict JSON array.

Before extracting, apply these UNIVERSAL REASONING RULES:

RULE 1: IDENTIFY THE LEGEND
Look at the bottom or margins of the image. Universities usually provide a "Key" or "Legend" mapping short codes to full names (e.g., "BP-201" → "HUMAN ANATOMY AND PHYSIOLOGY"). Use this to fill in full subject_name values.
Also expand faculty abbreviation codes using the same legend (e.g., "PL" → "Dr. Pallavi", "SKR" → "Dr. Sakshi"). Never output raw abbreviations in faculty_name — always expand them.

RULE 2: SEPARATE CODES FROM COHORTS
Ignore branch, semester, or cohort names (e.g., "CSE_VI", "B.Tech", "Sem 6", "B.Pharm"). These are NOT subjects. Look for alphanumeric subject codes (e.g., "ICT 312T", "BP210(P)", "ITE 346T").

RULE 3: VISUAL SPANS = TIME DURATIONS
Look at the physical width of the cell in the grid.
- If a cell visually spans across three 1-hour columns (e.g., starts under 9:00 and ends under 12:00), you MUST output ONE object with start_time: "9:00 AM" and end_time: "12:00 PM". Do NOT default to 1-hour slots.

RULE 3B: READ COLUMN HEADERS EXACTLY — DO NOT ROUND OR ASSUME
Column headers show the precise start time of each slot. You must read them as written.
- LUNCH/BREAK columns (labeled "Lunch", "Break", or similar) are NOT lecture slots. They are narrow separator columns between morning and afternoon. Do NOT count them as a time slot.
- After a Lunch column, the next column's header is the actual first afternoon slot — it may be an unusual time like "1:30 PM" (not "1:00 PM") due to a 30-minute lunch. Read and use that exact time.
- WRONG: Seeing "Lunch 13:00-13:30" then assuming afternoon starts at "2:30 PM"
- RIGHT: Seeing "Lunch 13:00-13:30" then reading the next column header which says "1:30 pm" and using "1:30 PM" as the start time

RULE 4: PARALLEL BATCH RESOLUTION
When multiple rows of text appear stacked inside a single grid cell, each row is a SEPARATE class for a SEPARATE batch. Extract EACH row as its own JSON object with the same start_time and end_time.

STEP 1 — PRINTED LABELS WIN: Look carefully for explicit batch/group labels printed on or beside the class. They appear in many forms, e.g. "(A)", "(B)", "Group A", "Batch 1", "Batch-II", "T1", "B2", "Sec A", "Div 2", "Grp X". If a label IS printed, you MUST use it. Normalise it lightly to its core token (e.g. "Group A" → "A", "Batch 1" → "1", "Sec B" → "B", "T1" → "T1") and put it in "group_designation". Never invent or substitute a different label when one is printed.

STEP 2 — DEFAULT TO LETTERS ONLY WHEN NOTHING IS PRINTED: If a cell has multiple stacked classes with NO printed batch label at all, they are still parallel classes for different student groups. Assign them "A", "B", "C", … in order of appearance (top to bottom). Always use plain capital letters A, B, C — never "G1", "G2", "G3".

Only use "ALL" when a class appears ALONE in its time slot, with no other class sharing the same start_time and end_time.

RULE 5: LAB VS THEORY
If the subject code contains "(P)", "LAB", or "PRA", or the class spans 2 or more hours, set "category" to "Lab". Otherwise set "category" to "Theory".

Output a JSON array. Each object must have exactly these keys:
subject_name, subject_code, faculty_name, day, start_time, end_time, room, group_designation, category

Example of one correct object:
{
  "subject_name": "Human Anatomy and Physiology",
  "subject_code": "BP201",
  "faculty_name": "Dr. Pallavi",
  "day": "Monday",
  "start_time": "1:30 PM",
  "end_time": "2:30 PM",
  "room": null,
  "group_designation": "ALL",
  "category": "Theory"
}`

  // ── First pass ────────────────────────────────────────────────────────────
  let rawText: string
  try {
    const result = await model.generateContent([
      extractionPrompt,
      { inlineData: { mimeType, data: base64Data } },
    ])
    rawText = result.response.text()
  } catch (err: any) {
    console.error('[parseTimetableImage] Gemini API error:', err)
    return { success: false, error: 'AI extraction failed. Please try again.' }
  }

  let firstPassClasses: ExtractedClass[]
  try {
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()
    firstPassClasses = JSON.parse(rawText)
    if (!Array.isArray(firstPassClasses)) throw new Error('Response is not an array')
  } catch {
    console.error('[parseTimetableImage] JSON parse error. Raw text:', rawText)
    return { success: false, error: 'Could not parse the AI response. Please try a clearer image.' }
  }

  if (firstPassClasses.length === 0) {
    return { success: false, error: 'No classes were detected in the image. Please try a clearer photo.' }
  }

  // ── Second pass: self-verification ───────────────────────────────────────
  // Ask Gemini to review its own output against the original image and fix mistakes.
  const verificationPrompt = `You extracted this timetable data in a first pass:

${JSON.stringify(firstPassClasses, null, 2)}

Now carefully re-examine the original image and check for these common mistakes — fix only what is wrong:

1. STACKED CELLS: If multiple rows inside a single grid cell were collapsed into one entry, split them into separate objects with the same start_time and end_time.
2. FACULTY NAMES: If any faculty_name is still a short abbreviation code (2-4 capital letters like "PL", "WA"), expand it to the full name using the legend in the image.
3. TIME SPANS: If a lab class that visually spans multiple hours was split into separate 1-hour slots, merge them into one entry with the correct start and end time. Also verify the start_time against the actual column header — if the timetable has a "Lunch" or "Break" column, that column is NOT a lecture slot; the next column to its right is the actual first afternoon slot (e.g., "1:30 PM", not "2:30 PM").
4. GROUP DESIGNATIONS: Verify each class has the correct group_designation. If explicit batch/group labels are printed on the timetable, they must be used verbatim (lightly normalised to their core token). If multiple classes share the same time slot with NO printed labels, they MUST each get a unique plain capital letter A, B, C (top-to-bottom order) — never "G1", "G2", "G3". Only use "ALL" for a class that is truly alone in its time slot with no parallel entries.

Return the corrected JSON array only. Do not change entries that are already correct.`

  let finalClasses = firstPassClasses
  try {
    const verifyResult = await model.generateContent([
      verificationPrompt,
      { inlineData: { mimeType, data: base64Data } },
    ])
    const verifyText = verifyResult.response.text().replace(/```json/gi, '').replace(/```/g, '').trim()
    const verified: ExtractedClass[] = JSON.parse(verifyText)
    if (Array.isArray(verified) && verified.length > 0) {
      finalClasses = verified
    }
  } catch {
    // Second pass failed — silently fall back to the first pass result
  }

  return { success: true, classes: finalClasses }
}
