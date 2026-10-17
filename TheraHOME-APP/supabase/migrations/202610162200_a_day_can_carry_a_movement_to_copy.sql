-- Where the specialist's movement lives, for "tập cùng chuyên viên".
--
-- A day already carries a video to WATCH (program_days.video_url_*, an
-- unlisted YouTube link). This adds the second thing a day can carry: a
-- short clip to COPY, with the specialist's own keypoints precomputed, so
-- the app can colour the customer's limbs as they move.
--
-- WHY A SEPARATE TABLE and not two more columns on program_days. Both
-- queries in src/hooks/usePrograms.ts list that table's columns by name,
-- and so do createProgramDay/updateProgramDay in the WEB console. Adding
-- columns there means every roadmap screen pays to fetch a 50 KB keypoint
-- track it will never draw. One row, read only by the screen that needs
-- it, costs the rest of the app nothing.
--
-- WHY THE BUCKET IS PRIVATE. This is a paid feature, and the gate has to be
-- somewhere the client cannot talk its way past. It is here: without a
-- subscription, `createSignedUrl` is refused by the policy below, so there
-- is no clip — whatever the app's own `usePlanGate` dialog does or does not
-- do. `public.active_plan_code()` already returns a plan for
-- `account_type = 'review'`, so App Review accounts are exempt, as
-- everywhere else.

create table if not exists public.exercise_references (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null unique references public.program_days(id) on delete cascade,

  -- Path inside the `exercise-reference` bucket. Nullable so a track can be
  -- uploaded and reviewed before its clip is in place.
  clip_path text,

  -- The output of scripts/pose-track.py: { version, view, fps, duration,
  -- frameWidth, frameHeight, samples: [{ t, p: { joint: [x,y,c] } }] }.
  -- Validated in the client by `isPoseTrack` — JSON off the network is a
  -- real boundary, not a formality.
  track jsonb,

  -- Per-exercise scoring. Which angles are judged, how far out is "warn"
  -- and "bad", whether the customer copies the demonstration as in a
  -- mirror. Empty means the defaults for the track's `view`.
  config jsonb not null default '{}'::jsonb,

  -- Nothing is shown to a customer until a human has watched the QC video
  -- the generator produces. A track that is quietly wrong for two seconds
  -- in the middle tells someone their good form is bad.
  published boolean not null default false,

  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exercise_references_published_idx
  on public.exercise_references (program_day_id) where published;

alter table public.exercise_references enable row level security;

-- Customers: only published rows, only with a plan. Staff: everything,
-- because they are the ones deciding whether it is fit to publish.
drop policy if exists "read published exercise references with a plan" on public.exercise_references;
create policy "read published exercise references with a plan"
on public.exercise_references
for select
to authenticated
using (
  (published and public.active_plan_code() is not null)
  or 'admin' = any (public.current_web_roles())
  or 'cskh' = any (public.current_web_roles())
);

-- There is no customer-facing write path at all: this is catalogue content,
-- authored in the WEB console like every other part of a day.
drop policy if exists "admin writes exercise references" on public.exercise_references;
create policy "admin writes exercise references"
on public.exercise_references
for all
to authenticated
using ('admin' = any (public.current_web_roles()))
with check ('admin' = any (public.current_web_roles()));

-- Which days HAVE a demonstration, for everyone — including the customers
-- who cannot read one.
--
-- The policy above hides the whole row from an account with no plan, which
-- is right for the track and wrong for the card that offers to sell it: a
-- day with no reference must not advertise one, and a day that has one must
-- say so to exactly the people who have not paid yet. A function rather
-- than a view, so the rest of the row stays unreachable and the security
-- advisor has nothing to say about a view that bypasses RLS.
create or replace function public.days_with_exercise_reference()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select program_day_id from public.exercise_references where published
$$;

revoke all on function public.days_with_exercise_reference() from public, anon, authenticated;
grant execute on function public.days_with_exercise_reference() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-reference',
  'exercise-reference',
  false,
  52428800, -- 50 MB. A 20-second 1080p clip is ~25 MB; this leaves room.
  array['video/mp4', 'video/quicktime']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "read exercise clips with a plan" on storage.objects;
create policy "read exercise clips with a plan"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'exercise-reference'
  and (
    public.active_plan_code() is not null
    or 'admin' = any (public.current_web_roles())
    or 'cskh' = any (public.current_web_roles())
  )
);

drop policy if exists "admin upload exercise clips" on storage.objects;
create policy "admin upload exercise clips"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'exercise-reference'
  and 'admin' = any (public.current_web_roles())
);

drop policy if exists "admin update exercise clips" on storage.objects;
create policy "admin update exercise clips"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'exercise-reference'
  and 'admin' = any (public.current_web_roles())
)
with check (
  bucket_id = 'exercise-reference'
  and 'admin' = any (public.current_web_roles())
);

drop policy if exists "admin delete exercise clips" on storage.objects;
create policy "admin delete exercise clips"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'exercise-reference'
  and 'admin' = any (public.current_web_roles())
);
