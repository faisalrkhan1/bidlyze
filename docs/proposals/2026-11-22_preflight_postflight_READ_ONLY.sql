-- READ ONLY: changes nothing. Supabase project "bidlyze" -> SQL Editor.
-- Run PART A before the beta migration and note the numbers. Run PART B right after it.

-- ── PART A: before the migration ────────────────────────────────────────────
select
  current_setting('server_version')                                   as postgres_version,
  (select count(*) from auth.users)                                   as users,
  (select count(*) from public.analyses)                              as analyses,
  (select count(*) from public.subscriptions)                         as subscriptions,
  (select count(*) from pg_tables where schemaname = 'public' and tablename like 'submission_check%')                   as beta_tables_must_be_0,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'submission_check%')                                               as beta_functions_must_be_0,
  (select data_type = 'uuid' from information_schema.columns
     where table_schema = 'public' and table_name = 'analyses' and column_name = 'id')                                 as analyses_id_is_uuid_must_be_true;

-- ── PART B: right after the migration ───────────────────────────────────────
-- users, analyses and subscriptions must equal PART A; every "must_be" must hold.
select
  (select count(*) from auth.users)                                   as users,
  (select count(*) from public.analyses)                              as analyses,
  (select count(*) from public.subscriptions)                         as subscriptions,
  (select count(*) from pg_tables where schemaname = 'public' and tablename like 'submission_check%')                   as beta_tables_must_be_2,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'submission_check%')                                               as beta_functions_must_be_3,
  (select bool_and(relrowsecurity) from pg_class where relname in ('submission_check_runs', 'submission_check_beta_users')) as row_security_on_must_be_true,
  has_function_privilege('anon', 'public.submission_check_claim(uuid, text, text, text, boolean, jsonb, numeric)', 'execute')       as public_can_start_runs_must_be_false,
  has_function_privilege('authenticated', 'public.submission_check_claim(uuid, text, text, text, boolean, jsonb, numeric)', 'execute') as users_can_start_runs_must_be_false,
  has_table_privilege('authenticated', 'public.submission_check_beta_users', 'select')                                 as users_can_read_beta_list_must_be_false,
  (select count(*) from public.submission_check_runs)                 as runs_must_be_0;
