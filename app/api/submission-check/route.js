import { NextResponse } from "next/server";
import { submissionCheckBetaEnabled } from "@/lib/submission/beta";
import { normaliseResponse, checkProposalAgainstAnalysis, addDocumentFindings, CheckInputError } from "@/lib/submission/service";
import { isDeletedAnalysis } from "@/lib/deleteTender";
import { DEMO_ID, loadDemoAnalysis, loadRecordedDemoResult } from "@/lib/submission/demo";
import { errJson, readJsonBody, BodyError, userFromRequest, getQuota } from "@/lib/submission/http";
import { estimateRunCostUsd } from "@/lib/submission/quota";

// Submission Check step 2: check a supplier proposal (one or more files)
// against a tender's requirement list. The proposal's page text is extracted in
// the browser and sent here; nothing about the proposal is written to the
// database or to storage (only a usage record: who, when, size, AI cost).
//
// Paid AI: signed-in users on the beta list only, within the durable usage
// limits (lib/submission/quota.js). The sample proposal replays a recorded
// result and costs nothing.

export const maxDuration = 300;

export async function POST(request) {
  if (!submissionCheckBetaEnabled()) return errJson(404, "Not found");
  let quota;
  let claim = null;
  let userId = null;
  try {
    const body = await readJsonBody(request);
    const analysisId = String(body?.analysisId || "");
    // Validate the proposal before anything is counted against the user's allowance.
    const response = normaliseResponse(body?.response);

    const { user, client } = await userFromRequest(request);
    if (analysisId === DEMO_ID && !body.live) {
      // The sample proposal has a recorded live result: demos cost nothing and need no account.
      const rec = await loadRecordedDemoResult();
      const only = response.files.length === 1 ? response.files[0] : null;
      if (rec && only?.sha256 && rec.response?.sha256 === only.sha256) {
        const replay = addDocumentFindings(rec, response);
        return NextResponse.json({ ...replay, response: { ...rec.response, filename: only.filename }, recorded: { checkedAt: rec.checkedAt } });
      }
    }
    if (!user) return errJson(401, analysisId === DEMO_ID ? "Sign in to run a live check on the sample tender." : "Your session has expired. Sign in again.");
    if (analysisId !== DEMO_ID && !/^[0-9a-f-]{36}$/i.test(analysisId)) return errJson(400, "Unknown tender.");
    userId = user.id;

    // Beta list and usage limits first: an account that may not run paid checks
    // gets its answer before any tender is read from the database.
    quota = await getQuota();
    // Requirement count is not known before the tender is loaded: reserve for the maximum (150).
    const proposalChars = response.files.reduce((n, f) => n + f.chars, 0);
    claim = await quota.claim({ user, requestId: body?.requestId, kind: "check", reserveUsd: estimateRunCostUsd({ kind: "check", chars: proposalChars }) });
    if (!claim.ok) return errJson(claim.status, claim.reason, { code: claim.code }, claim.retryAfterSec ? { "Retry-After": String(claim.retryAfterSec) } : undefined);

    let analysis;
    if (analysisId === DEMO_ID) {
      analysis = await loadDemoAnalysis();
    } else {
      // RLS + explicit owner filter: users can only check against their own tenders.
      const { data, error } = await client
        .from("analyses")
        .select("id, project_name, file_name, analysis_data")
        .eq("id", analysisId)
        .eq("user_id", user.id)
        .single();
      if (error || !data?.analysis_data || isDeletedAnalysis(data)) {
        await quota.finish(claim, { userId, status: "failed", costUsd: 0, errorCode: "tender_not_found" });
        claim = null;
        return data && isDeletedAnalysis(data) ? errJson(410, "This tender has been deleted.") : errJson(404, "Tender not found.");
      }
      analysis = {
        id: data.id,
        name: data.analysis_data?.summary?.projectName || data.project_name || "Tender",
        fileName: data.file_name,
        analysisData: data.analysis_data,
      };
    }

    const result = await checkProposalAgainstAnalysis({ analysis, response });
    await quota.finish(claim, { userId, status: "succeeded", costUsd: result.meta.aiCostUsd, analysisId: analysis.id === DEMO_ID ? null : analysis.id, pages: result.response.pages, requirements: result.items.length });
    // Cost and size only: proposal text and findings are never logged.
    console.log(`[submission-check] user ${userId.slice(0, 8)} tender ${String(analysis.id).slice(0, 8)}: ${result.items.length} reqs, ${response.files.length} file(s), ${result.response.pages} pages, ${result.meta.durationMs} ms, $${result.meta.aiCostUsd} (${claim.store})`);
    return NextResponse.json(result);
  } catch (e) {
    if (claim?.ok && quota) await quota.finish(claim, { userId, status: "failed", costUsd: e?.aiCostUsd ?? 0, errorCode: e?.code || "error" });
    if (e instanceof BodyError) return errJson(e.status, e.message);
    if (e instanceof CheckInputError) return errJson(e.status, e.message, { code: e.code });
    console.error("[submission-check] unexpected error:", e);
    return errJson(500, "Something went wrong while checking the proposal. Please try again.");
  }
}
