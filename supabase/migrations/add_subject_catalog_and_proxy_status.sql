-- Batch-scoped subject-code catalog, so AI timetable import can resolve
-- subject_code -> subject_name from a shared database instead of asking
-- Gemini to guess names off an in-image legend (real timetables from this
-- university have no legend at all — only bare codes per cell).
--
-- One student of a batch types the name for a code once; every other
-- student of the same batch who scans a timetable with that code gets it
-- auto-filled. Corrections write through and become the new default.

CREATE TABLE public.subject_catalog (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch text NOT NULL,
    subject_code text NOT NULL,
    subject_name text NOT NULL,
    type text CHECK (type IN ('Theory', 'Lab')),
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE (batch, subject_code)
);

ALTER TABLE public.subject_catalog ENABLE ROW LEVEL SECURITY;

-- Any authenticated student can read the catalog (needed to resolve codes
-- for their own batch during import). There is deliberately no INSERT/UPDATE
-- policy here — writes only happen through the saveTimetableToDB Server
-- Action via the service-role client, so a student can't tamper with
-- another batch's catalog directly from the browser.
CREATE POLICY "Authenticated users can read the catalog"
  ON public.subject_catalog FOR SELECT
  USING (auth.role() = 'authenticated');

-- ========= ATTENDANCE: add Proxy status =========
-- Proxy = someone else marked/answered present on the student's behalf.
-- Counts toward the attendance percentage like Present (tracked separately
-- in the UI for transparency), unlike Cancelled which is excluded.
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('Present', 'Absent', 'Cancelled', 'Proxy'));
