-- Harden Row Level Security on the core tables and fix two schema gaps.
--
-- Written against the live policies found by supabase/verify/01_rls_audit_READ_ONLY.sql
-- on 21 Nov 2026 (project ufamfwmdzwrjvubaaohb):
--
--   analyses       "Service can insert analyses"  INSERT WITH CHECK (true), role public
--                    -> anyone holding the public anon key could insert analysis
--                       rows under ANY user's id (fake tenders in their dashboard,
--                       or use up their monthly allowance).
--                  NO UPDATE policy
--                    -> every in-app edit (compliance matrix, requirement status,
--                       notes, tender status, decisions) silently failed to save.
--   subscriptions  "Users can insert own subscription"  INSERT WITH CHECK (auth.uid() = user_id)
--                    -> a new user could create their own row with any plan and
--                       analyses_limit before the server provisions one.
--   disqualification_analyses  users could insert/update/delete their own risk
--                    checks (all writes are meant to come from the server).
--   analyses.clarifications column missing -> the Clarification Register could
--                    not save.
--   tender-uploads bucket allows only PDF/DOCX/TXT -> XLSX (BOQ) uploads,
--                    which the app offers, were rejected by storage.
--
-- What the app needs (checked against every query in the code):
--   analyses                  SELECT/UPDATE own rows (browser); INSERT own rows
--                             (bid-compare/workspace, currently disabled).
--                             The server inserts with the service role, which
--                             bypasses RLS, so no "insert anything" policy.
--   subscriptions             SELECT own row only. All writes are server-side.
--   disqualification_analyses SELECT own rows only. All writes are server-side.
--   storage tender-uploads    existing own-folder policies are correct; unchanged.
--
-- Safe to run more than once.

begin;

-- ── analyses ────────────────────────────────────────────────────────────────
alter table public.analyses enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'analyses' loop
    execute format('drop policy %I on public.analyses', p.policyname);
  end loop;
end$$;

create policy "analyses_select_own" on public.analyses
  for select to authenticated using (auth.uid() = user_id);
create policy "analyses_insert_own" on public.analyses
  for insert to authenticated with check (auth.uid() = user_id);
create policy "analyses_update_own" on public.analyses
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- No DELETE policy: deleting rows would reset the monthly usage count.
-- Customers delete tenders through /api/analysis/delete, which removes the
-- files and content but keeps a content-free row for usage metering.

-- user_id and created_at never change after insert (created_at drives the
-- monthly usage limit, so back-dating would reset it).
create or replace function public.analyses_lock_owner_and_created()
returns trigger language plpgsql as $$
begin
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists trg_analyses_lock_owner_and_created on public.analyses;
create trigger trg_analyses_lock_owner_and_created
  before update on public.analyses
  for each row execute function public.analyses_lock_owner_and_created();

-- Clarification Register saves here (app/components/ClarificationRegister.js).
alter table public.analyses add column if not exists clarifications jsonb;

-- ── subscriptions ───────────────────────────────────────────────────────────
alter table public.subscriptions enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'subscriptions' loop
    execute format('drop policy %I on public.subscriptions', p.policyname);
  end loop;
end$$;

create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE for users: plan and limits are set only by the
-- server (welcome route, payment webhook) using the service role.

-- ── disqualification_analyses ───────────────────────────────────────────────
alter table public.disqualification_analyses enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'disqualification_analyses' loop
    execute format('drop policy %I on public.disqualification_analyses', p.policyname);
  end loop;
end$$;

create policy "disqualification_select_own" on public.disqualification_analyses
  for select to authenticated using (auth.uid() = user_id);

-- ── storage bucket ──────────────────────────────────────────────────────────
-- Private; 50 MB per file (the app's own limit); the four file types the app
-- accepts, now including XLSX for BOQs. Storage access policies are unchanged.
update storage.buckets
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
where id = 'tender-uploads';

commit;
