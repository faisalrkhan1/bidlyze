-- Bidlyze security audit — READ ONLY. Changes nothing.
--
-- Run in: Supabase Dashboard → your Bidlyze project → SQL Editor → New query
-- → paste this whole file → Run. Copy the results back to Claude.
--
-- What it answers:
--   1. Is Row Level Security ON for every table that holds customer data?
--   2. Which policies exist, and do any let a user change their own plan,
--      usage counter, or another user's rows?
--   3. Is the tender-uploads storage bucket private, and who can read files?

-- 1. RLS on/off per table
select 'rls' as check, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 2;

-- 2. Every policy on the tables the app uses
select 'policy' as check, tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('analyses', 'subscriptions', 'disqualification_analyses',
                    'analysis_files', 'waitlist', 'bid_readiness_stages')
order by tablename, cmd, policyname;

-- 3. Storage bucket settings
select 'bucket' as check, id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'tender-uploads';

-- 4. Storage policies (who can read/write uploaded tender files)
select 'storage_policy' as check, policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- 5. Triggers on the core tables
select 'trigger' as check, event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('analyses', 'subscriptions')
order by 2, 3;
