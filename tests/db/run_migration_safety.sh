#!/usr/bin/env bash
# Proves the beta migration leaves existing users and data untouched, on a stand-in of
# the live database (tests/db/supabase_stub.sql + the 21 Nov hardening migration that is
# live, + Supabase's default grants). Nothing here touches Supabase.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"; DATA="$(mktemp -d /tmp/bidlyze-pgs-XXXX)"; PORT="${PGPORT_TEST:-54330}"
chown postgres "$DATA" 2>/dev/null || true
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
as_pg "$PGBIN/initdb -D $DATA -A trust -U postgres >/dev/null"
as_pg "$PGBIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l $DATA/log -w start >/dev/null"
trap 'as_pg "$PGBIN/pg_ctl -D $DATA -m fast stop >/dev/null"; rm -rf "$DATA"' EXIT
PSQL="psql -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c "create database live_standin"
$PSQL -d live_standin -f "$HERE/supabase_stub.sql" >/dev/null
$PSQL -d live_standin -c "alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;" >/dev/null
$PSQL -d live_standin -f "$ROOT/supabase/migrations/20261121000000_harden_core_rls.sql" >/dev/null 2>&1
# More realistic data: 30 users, 52 analyses with JSON, as on the live project (21 Nov).
$PSQL -d live_standin -c "
  insert into auth.users (id) select ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid from generate_series(1, 30) g on conflict do nothing;
  insert into public.analyses (user_id, project_name, analysis_data, file_name)
    select ('00000000-0000-4000-8000-' || lpad((1 + g % 30)::text, 12, '0'))::uuid, 'Tender ' || g, jsonb_build_object('requirements', jsonb_build_array(jsonb_build_object('id', 'R1', 'requirement', 'Requirement ' || g))), 'file' || g || '.pdf'
    from generate_series(1, 50) g;" >/dev/null

PRE="$ROOT/docs/proposals/2026-11-22_preflight_postflight_READ_ONLY.sql"
sed -n '/── PART A:/,/── PART B:/p' "$PRE" > /tmp/partA.sql; sed -n '/── PART B:/,$p' "$PRE" > /tmp/partB.sql
$PSQL -d live_standin -x -f /tmp/partA.sql > /tmp/partA.out
grep -q "beta_tables_must_be_0 *| 0" /tmp/partA.out && grep -q "analyses_id_is_uuid_must_be_true *| t" /tmp/partA.out && echo "  ok - read-only pre-flight check (PART A) runs and passes" || { cat /tmp/partA.out; echo "FAILED: pre-flight"; exit 1; }
$PSQL -d live_standin -f "$HERE/fingerprint.sql" > /tmp/fp_before.txt
START=$(date +%s%N)
$PSQL -d live_standin -f "$ROOT/docs/proposals/2026-11-22_submission_check_beta_quota.sql" >/dev/null 2>&1
MS=$(( ($(date +%s%N) - START) / 1000000 ))
$PSQL -d live_standin -f "$HERE/fingerprint.sql" > /tmp/fp_after.txt
$PSQL -d live_standin -x -f /tmp/partB.sql > /tmp/partB.out
for want in "beta_tables_must_be_2 *| 2" "beta_functions_must_be_3 *| 3" "row_security_on_must_be_true *| t" "public_can_start_runs_must_be_false *| f" "users_can_start_runs_must_be_false *| f" "users_can_read_beta_list_must_be_false *| f" "runs_must_be_0 *| 0"; do
  grep -q "$want" /tmp/partB.out || { cat /tmp/partB.out; echo "FAILED: post-flight: $want"; exit 1; }
done
diff <(grep -E "^(users|analyses|subscriptions) +\|" /tmp/partA.out | tr -s ' ') <(grep -E "^(users|analyses|subscriptions) +\|" /tmp/partB.out | tr -s ' ') >/dev/null && echo "  ok - read-only post-flight check (PART B) passes; user, analysis and subscription counts unchanged" || { echo "FAILED: counts changed"; exit 1; }

if diff -u /tmp/fp_before.txt /tmp/fp_after.txt; then
  echo "  ok - existing data, policies, row-level security, table privileges, functions and triggers identical before and after ($(wc -l < /tmp/fp_before.txt | tr -d ' ') fingerprints)"
else
  echo "FAILED: the migration changed something that existed before"; exit 1
fi
# Control: the fingerprint does notice a change (one existing row edited).
$PSQL -d live_standin -c "update public.analyses set project_name = project_name || ' ' where id = (select id from public.analyses limit 1)" >/dev/null
$PSQL -d live_standin -f "$HERE/fingerprint.sql" > /tmp/fp_control.txt
if diff -q /tmp/fp_after.txt /tmp/fp_control.txt >/dev/null; then echo "FAILED: fingerprint cannot see changes"; exit 1; fi
$PSQL -d live_standin -c "update public.analyses set project_name = rtrim(project_name) where project_name like '% '" >/dev/null
echo "  ok - control: editing one existing row changes the fingerprint, so the comparison above is meaningful"
echo "  ok - migration ran in ${MS} ms in one transaction"
ROWS=$($PSQL -d live_standin -At -c "select (select count(*) from public.submission_check_runs) + (select count(*) from public.submission_check_beta_users)")
[ "$ROWS" = "0" ] && echo "  ok - the new tables start empty: nobody is a beta tester until added" || { echo "FAILED: new tables not empty"; exit 1; }
# The app's existing access still works after the migration (signed-in user, server).
$PSQL -d live_standin -f "$HERE/app_access_check.sql" > /tmp/app_access.txt 2>&1 && echo "  ok - existing app access unchanged (read own analyses, save edits and clarifications, read plan and risk check, download own file; server can set plans)" || { cat /tmp/app_access.txt; echo "FAILED: app access"; exit 1; }
# A failed statement rolls the whole migration back (it is wrapped in begin/commit).
$PSQL -d live_standin -c "create database broken" >/dev/null
$PSQL -d broken -f "$HERE/supabase_stub.sql" >/dev/null
sed 's/create index if not exists submission_check_runs_started/create index if not exists submission_check_runs_started_BROKEN on nonexistent_table (x); create index if not exists submission_check_runs_started/' "$ROOT/docs/proposals/2026-11-22_submission_check_beta_quota.sql" > /tmp/broken.sql
if $PSQL -d broken -f /tmp/broken.sql >/dev/null 2>&1; then echo "FAILED: broken migration did not fail"; exit 1; fi
LEFT=$($PSQL -d broken -At -c "select count(*) from pg_tables where tablename like 'submission_check%'")
[ "$LEFT" = "0" ] && echo "  ok - if any statement fails, nothing is left behind (all-or-nothing)" || { echo "FAILED: partial migration left $LEFT tables"; exit 1; }
echo "MIGRATION SAFETY TESTS PASSED"
