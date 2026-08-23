'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildAuthedClient } from '@/lib/supabase-with-token'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedClass {
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
  subject_code: string
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

// ── Action 1: Parse timetable image with Gemini ───────────────────────────────

export async function parseTimetableImage(formData: FormData): Promise<ParseResult> {
  // ── Auth — token hand-off ──────────────────────────────────────────────────
  const token = formData.get('token') as string | null
  if (!token) throw new Error('You must be logged in.')

  const { data: { user }, error: authError } = await buildAuthedClient(token).auth.getUser()
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

University timetables never have a code-to-SUBJECT-NAME legend anywhere on the page. Do not go looking for one, and you must NOT guess or invent a subject name. This extraction only ever produces subject_code — the name is resolved separately against a database.

A page MAY separately have a code-to-FACULTY-NAME legend (a block of text like "MJ: Dr. M. Jhamb   VN: Prof. V. Nath   TBA: To be allocated", usually near the top of the page above the grid). If one is visible, use it to expand faculty initials in faculty_name. If no such legend is visible, just transcribe the faculty text in the cell literally — do not invent an expansion.

Cells are laid out in one of two common ways — recognize whichever this image uses:
(a) STACKED LINES: a faculty line, a branch/cohort line, the code, and a room, each on their own line inside the cell.
(b) SINGLE DELIMITED LINE: everything on one line separated by "/" or similar, e.g. "PCE349P/REENA/NBLAB1/ALL" (code/faculty/room/group — room and group are only present when they override the default; see RULE 1B). Two parallel classes in one cell may appear separated by a line break or a divider, not stacked as separate rows.

Before extracting, apply these UNIVERSAL REASONING RULES:

RULE 1: SEPARATE CODES FROM COHORTS
The branch/semester/cohort text (e.g. "CSE_VII", "B.Tech", "Sem 6", "ECE_VII_GPA", "BTECH 5th CSE Section 1") is NOT a subject — ignore it except for the group suffix described in RULE 4. Extract only the alphanumeric subject code itself (e.g. "ICT 312T", "BP210(P)", "ITE425P", "ITE 425T", "PCE349P") into subject_code, exactly as printed (keep any trailing letter like T/P — do not strip it).

RULE 1B: ROOM CAN BE A PAGE-LEVEL DEFAULT
Some timetables print one room for the whole page/table in its title (e.g. "BTECH 5th CSE Section 1 — ECR601") and only mention a room inside a cell when a specific class deviates from it (e.g. a lab in "NBLAB1"). If a cell has no room of its own, use the page/table's default room instead of leaving it blank.

RULE 2: VISUAL SPANS = TIME DURATIONS
Look at the physical width of the cell in the grid.
- If a cell visually spans across three 1-hour columns (e.g., starts under 9:00 and ends under 12:00), you MUST output ONE object with start_time: "9:00 AM" and end_time: "12:00 PM". Do NOT default to 1-hour slots.

RULE 2B: READ COLUMN HEADERS EXACTLY — DO NOT ROUND OR ASSUME
Column headers show the precise start time of each slot. You must read them as written, including irregular gaps (e.g. a header jumping from "12-1" straight to "1.30-2.30" with no explicit "Lunch" label — that gap is real, use "1:30 PM" as the next slot's start time, not "1:00 PM" or "2:30 PM"). If a column is explicitly labeled "Lunch" or "Break", it is not a lecture slot — skip it, and read the next column's own header for the real next start time.

RULE 3: PARALLEL BATCH RESOLUTION
When multiple rows of text appear stacked inside a single grid cell, each row is a SEPARATE class for a SEPARATE batch. Extract EACH row as its own JSON object with the same start_time and end_time.

STEP 1 — PRINTED LABELS WIN: Look for explicit batch/group labels. The most common form is a suffix directly on the cohort line, e.g. "CSE_VII_GPA" / "CSE_VII_GPB" or "ECE_VII_GPA" — extract just the trailing letter ("A" / "B") as group_designation. Other colleges print it differently: "(A)", "(B)", "Group A", "Batch 1", "Batch-II", "T1", "B2", "Sec A", "Div 2", "Grp X" — normalise lightly to its core token (e.g. "Group A" → "A", "Batch 1" → "1", "Sec B" → "B", "T1" → "T1"). Never invent or substitute a different label when one is printed. A comma-separated cross-branch cohort line like "CSE_VII, IT_VII" (no _GPA/_GPB suffix) is NOT a group split — it just means the class is shared across branches; ignore it for group_designation.

STEP 2 — DEFAULT TO LETTERS ONLY WHEN NOTHING IS PRINTED: If a cell has multiple stacked classes with NO printed batch label at all, they are still parallel classes for different student groups. Assign them "A", "B", "C", … in order of appearance (top to bottom). Always use plain capital letters A, B, C — never "G1", "G2", "G3".

Only use "ALL" when a class appears ALONE in its time slot, with no other class sharing the same start_time and end_time.

RULE 4: LAB VS THEORY — use ALL THREE signals together, they should agree:
(a) CODE SUFFIX: a trailing "P" on the code (e.g. "ITE425P"), or "(P)", "LAB", "PRA" anywhere in it, means Lab. A trailing "T" (e.g. "ITE425T") means Theory.
(b) ROOM PREFIX: rooms whose code starts with a lecture-room prefix (e.g. "ECR ...") are Theory rooms. Rooms whose code starts with a lab-room prefix (e.g. "ETL ...", "NBLAB...", "DTL ...") are Lab rooms.
(c) DURATION: a class spanning 2 or more hours is almost always a Lab.
If a code has no clear T/P suffix and the room is ambiguous (e.g. a bare code like "ITE427" in an "ECR" room, 1 hour long), default to Theory.

Output a JSON array. Each object must have exactly these keys:
subject_code, faculty_name, day, start_time, end_time, room, group_designation, category

Example of one correct object:
{
  "subject_code": "ITE425T",
  "faculty_name": "RS Gulafsha",
  "day": "Monday",
  "start_time": "10:00 AM",
  "end_time": "11:00 AM",
  "room": "ECR 414",
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

Now carefully re-examine the original image and check for these common mistakes — fix only what is wrong. Remember: there is no legend on this page, so never add or guess a subject name — only subject_code.

1. STACKED CELLS: If multiple rows inside a single grid cell were collapsed into one entry, split them into separate objects with the same start_time and end_time.
2. TIME SPANS: If a lab class that visually spans multiple hours was split into separate 1-hour slots, merge them into one entry with the correct start and end time. Also verify the start_time against the actual column header — if the timetable has a "Lunch" or "Break" column, that column is NOT a lecture slot; the next column to its right is the actual first afternoon slot (e.g., "1:30 PM", not "2:30 PM").
3. GROUP DESIGNATIONS: Verify each class has the correct group_designation. A cohort line with a trailing "_GPA"/"_GPB" (or similar printed batch/group label) must be extracted as its core letter/token. If multiple classes share the same time slot with NO printed labels, they MUST each get a unique plain capital letter A, B, C (top-to-bottom order) — never "G1", "G2", "G3". A comma-separated cross-branch cohort line (e.g. "CSE_VII, IT_VII") is not a group split. Only use "ALL" for a class that is truly alone in its time slot with no parallel entries.
4. THEORY VS LAB: Cross-check category against the code suffix (T/P), the room prefix (lecture rooms like "ECR ..." vs lab rooms like "ETL ...", "NBLAB...", "DTL ..."), and duration — all three should agree.

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
