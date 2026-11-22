-- Fingerprint of everything that existed before the beta migration: the data in every
-- existing table, the row-level security policies, table and function privileges,
-- triggers and functions. Objects the migration adds (submission_check_*) are left out,
-- so "before" and "after" must be identical.
\pset tuples_only on
\pset format unaligned
with
  tbls as (
    select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname in ('public', 'auth', 'storage') and c.relname not like 'submission_check_%'
  ),
  data as (
    select string_agg(format('%s.%s=%s', nspname, relname,
      (xpath('/row/h/text()', query_to_xml(format('select md5(coalesce(string_agg(t::text, %L order by t::text), %L)) as h from %I.%I t', '|', '', nspname, relname), false, true, '')))[1]::text), ';' order by nspname, relname) as v
    from tbls
  ),
  pol as (select md5(string_agg(format('%s|%s|%s|%s|%s|%s', schemaname, tablename, policyname, cmd, coalesce(qual, ''), coalesce(with_check, '')), ';' order by schemaname, tablename, policyname)) as v
          from pg_policies where tablename not like 'submission_check_%'),
  rls as (select md5(string_agg(format('%s|%s', relname, relrowsecurity), ';' order by relname)) as v
          from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'storage') and c.relkind = 'r' and relname not like 'submission_check_%'),
  grants as (select md5(string_agg(format('%s|%s|%s|%s', table_schema, table_name, grantee, privilege_type), ';' order by table_schema, table_name, grantee, privilege_type)) as v
             from information_schema.role_table_grants where table_schema in ('public', 'auth', 'storage') and table_name not like 'submission_check_%'),
  funcs as (select md5(string_agg(format('%s|%s|%s', n.nspname, p.proname, md5(p.prosrc)), ';' order by n.nspname, p.proname)) as v
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth', 'storage') and p.proname not like 'submission_check_%'),
  trig as (select md5(coalesce(string_agg(format('%s|%s', tgrelid::regclass, tgname), ';' order by tgname), '')) as v from pg_trigger where not tgisinternal)
select 'data: ' || (select v from data)
union all select 'policies: ' || (select v from pol)
union all select 'rls switches: ' || (select v from rls)
union all select 'table privileges: ' || (select v from grants)
union all select 'functions: ' || (select v from funcs)
union all select 'triggers: ' || (select v from trig);
