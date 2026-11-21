-- Harden Row Level Security on the core tables.  NOT YET APPLIED.
--
-- Why: the analyses, subscriptions and disqualification_analyses tables were
-- created in the Supabase dashboard, so their policies are not in version
-- control and have never been reviewed. The app's usage limit and plan come
-- from these tables, so the database itself must stop a signed-in user from:
--   * raising their own plan or analyses_limit (subscriptions),
--   * back-dating created_at to reset the monthly usage count (analyses),
--   * moving a row to another user (analyses.user_id),
--   * reading anyone else's rows or uploaded tender files.
--
-- What the app actually needs (checked against every query in the code):
--   analyses                  SELECT/UPDATE own rows (browser); INSERT own rows
--                             (bid-compare/workspace, currently disabled).
--                             Main analysis rows are inserted server-side with
--                             the service role, which bypasses RLS.
--   subscriptions             SELECT own row only. All writes are server-side.
--   disqualification_analyses SELECT own rows only. All writes are server-side.
--   storage tender-uploads    SELECT (download) of files in the user's own
--                             folder "<user_id>/...". Uploads use signed URLs
--                             created server-side, so no INSERT policy needed.
--
-- This replaces whatever policies exist on those three tables with exactly
-- that set. Run supabase/verify/01_rls_audit_READ_ONLY.sql first and keep its
-- output, so the old policies are on record.
--
-- Apply: Supabase Dashboard → SQL Editor → paste → Run (after approval).
-- Then run supabase/verify/02_rls_selftest_ROLLBACK.sql to prove it works.

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
-- Customer deletion will be a server-side route that removes the files and
-- content but keeps a content-free row for usage metering.

-- user_id and created_at never change after insert (created_at drives the
-- monthly usage limit).
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

-- ── storage: tender-uploads ─────────────────────────────────────────────────
-- Private bucket, and enforce the 50 MB limit on the storage side too (the
-- signed-upload route only checks the size the browser *declares*).
-- File types are NOT restricted here: the browser uploads with whatever type
-- the operating system reports (sometimes empty -> application/octet-stream),
-- so a type list would block real tenders. /api/analyze validates the type.
update storage.buckets
set public = false,
    file_size_limit = 52428800
where id = 'tender-uploads';

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%tender-uploads%' or coalesce(with_check, '') ilike '%tender-uploads%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end$$;

create policy "tender_uploads_read_own_folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'tender-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
