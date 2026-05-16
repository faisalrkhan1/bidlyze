-- One-time backfill: during pre-launch every signed-up user gets the prelaunch tier
-- with Pro features and 10 analyses/month. When payments go live, this query will
-- not be re-run, and new users will default to free again.
--
-- Only touches rows that are currently on the legacy `free` tier with an `active`
-- status. Paying users (pro/team/enterprise) and canceled/past_due rows are left
-- untouched. Safe to re-run; the WHERE clause will match nothing after the first run.

BEGIN;

UPDATE subscriptions
SET
  plan = 'prelaunch',
  analyses_limit = 10,
  updated_at = NOW()
WHERE plan = 'free'
  AND status = 'active';

COMMIT;
