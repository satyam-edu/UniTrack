-- Persists the original timetable image/PDF a student uploaded, so it can be
-- shown back to them later (e.g. on the /timetable page) to cross-check the
-- AI's extraction against the source. One row per user — a re-import
-- overwrites the previous source, consistent with the timetable itself being
-- fully replaced on re-import.

create table if not exists timetable_source (
  user_id      uuid primary key references users(id) on delete cascade,
  storage_path text not null,
  mime_type    text not null,
  uploaded_at  timestamptz not null default now()
);

alter table timetable_source enable row level security;

create policy "Users can read own timetable source"
  on timetable_source for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy for authenticated clients — written only by
-- the service role (see src/app/actions/timetableSource.ts), same pattern as
-- subject_catalog and api_usage.

insert into storage.buckets (id, name, public)
values ('timetable-sources', 'timetable-sources', false)
on conflict (id) do nothing;

create policy "Users can read own timetable source files"
  on storage.objects for select
  using (
    bucket_id = 'timetable-sources'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No client-facing insert/update/delete policy on storage.objects either —
-- uploads go through the service role from the server action.
