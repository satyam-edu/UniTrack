'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildAuthedClient } from '@/lib/supabase-with-token'
import { supabaseAdmin } from '@/lib/supabase-server'
import { mergeAdjacentSlots } from '@/lib/mergeTimetableSlots'
import { resolveColumnTimes, type TimetableColumn, type ColumnClass } from '@/lib/timetableColumns'

// Gemini is called TWICE per scan (extraction + self-verification) against a
// shared free-tier daily request quota — cap each user's scans per day so
// one student repeatedly re-uploading can't exhaust it for everyone else.
const DAILY_IMPORT_LIMIT = 5

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedClass {
  subject_code: string
  // Only ever set when a subject-name legend is visible on the page itself —
  // most timetables don't have one, in which case this stays null and the
  // name is resolved later against the batch's subject_catalog instead.
  subject_name?: string | null
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

// ── Internal shape Gemini actually returns ──────────────────────────────────

interface ColumnPassResult {
  columns: TimetableColumn[]
  classes: ColumnClass[]
}

// ── Action 1: Parse timetable image with Gemini ───────────────────────────────

export async function parseTimetableImage(formData: FormData): Promise<ParseResult> {
  // ── Auth — token hand-off ──────────────────────────────────────────────────
  const token = formData.get('token') as string | null
  if (!token) throw new Error('You must be logged in.')

  const { data: { user }, error: authError } = await buildAuthedClient(token).auth.getUser()
  if (authError || !user) throw new Error('Invalid or expired session.')

  // ── Daily import cap ──────────────────────────────────────────────────────
  // Abuse deterrent, not a hard security boundary — a plain select-then-upsert
  // is fine even though it isn't race-proof under concurrent requests.
  const usedOn = new Date().toISOString().slice(0, 10) // UTC YYYY-MM-DD

  const { data: usageRow } = await supabaseAdmin
    .from('api_usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('used_on', usedOn)
    .maybeSingle()

  if (usageRow && usageRow.count >= DAILY_IMPORT_LIMIT) {
    return {
      success: false,
      error: `You've reached today's timetable-scan limit (${DAILY_IMPORT_LIMIT}/day) — try again tomorrow.`,
    }
  }

  await supabaseAdmin
    .from('api_usage')
    .upsert(
      { user_id: user.id, used_on: usedOn, count: (usageRow?.count ?? 0) + 1 },
      { onConflict: 'user_id,used_on' }
    )

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

  const extractionPrompt = `You are a world-class data extraction AI. Your job is to convert complex, messy visual university timetables into strict JSON.

Most timetables have NO code-to-SUBJECT-NAME legend on the page — in that case leave subject_name null and do NOT guess or invent one; it gets resolved separately against a database. But check first: some timetables DO print one (e.g. a block of text near the bottom like "BP-201-HUMAN ANATOMY AND PHYSIOLOGY"). If a subject-name legend is visible anywhere on the page, use it and fill in subject_name for every code it covers. Only leave subject_name null when no such legend exists on this specific page.

A page MAY separately have a code-to-FACULTY-NAME legend (a block of text like "MJ: Dr. M. Jhamb   VN: Prof. V. Nath   TBA: To be allocated", usually near the top of the page above the grid). If one is visible, use it to expand faculty initials in faculty_name. If no such legend is visible, just transcribe the faculty text in the cell literally — do not invent an expansion.

Cells are laid out in one of two common ways — recognize whichever this image uses:
(a) STACKED LINES: a faculty line, a branch/cohort line, the code, and a room, each on their own line inside the cell.
(b) SINGLE DELIMITED LINE: everything on one line separated by "/" or similar, e.g. "PCE349P/REENA/NBLAB1/ALL" (code/faculty/room/group — room and group are only present when they override the default; see RULE 1B). Two parallel classes in one cell may appear separated by a line break or a divider, not stacked as separate rows.

Before extracting, apply these UNIVERSAL REASONING RULES:

RULE 1: SEPARATE CODES FROM COHORTS
The branch/semester/cohort text (e.g. "CSE_VII", "B.Tech", "Sem 6", "ECE_VII_GPA", "BTECH 5th CSE Section 1") is NOT a subject — ignore it except for the group suffix described in RULE 3. Extract only the alphanumeric subject code itself (e.g. "ICT 312T", "BP210(P)", "ITE425P", "ITE 425T", "PCE349P") into subject_code, exactly as printed (keep any trailing letter like T/P — do not strip it).

RULE 1B: ROOM CAN BE A PAGE-LEVEL DEFAULT
Some timetables print one room for the whole page/table in its title (e.g. "BTECH 5th CSE Section 1 — ECR601") and only mention a room inside a cell when a specific class deviates from it (e.g. a lab in "NBLAB1"). If a cell has no room of its own, use the page/table's default room instead of leaving it blank.

RULE 1C: DON'T LET A GROUP LABEL POLLUTE THE CODE
Some codes carry a type marker AND a group letter back-to-back in parentheses, e.g. "BP207(P)(A)". Split these: subject_code is "BP207(P)" (or "BP207P"/"BP207-P", whatever form is printed for the type marker), and "A" is the group_designation from RULE 3 — never leave the group letter stuck inside subject_code, or classes that are really the same subject on different days will register as different codes.

RULE 2: BUILD THE COLUMN LIST ONCE, THEN REFERENCE COLUMNS BY POSITION — DO NOT RE-WRITE TIMES PER CLASS
First, read the header row once, left to right, and list every REAL lecture-time column in "columns" — each with its own start_time/end_time (e.g. "9:00 AM" / "10:00 AM"). Read headers exactly as printed, including irregular gaps (e.g. a header jumping from "12-1" straight to "1.30-2.30" — that gap is real, the next column starts at "1:30 PM", not "1:00 PM" or "2:30 PM"). If a column is labeled "Lunch"/"Break" (or is a narrow separator with no real class ever in it), do NOT add it to "columns" at all — the column list should only contain real teaching slots, in left-to-right order, so column positions stay meaningful.

Then, for every class in the grid, do NOT write out a time — instead set "column_index" to the 0-based position of the column it's in, matching the "columns" array you built (so column_index 0 means it's under columns[0], column_index 3 means columns[3], etc.). If a class visually spans multiple columns (e.g. a 2-hour lab), output ONE SEPARATE class object for EACH column it occupies, each with that column's own column_index — do not merge them yourself; a separate step outside this extraction reassembles multi-column classes from these column_index values. Your only job per class is: which column(s) is it under, and what's in the cell — not what time it is.

BEFORE moving to the next cell, explicitly count how many columns wide it looks — if you're not sure whether a cell is 1 or 2 columns wide, emit entries for BOTH columns rather than just one. Missing a column silently shortens a real class; an extra duplicate reading of the same class is harmless and gets merged away automatically. When in doubt, over-report, never under-report.

RULE 3: PARALLEL BATCH RESOLUTION
When multiple rows of text appear stacked inside a single grid cell, each row is a SEPARATE class for a SEPARATE batch. Extract EACH row as its own JSON object with the same column_index.

STEP 1 — PRINTED LABELS WIN: Look for explicit batch/group labels. The most common form is a suffix directly on the cohort line, e.g. "CSE_VII_GPA" / "CSE_VII_GPB" or "ECE_VII_GPA" — extract just the trailing letter ("A" / "B") as group_designation. Other colleges print it differently: "(A)", "(B)", "Group A", "Batch 1", "Batch-II", "T1", "B2", "Sec A", "Div 2", "Grp X" — normalise lightly to its core token (e.g. "Group A" → "A", "Batch 1" → "1", "Sec B" → "B", "T1" → "T1"). Never invent or substitute a different label when one is printed. A comma-separated cross-branch cohort line like "CSE_VII, IT_VII" (no _GPA/_GPB suffix) is NOT a group split — it just means the class is shared across branches; ignore it for group_designation.

STEP 2 — DEFAULT TO LETTERS ONLY WHEN NOTHING IS PRINTED: If a cell has multiple stacked classes with NO printed batch label at all, they are still parallel classes for different student groups. Assign them "A", "B", "C", … in order of appearance (top to bottom). Always use plain capital letters A, B, C — never "G1", "G2", "G3".

Only use "ALL" when a class appears ALONE in its time slot, with no other class sharing the same column_index.

RULE 4: LAB VS THEORY — use these signals together, they should agree:
(a) CODE SUFFIX: a trailing "P" on the code (e.g. "ITE425P"), or "(P)", "LAB", "PRA" anywhere in it, means Lab. A trailing "T" (e.g. "ITE425T") means Theory.
(b) ROOM PREFIX: rooms whose code starts with a lecture-room prefix (e.g. "ECR ...") are Theory rooms. Rooms whose code starts with a lab-room prefix (e.g. "ETL ...", "NBLAB...", "DTL ...") are Lab rooms.
(c) REPETITION: per RULE 2 you're reading one column at a time — if the SAME code/faculty/room keeps appearing in consecutive column_index values (i.e. it's clearly one class occupying multiple hours), that's also a signal it's a Lab.
If a code has no clear T/P suffix and the room is ambiguous (e.g. a bare code like "ITE427" in an "ECR" room), default to Theory.

Output a single JSON OBJECT (not an array) with exactly two keys: "columns" and "classes".

"columns": an array of { "start_time": "...", "end_time": "..." }, one per real lecture-time column, left to right, Lunch/Break columns excluded entirely.

"classes": an array where each object has exactly these keys:
subject_code, subject_name, faculty_name, day, column_index, room, group_designation, category

Example:
{
  "columns": [
    { "start_time": "9:00 AM", "end_time": "10:00 AM" },
    { "start_time": "10:00 AM", "end_time": "11:00 AM" },
    { "start_time": "11:00 AM", "end_time": "12:00 PM" },
    { "start_time": "12:00 PM", "end_time": "1:00 PM" },
    { "start_time": "1:30 PM", "end_time": "2:30 PM" }
  ],
  "classes": [
    { "subject_code": "ITE425T", "subject_name": null, "faculty_name": "RS Gulafsha", "day": "Monday", "column_index": 2, "room": "ECR 414", "group_designation": "ALL", "category": "Theory" }
  ]
}`

  // ── First pass ────────────────────────────────────────────────────────────
  let rawText: string
  try {
    const result = await model.generateContent([
      extractionPrompt,
      { inlineData: { mimeType, data: base64Data } },
    ])
    rawText = result.response.text()
  } catch (err: unknown) {
    console.error('[parseTimetableImage] Gemini API error:', err)
    return { success: false, error: 'AI extraction failed. Please try again.' }
  }

  let firstPass: ColumnPassResult
  try {
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()
    firstPass = JSON.parse(rawText)
    if (!Array.isArray(firstPass.columns) || !Array.isArray(firstPass.classes)) {
      throw new Error('Response missing columns/classes arrays')
    }
  } catch {
    console.error('[parseTimetableImage] JSON parse error. Raw text:', rawText)
    return { success: false, error: 'Could not parse the AI response. Please try a clearer image.' }
  }

  if (firstPass.classes.length === 0) {
    return { success: false, error: 'No classes were detected in the image. Please try a clearer photo.' }
  }

  // ── Second pass: self-verification ───────────────────────────────────────
  // Ask Gemini to review its own output against the original image and fix mistakes.
  const verificationPrompt = `You extracted this timetable data in a first pass:

${JSON.stringify(firstPass, null, 2)}

Now carefully re-examine the original image and check for these common mistakes — fix only what is wrong. Remember RULE 2: classes reference "column_index" into "columns" — never write literal times on a class object, and never merge multi-column classes into one entry yourself. Remember the subject_name rule: only set it if this page actually has a subject-name legend, never guess one.

1. COLUMNS LIST: Verify "columns" only contains real lecture-time columns (no Lunch/Break), in left-to-right order, with the exact times from the header row.
2. STACKED CELLS: If multiple rows inside a single grid cell were collapsed into one entry, split them into separate objects with the same column_index.
3. COLUMN COVERAGE: This is the most common mistake — a class spanning several columns often gets only some of its columns reported. For every class, check the immediately adjacent columns on the image: if the same code/faculty/room is visible there too, add that missing column_index. When in doubt, add the extra entry rather than leave a class under-reported.
4. GROUP DESIGNATIONS: Verify each class has the correct group_designation, and that no group letter is stuck inside subject_code (see RULE 1C). A cohort line with a trailing "_GPA"/"_GPB" (or similar printed batch/group label) must be extracted as its core letter/token. If multiple classes share the same column_index with NO printed labels, they MUST each get a unique plain capital letter A, B, C (top-to-bottom order) — never "G1", "G2", "G3". A comma-separated cross-branch cohort line (e.g. "CSE_VII, IT_VII") is not a group split. Only use "ALL" for a class that is truly alone in its column with no parallel entries.
5. THEORY VS LAB: Cross-check category against the code suffix (T/P) and the room prefix (lecture rooms like "ECR ..." vs lab rooms like "ETL ...", "NBLAB...", "DTL ...") — they should agree.

Return the corrected JSON object (same "columns"/"classes" shape) only. Do not change entries that are already correct.`

  let finalPass = firstPass
  try {
    const verifyResult = await model.generateContent([
      verificationPrompt,
      { inlineData: { mimeType, data: base64Data } },
    ])
    const verifyText = verifyResult.response.text().replace(/```json/gi, '').replace(/```/g, '').trim()
    const verified: ColumnPassResult = JSON.parse(verifyText)
    if (Array.isArray(verified?.columns) && Array.isArray(verified?.classes) && verified.classes.length > 0) {
      finalPass = verified
    }
  } catch {
    // Second pass failed — silently fall back to the first pass result
  }

  // Resolve column_index -> real start_time/end_time using the page's own
  // header list, then reassemble multi-column classes deterministically —
  // neither step requires the model to reason about clock times at all.
  const resolved = resolveColumnTimes(finalPass.columns, finalPass.classes)
  return { success: true, classes: mergeAdjacentSlots(resolved) }
}
