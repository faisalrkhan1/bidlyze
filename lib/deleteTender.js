// Delete a tender the customer uploaded: the original files and everything the
// analysis extracted from them.
//
// What is removed:
//   * every uploaded file in the private "tender-uploads" bucket (primary + package files)
//   * the analysis_files, disqualification_analyses and bid_readiness_stages rows
//   * all content in the analyses row (AI output, notes, edits, comments, file names)
//
// What is kept: a content-free analyses row (id, user_id, created_at) so the
// monthly usage count cannot be reset by deleting and re-uploading. It holds no
// tender text, file name or file path.
//
// Order matters so a failure part-way can simply be retried:
//   1. remove files (paths are still recorded, so a retry finds them)
//   2. confirm each file is really gone
//   3. delete child rows
//   4. scrub the analyses row
//
// Returns { ok: true, filesRemoved, filesConfirmedGone } or { ok: false, status, error }.

export const BUCKET = "tender-uploads";

// "Table does not exist" as reported by Postgres (42P01) or by Supabase's REST
// layer (PGRST205 / PGRST106). E.g. bid_readiness_stages is not in every database.
const MISSING_TABLE = new Set(["42P01", "PGRST205", "PGRST106"]);
const isMissingTable = (error) => !!error && MISSING_TABLE.has(error.code);

// Columns that are kept (non-content) on the tombstone row.
const KEEP = new Set(["id", "user_id", "created_at", "compliance_weighting", "tender_status"]);

export async function deleteTender(admin, { analysisId, userId, now = new Date() }) {
  if (!analysisId || !userId) return { ok: false, status: 400, error: "analysis_id is required" };

  // ── Load the row (service role, so check ownership explicitly) ──
  const { data: row, error: rowError } = await admin
    .from("analyses")
    .select("*")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .maybeSingle();
  if (rowError) return { ok: false, status: 500, error: "Could not load the analysis." };
  if (!row) return { ok: false, status: 404, error: "Analysis not found" };

  // ── 1. Collect and remove every uploaded file ──
  const { data: fileRows, error: filesError } = await admin
    .from("analysis_files")
    .select("storage_path")
    .eq("analysis_id", analysisId);
  if (filesError && !isMissingTable(filesError)) {
    return { ok: false, status: 500, error: "Could not list the uploaded files." };
  }

  const ownPrefix = `${userId}/`;
  const paths = [...new Set([
    row.file_path,
    ...(fileRows || []).map((f) => f.storage_path),
  ])].filter((p) => typeof p === "string" && p.startsWith(ownPrefix) && !p.includes(".."));

  if (paths.length > 0) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
    if (removeError) {
      console.error("[delete] storage remove failed:", removeError.message);
      return { ok: false, status: 502, error: "The files could not be deleted. Nothing else was changed — please try again." };
    }
  }

  // ── 2. Confirm each file is gone (a download must now fail) ──
  let confirmedGone = 0;
  for (const p of paths) {
    const { data: blob } = await admin.storage.from(BUCKET).download(p);
    if (blob) {
      console.error("[delete] file still present after remove:", p);
      return { ok: false, status: 502, error: "A file could not be confirmed as deleted. Please try again." };
    }
    confirmedGone += 1;
  }

  // ── 3. Child rows ──
  for (const table of ["analysis_files", "disqualification_analyses", "bid_readiness_stages"]) {
    const { error } = await admin.from(table).delete().eq("analysis_id", analysisId);
    // A table that does not exist in this database has nothing to delete.
    if (error && !isMissingTable(error)) {
      console.error(`[delete] ${table} delete failed:`, error.message);
      return { ok: false, status: 500, error: "The files were deleted but some analysis data was not. Please try again." };
    }
  }

  // ── 4. Scrub the analyses row, keeping only non-content columns ──
  const scrub = {};
  for (const key of Object.keys(row)) {
    if (!KEEP.has(key)) scrub[key] = null;
  }
  scrub.analysis_data = { deleted: true, deletedAt: now.toISOString() };
  if ("project_name" in row) scrub.project_name = "Deleted tender";
  if ("file_name" in row) scrub.file_name = "Deleted";

  const { error: scrubError } = await admin
    .from("analyses")
    .update(scrub)
    .eq("id", analysisId)
    .eq("user_id", userId);
  if (scrubError) {
    console.error("[delete] analyses scrub failed:", scrubError.message);
    return { ok: false, status: 500, error: "The files were deleted but the analysis text was not. Please try again." };
  }

  return { ok: true, filesRemoved: paths.length, filesConfirmedGone: confirmedGone };
}

/** True for a row whose content has been deleted (keep it out of lists). */
export function isDeletedAnalysis(row) {
  return row?.analysis_data?.deleted === true;
}
