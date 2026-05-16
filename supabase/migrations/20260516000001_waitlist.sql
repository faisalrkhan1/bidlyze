-- Waitlist table for pre-launch Pro / Team interest capture.
-- Inserts come from /api/waitlist; reads happen only via the service role.
--
-- Idempotent: safe to re-run. In production, the table pre-existed with a
-- legacy 3-column schema (id, email, created_at) and was widened via a
-- one-off SQL block in the Supabase Dashboard. This file mirrors that
-- widened final state for any fresh environment.

CREATE TABLE IF NOT EXISTS public.waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  plan       text NOT NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source     text DEFAULT 'pricing_page',
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Additive widening in case the table already existed with a partial schema.
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS plan    text;

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS source  text DEFAULT 'pricing_page';

UPDATE public.waitlist SET plan = COALESCE(plan, 'pro');
ALTER TABLE public.waitlist ALTER COLUMN plan SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'waitlist_plan_check'
      AND conrelid = 'public.waitlist'::regclass
  ) THEN
    ALTER TABLE public.waitlist
      ADD CONSTRAINT waitlist_plan_check CHECK (plan IN ('pro', 'team'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'waitlist_email_plan_key'
      AND conrelid = 'public.waitlist'::regclass
  ) THEN
    ALTER TABLE public.waitlist
      ADD CONSTRAINT waitlist_email_plan_key UNIQUE (email, plan);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS waitlist_plan_idx       ON public.waitlist(plan);
CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON public.waitlist(created_at DESC);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can insert waitlist" ON public.waitlist;
CREATE POLICY "anyone can insert waitlist"
  ON public.waitlist
  FOR INSERT
  WITH CHECK (true);
