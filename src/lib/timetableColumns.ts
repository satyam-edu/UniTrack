import type { ExtractedClass } from '@/app/actions/extractTimetable'

/** One real lecture-time column, read once from the page's own header row. */
export interface TimetableColumn {
  start_time: string
  end_time: string
}

/**
 * A class reading keyed to a column position instead of a literal clock
 * time. Asking the model to repeatedly re-transcribe "9:00 AM" for every
 * cell it reads proved error-prone (real-API testing showed times drifting
 * and spans getting truncated); referencing a column index into a header
 * list read once is a much more constrained, less repetitive task.
 */
export type ColumnClass = Omit<ExtractedClass, 'start_time' | 'end_time'> & {
  column_index: number
}

/** Resolves column-indexed readings back into real start_time/end_time
 *  using the page's own column list. Out-of-range indices are dropped
 *  rather than assigned a guessed time. */
export function resolveColumnTimes(columns: TimetableColumn[], classes: ColumnClass[]): ExtractedClass[] {
  const resolved: ExtractedClass[] = []
  for (const cls of classes) {
    const column = columns[cls.column_index]
    if (!column) continue
    resolved.push({
      subject_code: cls.subject_code,
      subject_name: cls.subject_name,
      faculty_name: cls.faculty_name,
      category: cls.category,
      day: cls.day,
      room: cls.room,
      group_designation: cls.group_designation,
      is_elective: cls.is_elective,
      start_time: column.start_time,
      end_time: column.end_time,
    })
  }
  return resolved
}
