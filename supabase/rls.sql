-- Run this in the Supabase SQL editor to lock down quiz data per user.
-- Adjust as needed for your schema; backfill existing rows with your user IDs before enabling RLS.

-- Add user ownership columns
alter table public.quizzes add column if not exists user_id uuid references auth.users(id);
alter table public.rounds add column if not exists user_id uuid references auth.users(id);
alter table public.quiz_players add column if not exists user_id uuid references auth.users(id);
alter table public.players add column if not exists user_id uuid references auth.users(id);

-- Optional: add uniqueness scoped by user
create unique index if not exists quizzes_user_date_idx on public.quizzes (user_id, quiz_date);
create unique index if not exists players_user_name_idx on public.players (user_id, lower(name));

-- Enable RLS
alter table public.quizzes enable row level security;
alter table public.rounds enable row level security;
alter table public.quiz_players enable row level security;
alter table public.players enable row level security;

-- Policies: only allow the row owner to read/write
create policy "quizzes_select_own" on public.quizzes
  for select using (user_id = auth.uid());
create policy "quizzes_insert_own" on public.quizzes
  for insert with check (user_id = auth.uid());
create policy "quizzes_update_own" on public.quizzes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "rounds_select_own" on public.rounds
  for select using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid())
  );
create policy "rounds_insert_own" on public.rounds
  for insert with check (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid())
  );
create policy "rounds_update_own" on public.rounds
  for update using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid())
  );

create policy "players_select_own" on public.players
  for select using (user_id = auth.uid());
create policy "players_upsert_own" on public.players
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "quiz_players_select_own" on public.quiz_players
  for select using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid())
  );
create policy "quiz_players_insert_own" on public.quiz_players
  for insert with check (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid())
  );
create policy "quiz_players_update_own" on public.quiz_players
  for update using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid())
  );

-- If you want formats to be user-specific too, mirror the above pattern on quiz_formats and quiz_format_rounds.
