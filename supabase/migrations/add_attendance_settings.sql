-- 1. Add the new columns
ALTER TABLE public.users
ADD COLUMN target_attendance integer NULL,
ADD COLUMN theory_mode text DEFAULT 'class'::text CHECK (theory_mode IN ('class', 'hour')),
ADD COLUMN lab_mode text DEFAULT 'class'::text CHECK (lab_mode IN ('class', 'hour'));

-- 2. Optional: If you want to drop the weight_per_class column from subjects later, 
-- you can run this (but only after you are sure you don't need the legacy data):
-- ALTER TABLE public.subjects DROP COLUMN weight_per_class;
