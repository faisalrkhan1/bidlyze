-- ============================================================================
-- PROPOSAL ONLY: NOT APPLIED. Needs Faisal's approval before it is run on the
-- production database (Supabase project "bidlyze", SQL editor).
--
-- Submission Check closed beta: who may run paid AI checks, and durable usage
-- limits that survive server restarts and apply across all server instances.
--
-- Adds two tables and three functions. Changes NO existing table, policy or row.
-- Safe to run twice (if not exists / create or replace).
-- Rollback: see the end of this file.
--
-- Stores no document text and no findings: only who ran a check, when, its
-- status, size and AI cost, and the id of the tender analysis it created.
-- Supersedes docs/proposals/submission-check-usage.sql (never applied).
-- ============================================================================

begin;

-- ── 1. Beta access list ─────────────────────────────────────────────────────
-- One row per invited tester. Add or remove testers here (Table Editor or SQL);
-- no redeploy needed. Limit columns left empty use the server defaults.
create table if not exists public.submission_check_beta_users (
  email                   text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  enabled                 boolean not null default true,
  checks_per_month        integer check (checks_per_month >= 0),
  tenders_per_month       integer check (tenders_per_month >= 0),
  cost_cap_usd_per_month  numeric(10, 2) check (cost_cap_usd_per_month >= 0),
  expires_at              timestamptz,
  note                    text,
  created_at              timestamptz not null default now()
);
alter table public.submission_check_beta_users enable row level security;
-- No policies: browsers (anon/authenticated) cannot read or change the list.
revoke all on public.submission_check_beta_users from anon, authenticated;

-- ── 2. Run log ──────────────────────────────────────────────────────────────
-- One row per paid AI run: reading a tender's requirements ('tender') or
-- checking a proposal ('check').
create table if not exists public.submission_check_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  request_id    text not null check (char_length(request_id) between 8 and 80),
  kind          text not null check (kind in ('tender', 'check')),
  status        text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  ai_cost_usd   numeric(10, 4) check (ai_cost_usd >= 0),
  -- Upper-bound cost booked when the run starts (from the document size), so runs that
  -- are still in flight count against the cost caps until their real cost is known.
  reserved_usd  numeric(10, 4) not null default 0 check (reserved_usd >= 0),
  error_code    text check (char_length(error_code) <= 60),
  analysis_id   uuid references public.analyses (id) on delete set null,
  pages         integer check (pages >= 0),
  requirements  integer check (requirements >= 0),
  unique (user_id, request_id)
);
create index if not exists submission_check_runs_user_started on public.submission_check_runs (user_id, started_at desc);
create index if not exists submission_check_runs_started on public.submission_check_runs (started_at desc);

alter table public.submission_check_runs enable row level security;
revoke all on public.submission_check_runs from anon, authenticated;
grant select on public.submission_check_runs to authenticated;
drop policy if exists "submission_check_runs_select_own" on public.submission_check_runs;
create policy "submission_check_runs_select_own" on public.submission_check_runs
  for select to authenticated using (auth.uid() = user_id);
-- No insert/update/delete policies: only the server functions below write.

-- ── 3. Claim a run (called by the server before any paid AI call) ───────────
-- Claims are serialised by ONE transaction-level advisory lock for all users, so
-- two requests at the same moment (same user or different users) cannot both pass
-- a limit. A claim takes a few milliseconds, so this costs nothing at beta scale.
-- Cost caps count real costs of finished runs PLUS the reserved (upper-bound) cost
-- of runs still in flight, and the new run's own reservation must also fit.
-- Same request id twice = the same run, never a second paid call.
create or replace function public.submission_check_claim(
  p_user_id      uuid,
  p_email        text,
  p_request_id   text,
  p_kind         text,
  p_require_beta boolean,
  p_limits       jsonb,
  p_reserve_usd  numeric
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now          timestamptz := now();
  v_month_start  timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_existing     public.submission_check_runs%rowtype;
  v_beta         public.submission_check_beta_users%rowtype;
  v_has_beta     boolean;
  v_running      integer;
  v_hour         integer;
  v_oldest_hour  timestamptz;
  v_checks       integer;
  v_tenders      integer;
  v_cost         numeric;
  v_global_cost  numeric;
  l_checks       integer;
  l_tenders      integer;
  l_hour         integer := coalesce((p_limits ->> 'per_hour')::integer, 4);
  l_cost         numeric;
  l_global       numeric := coalesce((p_limits ->> 'global_cost_usd_per_day')::numeric, 8);
  l_stale_min    integer := coalesce((p_limits ->> 'stale_minutes')::integer, 10);
  -- Never trust a missing or silly reservation: at least 5 cents, at most $20.
  v_reserve      numeric := least(greatest(coalesce(p_reserve_usd, 1), 0.05), 20);
  v_id           uuid;
begin
  if p_user_id is null or p_kind not in ('tender', 'check') or p_request_id is null then
    raise exception 'submission_check_claim: invalid arguments';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('submission_check:claim', 0));

  select * into v_existing from public.submission_check_runs
   where user_id = p_user_id and request_id = p_request_id;
  if found then
    return jsonb_build_object('allowed', false, 'code', 'duplicate', 'run_id', v_existing.id,
                              'status', v_existing.status, 'kind', v_existing.kind,
                              'analysis_id', v_existing.analysis_id);
  end if;

  select * into v_beta from public.submission_check_beta_users where email = lower(btrim(coalesce(p_email, '')));
  v_has_beta := found and v_beta.enabled and (v_beta.expires_at is null or v_beta.expires_at > v_now);
  if p_require_beta and not v_has_beta then
    return jsonb_build_object('allowed', false, 'code', 'not_in_beta');
  end if;

  l_checks  := coalesce(case when v_has_beta then v_beta.checks_per_month end, (p_limits ->> 'checks_per_month')::integer, 10);
  l_tenders := coalesce(case when v_has_beta then v_beta.tenders_per_month end, (p_limits ->> 'tenders_per_month')::integer, 5);
  l_cost    := coalesce(case when v_has_beta then v_beta.cost_cap_usd_per_month end, (p_limits ->> 'cost_cap_usd_per_month')::numeric, 5);

  -- One paid run at a time per account. A run still 'running' after
  -- l_stale_min minutes crashed (Vercel stops functions after 5 minutes).
  select count(*) into v_running from public.submission_check_runs
   where user_id = p_user_id and status = 'running' and started_at > v_now - make_interval(mins => l_stale_min);
  if v_running > 0 then
    return jsonb_build_object('allowed', false, 'code', 'busy', 'retry_after', 60);
  end if;

  -- Short-term rate (stops loops), counting failed runs too.
  select count(*), min(started_at) into v_hour, v_oldest_hour from public.submission_check_runs
   where user_id = p_user_id and started_at > v_now - interval '1 hour';
  if v_hour >= l_hour then
    return jsonb_build_object('allowed', false, 'code', 'rate', 'limit', l_hour,
      'retry_after', greatest(60, ceil(extract(epoch from (v_oldest_hour + interval '1 hour' - v_now)))::integer));
  end if;

  -- Monthly allowance: failed runs do not use it up; their AI cost still counts.
  -- Cost = real cost of finished runs + reserved cost of runs still running.
  select count(*) filter (where kind = 'check' and status <> 'failed'),
         count(*) filter (where kind = 'tender' and status <> 'failed'),
         coalesce(sum(case when status = 'running' then reserved_usd else coalesce(ai_cost_usd, 0) end), 0)
    into v_checks, v_tenders, v_cost
    from public.submission_check_runs
   where user_id = p_user_id and started_at >= v_month_start;
  if p_kind = 'check' and v_checks >= l_checks then
    return jsonb_build_object('allowed', false, 'code', 'monthly_checks', 'limit', l_checks);
  end if;
  if p_kind = 'tender' and v_tenders >= l_tenders then
    return jsonb_build_object('allowed', false, 'code', 'monthly_tenders', 'limit', l_tenders);
  end if;
  if v_cost + v_reserve > l_cost then
    return jsonb_build_object('allowed', false, 'code', 'monthly_cost', 'limit', l_cost);
  end if;

  -- Safety net across all accounts (for example a leaked password), counting
  -- runs in flight at their reserved cost.
  select coalesce(sum(case when status = 'running' then reserved_usd else coalesce(ai_cost_usd, 0) end), 0)
    into v_global_cost from public.submission_check_runs
   where started_at > v_now - interval '24 hours';
  if v_global_cost + v_reserve > l_global then
    return jsonb_build_object('allowed', false, 'code', 'global_cost', 'limit', l_global);
  end if;

  insert into public.submission_check_runs (user_id, request_id, kind, reserved_usd)
  values (p_user_id, p_request_id, p_kind, v_reserve)
  returning id into v_id;

  return jsonb_build_object('allowed', true, 'run_id', v_id,
    'used', jsonb_build_object('checks', v_checks + (p_kind = 'check')::integer,
                               'tenders', v_tenders + (p_kind = 'tender')::integer,
                               'cost_usd', v_cost),
    'limits', jsonb_build_object('checks_per_month', l_checks, 'tenders_per_month', l_tenders,
                                 'cost_cap_usd_per_month', l_cost, 'per_hour', l_hour));
end;
$$;

-- ── 4. Finish a run (success or failure, with its real AI cost) ─────────────
create or replace function public.submission_check_finish(
  p_run_id       uuid,
  p_user_id      uuid,
  p_status       text,
  p_cost_usd     numeric,
  p_error_code   text,
  p_analysis_id  uuid,
  p_pages        integer,
  p_requirements integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'submission_check_finish: invalid status';
  end if;
  update public.submission_check_runs
     set status = p_status,
         finished_at = now(),
         ai_cost_usd = greatest(coalesce(p_cost_usd, 0), 0),
         error_code = left(p_error_code, 60),
         analysis_id = coalesce(p_analysis_id, analysis_id),
         pages = p_pages,
         requirements = p_requirements
   where id = p_run_id and user_id = p_user_id and status = 'running';
  return found;
end;
$$;

-- ── 5. Usage for the Account page ───────────────────────────────────────────
create or replace function public.submission_check_usage(
  p_user_id uuid,
  p_email   text,
  p_limits  jsonb
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_beta        public.submission_check_beta_users%rowtype;
  v_has_beta    boolean;
  v_checks      integer;
  v_tenders     integer;
  v_cost        numeric;
begin
  select * into v_beta from public.submission_check_beta_users where email = lower(btrim(coalesce(p_email, '')));
  v_has_beta := found and v_beta.enabled and (v_beta.expires_at is null or v_beta.expires_at > now());
  select count(*) filter (where kind = 'check' and status <> 'failed'),
         count(*) filter (where kind = 'tender' and status <> 'failed'),
         coalesce(sum(case when status = 'running' then reserved_usd else coalesce(ai_cost_usd, 0) end), 0)
    into v_checks, v_tenders, v_cost
    from public.submission_check_runs
   where user_id = p_user_id and started_at >= v_month_start;
  return jsonb_build_object(
    'in_beta', v_has_beta,
    'beta_expires_at', case when v_has_beta then v_beta.expires_at end,
    'used', jsonb_build_object('checks', v_checks, 'tenders', v_tenders, 'cost_usd', v_cost),
    'limits', jsonb_build_object(
      'checks_per_month', coalesce(case when v_has_beta then v_beta.checks_per_month end, (p_limits ->> 'checks_per_month')::integer, 10),
      'tenders_per_month', coalesce(case when v_has_beta then v_beta.tenders_per_month end, (p_limits ->> 'tenders_per_month')::integer, 5),
      'cost_cap_usd_per_month', coalesce(case when v_has_beta then v_beta.cost_cap_usd_per_month end, (p_limits ->> 'cost_cap_usd_per_month')::numeric, 5)),
    'period_start', v_month_start);
end;
$$;

-- Only the server (service role) may call these functions.
revoke all on function public.submission_check_claim(uuid, text, text, text, boolean, jsonb, numeric) from public, anon, authenticated;
revoke all on function public.submission_check_finish(uuid, uuid, text, numeric, text, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.submission_check_usage(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.submission_check_claim(uuid, text, text, text, boolean, jsonb, numeric) to service_role;
grant execute on function public.submission_check_finish(uuid, uuid, text, numeric, text, uuid, integer, integer) to service_role;
grant execute on function public.submission_check_usage(uuid, text, jsonb) to service_role;

commit;

-- ── Add the invited beta testers (edit the e-mails, then run) ───────────────
-- insert into public.submission_check_beta_users (email, note) values
--   ('first.tester@example.com', 'Prospect 1'),
--   ('faisal@example.com', 'Owner')
-- on conflict (email) do update set enabled = true;

-- ── Rollback (removes only what this file added) ────────────────────────────
-- begin;
-- drop function if exists public.submission_check_usage(uuid, text, jsonb);
-- drop function if exists public.submission_check_finish(uuid, uuid, text, numeric, text, uuid, integer, integer);
-- drop function if exists public.submission_check_claim(uuid, text, text, text, boolean, jsonb, numeric);
-- drop table if exists public.submission_check_runs;
-- drop table if exists public.submission_check_beta_users;
-- commit;
