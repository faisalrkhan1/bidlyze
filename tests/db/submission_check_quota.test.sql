-- Tests for docs/proposals/2026-11-22_submission_check_beta_quota.sql on plain Postgres
-- (tests/db/supabase_stub.sql stands in for Supabase). Every check raises on failure.
-- Run: bash tests/db/run_quota_tests.sh
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333')
on conflict do nothing;
create temp table baseline as select (select count(*) from public.analyses) as analyses;
grant select on baseline to public;

create or replace function pg_temp.assert(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok - %', what;
end $$;

-- limits used by the tests
\pset tuples_only on
\pset format unaligned
\set L '{"checks_per_month": 3, "tenders_per_month": 2, "per_hour": 6, "cost_cap_usd_per_month": 5, "global_cost_usd_per_day": 50}'

set role service_role;

-- 1. a claim is allowed and creates a running row
select pg_temp.assert((public.submission_check_claim('11111111-1111-1111-1111-111111111111', 'a@x.com', 'req-0000-0001', 'tender', false, :'L') ->> 'allowed')::boolean, 'claim allowed');
select pg_temp.assert((select count(*) = 1 and bool_and(status = 'running') from public.submission_check_runs where user_id = '11111111-1111-1111-1111-111111111111'), 'running row created');

-- 2. same request id again = duplicate, no second row
select pg_temp.assert(public.submission_check_claim('11111111-1111-1111-1111-111111111111', 'a@x.com', 'req-0000-0001', 'tender', false, :'L') ->> 'code' = 'duplicate', 'duplicate request id is not a second run');
select pg_temp.assert((select count(*) = 1 from public.submission_check_runs where user_id = '11111111-1111-1111-1111-111111111111'), 'still one row');

-- 3. a second run while one is running = busy
select pg_temp.assert(public.submission_check_claim('11111111-1111-1111-1111-111111111111', 'a@x.com', 'req-0000-0002', 'check', false, :'L') ->> 'code' = 'busy', 'one run at a time');

-- 4. finish it (with cost and analysis id), then the next claim is allowed
insert into public.analyses (id, user_id) values ('aaaaaaaa-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111');
select pg_temp.assert(public.submission_check_finish((select id from public.submission_check_runs where request_id = 'req-0000-0001'), '11111111-1111-1111-1111-111111111111', 'succeeded', 0.21, null, 'aaaaaaaa-0000-0000-0000-0000000000c1', 7, 39), 'finish succeeded');
select pg_temp.assert(not public.submission_check_finish((select id from public.submission_check_runs where request_id = 'req-0000-0001'), '11111111-1111-1111-1111-111111111111', 'failed', 9, 'x', null, 0, 0), 'a finished run cannot be finished again');
select pg_temp.assert(not public.submission_check_finish((select id from public.submission_check_runs where request_id = 'req-0000-0001'), '22222222-2222-2222-2222-222222222222', 'failed', 9, 'x', null, 0, 0), 'another user cannot finish my run');
select pg_temp.assert((select status = 'succeeded' and ai_cost_usd = 0.21 and analysis_id is not null from public.submission_check_runs where request_id = 'req-0000-0001'), 'run recorded with cost and analysis');
select pg_temp.assert(public.submission_check_claim('11111111-1111-1111-1111-111111111111', 'a@x.com', 'req-0000-0001', 'tender', false, :'L') ->> 'analysis_id' = 'aaaaaaaa-0000-0000-0000-0000000000c1', 'duplicate of a finished tender run returns its analysis');

-- 5. monthly checks: 3 allowed; failed runs do not use the allowance
do $$
declare i int; r jsonb;
begin
  for i in 1..3 loop
    r := public.submission_check_claim('11111111-1111-1111-1111-111111111111', 'a@x.com', 'chk-0000-000' || i, 'check', false, '{"checks_per_month": 3, "per_hour": 20}');
    if not (r ->> 'allowed')::boolean then raise exception 'FAILED: check % not allowed: %', i, r; end if;
    perform public.submission_check_finish((r ->> 'run_id')::uuid, '11111111-1111-1111-1111-111111111111', case when i = 2 then 'failed' else 'succeeded' end, 0.1, null, null, 10, 30);
  end loop;
end $$;
select pg_temp.assert((public.submission_check_claim('11111111-1111-1111-1111-111111111111', 'a@x.com', 'chk-0000-0004', 'check', false, '{"checks_per_month": 3, "per_hour": 20}') ->> 'allowed')::boolean, 'a failed check does not use the monthly allowance');
select public.submission_check_finish((select id from public.submission_check_runs where request_id = 'chk-0000-0004'), '11111111-1111-1111-1111-111111111111', 'succeeded', 0.1, null, null, 1, 1);
select pg_temp.assert(public.submission_check_claim('11111111-1111-1111-1111-111111111111', 'a@x.com', 'chk-0000-0005', 'check', false, '{"checks_per_month": 3, "per_hour": 20}') ->> 'code' = 'monthly_checks', 'fourth successful check this month is refused');
select pg_temp.assert(public.submission_check_claim('11111111-1111-1111-1111-111111111111', 'a@x.com', 'tnd-0000-0002', 'tender', false, '{"checks_per_month": 3, "tenders_per_month": 1, "per_hour": 20}') ->> 'code' = 'monthly_tenders', 'tender allowance is separate');

-- 6. hourly rate counts failed runs too
do $$
declare i int;
begin
  for i in 1..6 loop
    insert into public.submission_check_runs (user_id, request_id, kind, status, started_at, ai_cost_usd)
    values ('22222222-2222-2222-2222-222222222222', 'old-0000-000' || i, 'check', 'failed', now() - interval '10 minutes', 0);
  end loop;
end $$;
select pg_temp.assert(public.submission_check_claim('22222222-2222-2222-2222-222222222222', 'b@x.com', 'rate-000-0001', 'check', false, :'L') ->> 'code' = 'rate', 'six runs in an hour (even failed) = rate limited');
select pg_temp.assert((public.submission_check_claim('22222222-2222-2222-2222-222222222222', 'b@x.com', 'rate-000-0001', 'check', false, :'L') ->> 'retry_after')::int between 60 and 3600, 'rate limit says when to retry');

-- 7. a run left 'running' after a crash stops blocking after 10 minutes
insert into public.submission_check_runs (user_id, request_id, kind, status, started_at) values ('33333333-3333-3333-3333-333333333333', 'crash-00-0001', 'check', 'running', now() - interval '11 minutes');
select pg_temp.assert((public.submission_check_claim('33333333-3333-3333-3333-333333333333', 'c@x.com', 'after-00-0001', 'check', false, :'L') ->> 'allowed')::boolean, 'stale running row does not block');
select public.submission_check_finish((select id from public.submission_check_runs where request_id = 'after-00-0001'), '33333333-3333-3333-3333-333333333333', 'succeeded', 4.95, null, null, 1, 1);

-- 8. monthly cost cap
select pg_temp.assert(public.submission_check_claim('33333333-3333-3333-3333-333333333333', 'c@x.com', 'cost-000-0001', 'check', false, :'L') ->> 'allowed' = 'true', 'under the cost cap');
select public.submission_check_finish((select id from public.submission_check_runs where request_id = 'cost-000-0001'), '33333333-3333-3333-3333-333333333333', 'failed', 0.10, 'ai_failed', null, 0, 0);
select pg_temp.assert(public.submission_check_claim('33333333-3333-3333-3333-333333333333', 'c@x.com', 'cost-000-0002', 'check', false, :'L') ->> 'code' = 'monthly_cost', 'cost cap reached (failed runs still cost money)');

-- 9. beta list: required in production
select pg_temp.assert(public.submission_check_claim('22222222-2222-2222-2222-222222222222', 'b@x.com', 'beta-000-0001', 'check', true, :'L') ->> 'code' = 'not_in_beta', 'not on the list = refused');
insert into public.submission_check_beta_users (email, enabled, checks_per_month) values ('b@x.com', false, 1);
select pg_temp.assert(public.submission_check_claim('22222222-2222-2222-2222-222222222222', 'B@X.com ', 'beta-000-0002', 'check', true, :'L') ->> 'code' = 'not_in_beta', 'disabled tester = refused (e-mail matched case-insensitively)');
update public.submission_check_beta_users set enabled = true, expires_at = now() - interval '1 day' where email = 'b@x.com';
select pg_temp.assert(public.submission_check_claim('22222222-2222-2222-2222-222222222222', 'b@x.com', 'beta-000-0003', 'check', true, :'L') ->> 'code' = 'not_in_beta', 'expired tester = refused');
update public.submission_check_beta_users set expires_at = null where email = 'b@x.com';
delete from public.submission_check_runs where user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.assert((public.submission_check_claim('22222222-2222-2222-2222-222222222222', 'b@x.com', 'beta-000-0004', 'check', true, :'L') ->> 'allowed')::boolean, 'enabled tester = allowed');
select public.submission_check_finish((select id from public.submission_check_runs where request_id = 'beta-000-0004'), '22222222-2222-2222-2222-222222222222', 'succeeded', 0.1, null, null, 1, 1);
select pg_temp.assert(public.submission_check_claim('22222222-2222-2222-2222-222222222222', 'b@x.com', 'beta-000-0005', 'check', true, :'L') ->> 'code' = 'monthly_checks', 'per-tester limit (1 check) overrides the default (3)');
select pg_temp.assert((public.submission_check_usage('22222222-2222-2222-2222-222222222222', 'b@x.com', :'L') -> 'limits' ->> 'checks_per_month')::int = 1 and (public.submission_check_usage('22222222-2222-2222-2222-222222222222', 'b@x.com', :'L') -> 'used' ->> 'checks')::int = 1, 'usage shows the tester''s own limit and use');

-- 10. global daily cost cap protects against a leaked account
reset role;
insert into auth.users (id) values ('44444444-4444-4444-4444-444444444444') on conflict do nothing;
set role service_role;
insert into public.submission_check_runs (user_id, request_id, kind, status, started_at, ai_cost_usd, finished_at) values ('44444444-4444-4444-4444-444444444444', 'big-0000-0001', 'check', 'succeeded', now() - interval '2 hours', 60, now());
select pg_temp.assert(public.submission_check_claim('11111111-1111-1111-1111-111111111111', 'a@x.com', 'glob-000-0001', 'tender', false, '{"tenders_per_month": 99, "per_hour": 99, "cost_cap_usd_per_month": 99, "global_cost_usd_per_day": 50}') ->> 'code' = 'global_cost', 'all checks pause when the daily total passes the global cap');
delete from public.submission_check_runs where user_id = '44444444-4444-4444-4444-444444444444';
reset role;

-- 11. browsers: can read only their own runs, cannot write, cannot call the functions or read the beta list
begin;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.assert((select count(*) > 0 and bool_and(user_id = '11111111-1111-1111-1111-111111111111') from public.submission_check_runs), 'user sees only own runs');
rollback;

do $$ begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  begin
    insert into public.submission_check_runs (user_id, request_id, kind) values ('11111111-1111-1111-1111-111111111111', 'forged-000001', 'check');
    raise exception 'FAILED: user could insert a run';
  exception when insufficient_privilege then raise notice 'ok - user cannot insert runs';
  end;
  begin
    perform public.submission_check_claim('11111111-1111-1111-1111-111111111111', 'a@x.com', 'forged-000002', 'check', false, '{}');
    raise exception 'FAILED: user could call claim';
  exception when insufficient_privilege then raise notice 'ok - user cannot call submission_check_claim';
  end;
  begin
    perform public.submission_check_finish(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'succeeded', 0, null, null, 0, 0);
    raise exception 'FAILED: user could call finish';
  exception when insufficient_privilege then raise notice 'ok - user cannot call submission_check_finish';
  end;
  begin
    perform count(*) from public.submission_check_beta_users;
    raise exception 'FAILED: user could read the beta list';
  exception when insufficient_privilege then raise notice 'ok - user cannot read the beta list';
  end;
end $$;

do $$ begin
  set local role anon;
  begin
    perform count(*) from public.submission_check_runs;
    raise exception 'FAILED: anon could read runs';
  exception when insufficient_privilege then raise notice 'ok - anonymous visitors cannot read runs';
  end;
end $$;

-- 12. existing tables untouched: analyses still has its columns and rows
select pg_temp.assert((select count(*) from public.analyses) = (select analyses + 1 from baseline), 'analyses rows unchanged apart from the one this test added');

\echo ALL QUOTA SQL TESTS PASSED
