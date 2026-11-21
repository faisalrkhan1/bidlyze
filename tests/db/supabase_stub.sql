-- Minimal stand-in for a Supabase database, for testing RLS migrations
-- locally with plain Postgres. NOT for production.
-- Starts with deliberately WEAK policies (the kind dashboard templates create)
-- so the self-test can show the migration closes them.

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
  user_id uuid references auth.users(id),
  file_name text, file_path text, project_name text, bid_score numeric,
  analysis_data jsonb, requirement_statuses jsonb, tender_status text,
  created_at timestamptz not null default now()
);
create table public.subscriptions (
  user_id uuid primary key references auth.users(id),
  plan text, analyses_limit int, status text, updated_at timestamptz default now()
);
create table public.disqualification_analyses (
  analysis_id uuid primary key references public.analyses(id),
  user_id uuid references auth.users(id), risk_score int
);
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;

-- WEAK starting policies
alter table public.analyses enable row level security;
create policy "Users manage own analyses" on public.analyses for all using (auth.uid() = user_id);
alter table public.subscriptions enable row level security;
create policy "Users manage own subscription" on public.subscriptions for all using (auth.uid() = user_id);
alter table public.disqualification_analyses enable row level security;
create policy "Anyone can read risk checks" on public.disqualification_analyses for select using (true);
insert into storage.buckets (id, name, public) values ('tender-uploads', 'tender-uploads', true);
create policy "Authenticated read tender-uploads" on storage.objects for select to authenticated using (bucket_id = 'tender-uploads');

-- Two users with data
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
insert into public.subscriptions values
  ('11111111-1111-1111-1111-111111111111', 'prelaunch', 10, 'active', now()),
  ('22222222-2222-2222-2222-222222222222', 'prelaunch', 10, 'active', now());
insert into public.analyses (id, user_id, project_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'User 1 tender'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'User 2 tender');
insert into public.disqualification_analyses values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 40),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 55);
insert into storage.objects (bucket_id, name) values
  ('tender-uploads', '11111111-1111-1111-1111-111111111111/a.pdf'),
  ('tender-uploads', '22222222-2222-2222-2222-222222222222/b.pdf');
