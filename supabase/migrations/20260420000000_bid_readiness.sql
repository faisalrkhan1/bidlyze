-- Bid Readiness Tracker
--
-- Adds:
--   1. analyses.compliance_weighting — user-selectable weighting for the
--      compliance percentage calculation.
--   2. bid_readiness_stages — per-analysis checklist of 6 preparation stages,
--      supporting manual overrides over the auto-computed state.
--
-- Apply via Supabase SQL Editor on the hosted project, or via `supabase db push`
-- once the CLI is linked. Idempotent.

BEGIN;

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS compliance_weighting TEXT NOT NULL DEFAULT 'equal'
  CHECK (compliance_weighting IN ('mandatory_only', 'weighted_2x', 'equal'));

CREATE TABLE IF NOT EXISTS bid_readiness_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN (
    'kickoff','drafting','internal_review','client_review','finalization','submitted'
  )),
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(analysis_id, stage)
);

ALTER TABLE bid_readiness_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own readiness stages" ON bid_readiness_stages;
DROP POLICY IF EXISTS "Users insert own readiness stages" ON bid_readiness_stages;
DROP POLICY IF EXISTS "Users update own readiness stages" ON bid_readiness_stages;
DROP POLICY IF EXISTS "Users delete own readiness stages" ON bid_readiness_stages;

CREATE POLICY "Users view own readiness stages" ON bid_readiness_stages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own readiness stages" ON bid_readiness_stages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own readiness stages" ON bid_readiness_stages
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own readiness stages" ON bid_readiness_stages
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_readiness_stages_analysis
  ON bid_readiness_stages(analysis_id);

CREATE OR REPLACE FUNCTION bid_readiness_stages_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bid_readiness_stages_updated_at ON bid_readiness_stages;
CREATE TRIGGER trg_bid_readiness_stages_updated_at
  BEFORE UPDATE ON bid_readiness_stages
  FOR EACH ROW
  EXECUTE FUNCTION bid_readiness_stages_set_updated_at();

COMMIT;
