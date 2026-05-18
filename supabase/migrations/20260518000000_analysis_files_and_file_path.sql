-- Tender Package mode: one analysis -> many files.
-- Also patches a long-standing schema drift: analyses.file_path has been written
-- by /api/analyze since the storage migration in March 2026 but the column was
-- never actually present in production. The ALTER TABLE below adds it so the
-- single-file primary path works correctly for both legacy and Tender Package
-- flows. Existing rows will have NULL file_path (no worse than today's silent
-- behaviour where the column did not exist).

BEGIN;

-- ─── 1. Add the missing analyses.file_path column ──────────────────────────
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS file_path text;

-- ─── 2. Create the analysis_files table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analysis_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id  uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name    text NOT NULL,
  content_type text NOT NULL,
  file_size    bigint NOT NULL,
  role         text NOT NULL CHECK (role IN ('primary', 'boq', 'annex', 'tc', 'drawing', 'other')),
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analysis_files_analysis_idx ON public.analysis_files(analysis_id);
CREATE INDEX IF NOT EXISTS analysis_files_user_idx ON public.analysis_files(user_id);

ALTER TABLE public.analysis_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own analysis files" ON public.analysis_files;
CREATE POLICY "Users read own analysis files"
  ON public.analysis_files
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own analysis files" ON public.analysis_files;
CREATE POLICY "Users insert own analysis files"
  ON public.analysis_files
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own analysis files" ON public.analysis_files;
CREATE POLICY "Users delete own analysis files"
  ON public.analysis_files
  FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
