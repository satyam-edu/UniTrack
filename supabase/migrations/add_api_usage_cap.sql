-- Per-user daily cap on timetable-scan imports (parseTimetableImage).
-- Gemini is called TWICE per scan (extraction + self-verification) against
-- a shared free-tier daily request quota, so one student repeatedly
-- re-uploading could exhaust the whole team's quota for everyone else.
--
-- One row per (user, day) tracks how many scans that user has run today.
-- The Server Action checks/increments this via the service-role client
-- (supabaseAdmin) only — there is deliberately NO RLS policy here, so an
-- authenticated client can neither read nor write its own usage row
-- directly (it also has nothing useful to read: this table exists purely
-- as a server-side counter, not user-facing data).

CREATE TABLE public.api_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    used_on date NOT NULL,
    count integer NOT NULL DEFAULT 0,
    UNIQUE (user_id, used_on)
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role client (supabaseAdmin) ever touches
-- this table, from within parseTimetableImage.
