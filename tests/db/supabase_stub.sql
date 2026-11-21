-- Minimal stand-in for the Bidlyze Supabase database, for testing RLS
-- migrations locally with plain Postgres. NOT for production.
-- Policies, bucket settings and analyses columns copy what the read-only audit
-- found on the live project on 21 Nov 2026, so the self-test shows the real
-- before/after.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::json->>'role', current_user)
$$;
grant usage on schema auth to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  file_name text, project_name text, bid_score numeric, created_at timestamptz default now(),
  analysis_data jsonb, proposals jsonb, notes text, requirement_statuses jsonb, compliance_edits jsonb,
  workflow_actions jsonb, workflow_decision jsonb, workflow_comments jsonb, audit_trail jsonb,
  tender_status text, file_path text
);
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id),
  plan text, analyses_limit int, status text, updated_at timestamptz default now()
);
create table public.disqualification_analyses (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id),
  user_id uuid not null references auth.users(id), risk_score int not null default 0
);
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;

-- Live policies (21 Nov 2026)
alter table public.analyses enable row level security;
create policy "Users can insert own analyses" on public.analyses for insert with check (auth.uid() = user_id);
create policy "Service can insert analyses" on public.analyses for insert with check (true);
create policy "Users can view own analyses" on public.analyses for select using (auth.uid() = user_id);
alter table public.subscriptions enable row level security;
create policy "Service role full access" on public.subscriptions for all using (auth.role() = 'service_role');
create policy "Users can insert own subscription" on public.subscriptions for insert with check (auth.uid() = user_id);
create policy "Users can view own subscription" on public.subscriptions for select using (auth.uid() = user_id);
alter table public.disqualification_analyses enable row level security;
create policy "Users delete own disq analyses" on public.disqualification_analyses for delete using (auth.uid() = user_id);
create policy "Users insert own disq analyses" on public.disqualification_analyses for insert with check (auth.uid() = user_id);
create policy "Users read own disq analyses" on public.disqualification_analyses for select using (auth.uid() = user_id);
create policy "Users update own disq analyses" on public.disqualification_analyses for update using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('tender-uploads', 'tender-uploads', false, 104857600,
   array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']);
create policy "Users can read own files" on storage.objects for select to authenticated
  using (bucket_id = 'tender-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'tender-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- Two users with data
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
insert into public.subscriptions (user_id, plan, analyses_limit, status) values
  ('11111111-1111-1111-1111-111111111111', 'prelaunch', 10, 'active'),
  ('22222222-2222-2222-2222-222222222222', 'prelaunch', 10, 'active');
insert into public.analyses (id, user_id, project_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'User 1 tender'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'User 2 tender');
insert into public.disqualification_analyses (analysis_id, user_id, risk_score) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 40),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 55);
insert into storage.objects (bucket_id, name) values
  ('tender-uploads', '11111111-1111-1111-1111-111111111111/a.pdf'),
  ('tender-uploads', '22222222-2222-2222-2222-222222222222/b.pdf');
