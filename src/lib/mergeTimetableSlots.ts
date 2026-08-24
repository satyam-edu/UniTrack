import type { ExtractedClass } from '@/app/actions/extractTimetable'

/**
 * "Does this cell visually span two grid columns" proved unreliable for the
 * model to judge itself (real-API testing showed 0/6 correct spans on one
 * sample day, vs ~83% correct code reads). So the extraction prompt now asks
 * for one reading per 1-hour column instead of asking Gemini to merge spans
 * itself — this is the deterministic merge step that reassembles multi-hour
 * classes from those column readings, run after every extraction pass.
 */

function parseTimeToMinutes(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const meridiem = m[3].toUpperCase()
  if (meridiem === 'AM') { if (h === 12) h = 0 } else { if (h !== 12) h += 12 }
  return h * 60 + min
}

function groupKey(cls: ExtractedClass): string {
  return [
    cls.day,
    (cls.subject_code ?? '').trim().toUpperCase(),
    (cls.faculty_name ?? '').trim().toUpperCase(),
    (cls.room ?? '').trim().toUpperCase(),
    (cls.group_designation ?? '').trim().toUpperCase(),
    cls.category ?? '',
  ].join('|')
}

export function mergeAdjacentSlots(classes: ExtractedClass[]): ExtractedClass[] {
  const groups = new Map<string, ExtractedClass[]>()
  for (const cls of classes) {
    const key = groupKey(cls)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(cls)
  }

  const merged: ExtractedClass[] = []
  for (const group of groups.values()) {
    const timed = group
      .map((cls) => ({ cls, start: parseTimeToMinutes(cls.start_time), end: parseTimeToMinutes(cls.end_time) }))
      .filter((g): g is { cls: ExtractedClass; start: number; end: number } => g.start !== null && g.end !== null)
      .sort((a, b) => a.start - b.start)

    if (timed.length === 0) {
      merged.push(...group) // unparseable times — pass through unchanged
      continue
    }

    let current = timed[0]
    for (let i = 1; i < timed.length; i++) {
      const next = timed[i]
      if (next.start === current.end) {
        current = { cls: { ...current.cls, end_time: next.cls.end_time }, start: current.start, end: next.end }
      } else {
        merged.push(current.cls)
        current = next
      }
    }
    merged.push(current.cls)
  }
  return merged
}
