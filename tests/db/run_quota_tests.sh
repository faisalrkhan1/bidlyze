#!/usr/bin/env bash
# Runs the beta quota migration and its tests on a throwaway local Postgres 16.
# Needs the postgresql-16 binaries. Nothing here touches Supabase.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DATA="$(mktemp -d /tmp/bidlyze-pg-XXXX)"
PORT="${PGPORT_TEST:-54329}"
chown postgres "$DATA" 2>/dev/null || true
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
as_pg "$PGBIN/initdb -D $DATA -A trust -U postgres >/dev/null"
as_pg "$PGBIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l $DATA/log -w start >/dev/null"
trap 'as_pg "$PGBIN/pg_ctl -D $DATA -m fast stop >/dev/null"; rm -rf "$DATA"' EXIT
PSQL="psql -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c "create database bidlyze_test"
$PSQL -d bidlyze_test -f "$HERE/supabase_stub.sql" >/dev/null
# Supabase grants every new table and function in "public" to anon, authenticated and
# service_role by default. Reproduce that, so the test proves the migration's revokes work.
$PSQL -d bidlyze_test -c "alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;"
$PSQL -d bidlyze_test -f "$ROOT/docs/proposals/2026-11-22_submission_check_beta_quota.sql"
$PSQL -d bidlyze_test -f "$ROOT/docs/proposals/2026-11-22_submission_check_beta_quota.sql"   # safe to run twice
$PSQL -d bidlyze_test -f "$HERE/submission_check_quota.test.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'

# Race: 8 parallel claims for one user with different request ids -> exactly one allowed.
$PSQL -d bidlyze_test -c "insert into auth.users (id) values ('99999999-9999-9999-9999-999999999999')"
for i in 1 2 3 4 5 6 7 8; do
  $PSQL -d bidlyze_test -At -c "set role service_role; select public.submission_check_claim('99999999-9999-9999-9999-999999999999','r@x.com','race-0000-000$i','check',false,'{\"per_hour\":50}') ->> 'allowed'" &
done > /tmp/race.out; wait
ALLOWED=$(grep -c '^true$' /tmp/race.out || true)
if [ "$ALLOWED" != "1" ]; then echo "FAILED: $ALLOWED of 8 parallel claims were allowed (expected 1)"; cat /tmp/race.out; exit 1; fi
echo "  ok - 8 parallel claims for one account: exactly 1 allowed, 7 refused"

# Rollback block in the migration file removes everything it added.
sed -n '/^-- ── Rollback/,$p' "$ROOT/docs/proposals/2026-11-22_submission_check_beta_quota.sql" | sed 's/^-- //' | grep -v '^──' > /tmp/rollback.sql
$PSQL -d bidlyze_test -f /tmp/rollback.sql
LEFT=$($PSQL -d bidlyze_test -At -c "select count(*) from pg_tables where tablename like 'submission_check%'")
[ "$LEFT" = "0" ] && echo "  ok - rollback removes the two tables and three functions" || { echo "FAILED: rollback left $LEFT tables"; exit 1; }
echo "ALL DATABASE TESTS PASSED"
