-- Bidlyze RLS self-test. Run AFTER the harden_core_rls migration.
-- Everything runs inside a transaction that is ROLLED BACK at the end,
-- so it changes nothing — it only reports what a signed-in user could do.
--
-- Run in: Supabase Dashboard → SQL Editor → paste → Run.
-- It acts as one real existing user (taken from the subscriptions table).
--
-- Expected after the migration:
--   * every "other users' ... visible" count = 0
--   * "own plan self-upgrade" = 0
--   * "own analyses back-dated" = 0   (created_at is locked)
--   * "own analyses deleted" = 0      (users cannot delete rows to reset usage)
--   * "own files readable" = how many files that user uploaded (must still work)

begin;

-- Act as a real signed-in user.
select set_config(
         'request.jwt.claims',
         json_build_object('sub', user_id::text, 'role', 'authenticated')::text,
         true
       ) is not null as impersonating_user
from public.subscriptions
limit 1;

set local role authenticated;

-- Isolation: can this user see anyone else's data?
select 'other users'' analyses visible' as test, count(*) as result from public.analyses where user_id <> auth.uid()
union all
select 'other users'' subscriptions visible', count(*) from public.subscriptions where user_id <> auth.uid()
union all
select 'other users'' risk checks visible', count(*) from public.disqualification_analyses where user_id <> auth.uid()
union all
select 'other users'' tender files visible', count(*) from storage.objects
  where bucket_id = 'tender-uploads' and (storage.foldername(name))[1] <> auth.uid()::text
union all
select 'own files readable (should be > 0 if they uploaded)', count(*) from storage.objects
  where bucket_id = 'tender-uploads' and (storage.foldername(name))[1] = auth.uid()::text;

-- Billing integrity: can this user raise their own limit?
with u as (
  update public.subscriptions set analyses_limit = 99999, plan = 'enterprise'
  where user_id = auth.uid() returning 1
)
select 'own plan self-upgrade' as test, count(*) as result from u;

-- Usage-limit bypass 1: back-date own analyses so they fall out of "this month".
with u as (
  update public.analyses set created_at = '2000-01-01'
  where user_id = auth.uid() returning created_at
)
select 'own analyses back-dated' as test, count(*) filter (where created_at = '2000-01-01') as result from u;

-- Usage-limit bypass 2: delete own analyses to reset the monthly count.
-- (Wrapped so a foreign-key error is reported instead of stopping the test.)
do $$
declare n int;
begin
  delete from public.analyses where user_id = auth.uid();
  get diagnostics n = row_count;
  perform set_config('selftest.deleted', n::text, true);
exception when others then
  perform set_config('selftest.deleted', 'error: ' || sqlerrm, true);
end$$;
select 'own analyses deleted' as test, current_setting('selftest.deleted') as result;

reset role;
rollback;
