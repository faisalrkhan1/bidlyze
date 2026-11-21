-- After the migration: the things the app itself needs must still work.
begin;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true) is not null as as_user_1;
set local role authenticated;
select 'can read own analyses' as test, count(*) as result from public.analyses;
with u as (update public.analyses set requirement_statuses = '{"edits":{}}' where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
select 'can save own requirement edits', count(*) from u;
select 'can read own plan', count(*) from public.subscriptions;
with u as (update public.analyses set clarifications = '[]' where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
select 'can save clarifications', count(*) from u;
select 'can read own risk check', count(*) from public.disqualification_analyses;
select 'can download own file', count(*) from storage.objects where bucket_id = 'tender-uploads';
reset role;
set local role service_role;
with u as (update public.subscriptions set analyses_limit = 50 where user_id = '11111111-1111-1111-1111-111111111111' returning 1)
select 'server (service role) can still set plans', count(*) from u;
reset role;
rollback;
