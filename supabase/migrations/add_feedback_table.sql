-- Feedback inbox for the in-app feedback button. Write-only from the
-- client's perspective: a student can submit feedback, but never read
-- anyone's feedback back (including their own) — it's checked from the
-- Supabase dashboard, not surfaced anywhere in the app.

CREATE TABLE public.feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can submit feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);
