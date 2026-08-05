-- The project's auto-generated schema (users/subjects/timetable_slots/attendance_records)
-- didn't match the application's actual columns/table names. All tables were empty,
-- so they were dropped and rebuilt to the shape the app code actually queries.
-- Applied directly via Supabase MCP (apply_migration) on 2026-08-06.

DROP TABLE IF EXISTS public.attendance_records CASCADE;
DROP TABLE IF EXISTS public.timetable_slots CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ========= USERS =========
CREATE TABLE public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name text,
    enrollment_no text UNIQUE,
    branch text,
    college text,
    mobile_no text,
    email text,
    batch text,
    created_at timestamp with time zone DEFAULT now(),
    target_attendance integer,
    theory_mode text DEFAULT 'class' CHECK (theory_mode IN ('class', 'hour')),
    lab_mode text DEFAULT 'class' CHECK (lab_mode IN ('class', 'hour')),
    primary_group text
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.users FOR DELETE USING (auth.uid() = id);

-- ========= SUBJECTS =========
CREATE TABLE public.subjects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_name text NOT NULL,
    subject_code text,
    faculty_name text,
    type text CHECK (type IN ('Theory', 'Lab')),
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own subjects" ON public.subjects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========= TIMETABLE =========
CREATE TABLE public.timetable (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
    day_of_week text NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    room_location text,
    group_designation text,
    is_elective boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own timetable" ON public.timetable
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========= ATTENDANCE =========
CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    timetable_id uuid NOT NULL REFERENCES public.timetable(id) ON DELETE CASCADE,
    subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
    date date NOT NULL,
    status text NOT NULL CHECK (status IN ('Present', 'Absent', 'Cancelled')),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(timetable_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own attendance" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own attendance" ON public.attendance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can read their own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own attendance" ON public.attendance FOR DELETE USING (auth.uid() = user_id);
