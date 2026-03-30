-- 1. Create the attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    timetable_id uuid NOT NULL REFERENCES public.timetable(id) ON DELETE CASCADE,
    date date NOT NULL,
    status text NOT NULL CHECK (status IN ('Present', 'Absent', 'Cancelled')),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(timetable_id, date) -- A slot can only have one attendance record per day
);

-- 2. Turn on RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Users can insert their own attendance" 
ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance" 
ON public.attendance FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can read their own attendance" 
ON public.attendance FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own attendance"
ON public.attendance FOR DELETE USING (auth.uid() = user_id);
