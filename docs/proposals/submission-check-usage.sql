-- PROPOSAL ONLY: NOT APPLIED. Needs Faisal's approval before it is run on the
-- production database (it adds one table; it changes no existing table).
--
-- Durable per-user quota for Submission Check live runs. Today the beta uses
-- an allow-list plus in-memory rate limits (lib/submission/access.js), which is
-- enough for a small controlled beta but resets when a server instance restarts.
-- With this table the API can count live checks per user per month, the same
-- way /api/analyze counts rows in `analyses`.
--
-- Stores no proposal text and no findings: only who ran a check, when, its size and AI cost.

create table if not exists public.submission_check_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  analysis_id uuid references public.analyses (id) on delete set null,
  created_at  timestamptz not null default now(),
  requirements integer not null default 0,
  pages        integer not null default 0,
  ai_cost_usd  numeric(10, 4),
  status       text not null default 'started' check (status in ('started', 'done', 'failed'))
);

create index if not exists submission_check_runs_user_month on public.submission_check_runs (user_id, created_at desc);

alter table public.submission_check_runs enable row level security;

-- Users can see their own usage; only the server (service role) inserts rows.
create policy "own submission check runs" on public.submission_check_runs
  for select using (auth.uid() = user_id);
