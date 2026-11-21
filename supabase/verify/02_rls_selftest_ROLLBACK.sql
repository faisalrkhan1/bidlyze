-- Bidlyze RLS self-test. Run AFTER the harden_core_rls migration.
-- Everything runs inside a transaction that is ROLLED BACK at the end,
-- so it changes nothing — it only reports what a signed-in user (or anyone
-- holding the public anon key) could do.
--
-- Run in: Supabase Dashboard → SQL Editor → paste → Run.
-- Acts as one real existing user (A) and tries to touch another user's (B) data.
--
-- The results appear as a red ERROR message. That is deliberate: raising an
-- error is how the test reports in the SQL editor (which only shows the last
-- statement), and it guarantees every change the test attempted is undone.
-- Expected after the migration: every entry says "OK".

begin;

-- Pick two real users: A (has analyses; we act as them) and B (someone else).
select set_config('selftest.a', (select user_id::text from public.analyses group by user_id order by count(*) desc limit 1), true);
select set_config('selftest.b', (select user_id::text from public.subscriptions where user_id::text <> current_setting('selftest.a') limit 1), true),
       set_config('request.jwt.claims', json_build_object('sub', current_setting('selftest.a'), 'role', 'authenticated')::text, true);

create temporary table selftest_results (test text, result text) on commit drop;
grant all on selftest_results to authenticated, anon;

set local role authenticated;

-- Isolation
insert into selftest_results
select 'A sees B''s analyses', count(*)::text from public.analyses where user_id <> auth.uid()
union all select 'A sees B''s subscriptions', count(*)::text from public.subscriptions where user_id <> auth.uid()
union all select 'A sees B''s risk checks', count(*)::text from public.disqualification_analyses where user_id <> auth.uid()
union all select 'A sees B''s tender files', count(*)::text from storage.objects
  where bucket_id = 'tender-uploads' and (storage.foldername(name))[1] <> auth.uid()::text;

-- Billing integrity
with u as (update public.subscriptions set analyses_limit = 99999, plan = 'enterprise' where user_id = auth.uid() returning 1)
insert into selftest_results select 'A raises own plan/limit', count(*)::text from u;

-- Usage-limit bypass: back-date own analyses
with u as (update public.analyses set created_at = '2000-01-01' where user_id = auth.uid() returning created_at)
insert into selftest_results select 'A back-dates own analyses', count(*) filter (where created_at = '2000-01-01')::text from u;

-- Usage-limit bypass: delete own analyses
do $$
declare n int;
begin
  delete from public.analyses where user_id = auth.uid();
  get diagnostics n = row_count;
  insert into selftest_results values ('A deletes own analyses', n::text);
exception when others then
  insert into selftest_results values ('A deletes own analyses', 'blocked');
end$$;

-- Planting rows in someone else's account
do $$
begin
  insert into public.analyses (user_id, project_name) values (current_setting('selftest.b')::uuid, 'planted');
  insert into selftest_results values ('A inserts analysis into B''s account', 'ALLOWED');
exception when others then
  insert into selftest_results values ('A inserts analysis into B''s account', 'blocked');
end$$;

-- In-app edits must save (this used to fail silently)
with u as (update public.analyses set notes = notes where user_id = auth.uid() returning 1)
insert into selftest_results select 'A can save edits to own analyses', count(*)::text from u;

reset role;
set local role anon;
do $$
begin
  insert into public.analyses (user_id, project_name) values (current_setting('selftest.b')::uuid, 'planted');
  insert into selftest_results values ('anonymous inserts analysis into B''s account', 'ALLOWED');
exception when others then
  insert into selftest_results values ('anonymous inserts analysis into B''s account', 'blocked');
end$$;
reset role;

-- Structural: no user-facing write policies on subscriptions / risk checks
insert into selftest_results
select 'write policies on subscriptions', count(*)::text from pg_policies
 where schemaname = 'public' and tablename = 'subscriptions' and cmd <> 'SELECT'
union all
select 'write policies on risk checks', count(*)::text from pg_policies
 where schemaname = 'public' and tablename = 'disqualification_analyses' and cmd <> 'SELECT';

do $$
begin
  raise exception 'SELFTEST RESULTS (all changes rolled back): %', (
    select json_agg(json_build_object(
      'test', test, 'result', result,
      'verdict', case
        when test = 'A can save edits to own analyses' then case when result::int > 0 then 'OK' else 'PROBLEM' end
        when result in ('0', 'blocked') then 'OK'
        else 'PROBLEM' end))
    from selftest_results);
end$$;
