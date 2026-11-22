import { NextResponse } from "next/server";
import { submissionCheckBetaEnabled } from "@/lib/submission/beta";
import { normaliseDocuments, DocumentInputError } from "@/lib/submission/documents";
import { readTenderRequirements, tenderAnalysisRow, SOURCE } from "@/lib/submission/tender";
import { requirementsFromAnalysis } from "@/lib/submission/fromAnalysis";
import { prepareRequirements } from "@/lib/submission/obligations";
import { errJson, readJsonBody, BodyError, userFromRequest, getQuota } from "@/lib/submission/http";
import { estimateRunCostUsd } from "@/lib/submission/quota";

// Submission Check step 1: read the tender's requirements.
//
// The tender is read in the browser; only its page text arrives here. The
// Tender Intelligence engine extracts the overview and the requirement list
// (page-cited, every quote checked in code), and the result is saved as a
// normal analysis on the user's account so it appears in History and can be
// checked against further proposals. The tender file is not stored.
//
// Paid AI: signed-in users on the beta list only, within the durable usage
// limits (lib/submission/quota.js). The same requestId twice never runs twice.

export const maxDuration = 300;

function summaryFromRow(row) {
  const { requirements, total, cited } = requirementsFromAnalysis(row.analysis_data);
  const prep = prepareRequirements(requirements);
  return {
    name: row.analysis_data?.summary?.projectName || row.project_name || "Tender",
    requirementsTotal: total,
    cited,
    checkable: prep.checked.length,
    notCheckable: prep.excluded.length,
  };
}

export async function POST(request) {
  if (!submissionCheckBetaEnabled()) return errJson(404, "Not found");
  let quota;
  let claim = null;
  let userId = null;
  try {
    const body = await readJsonBody(request);
    const { user, client } = await userFromRequest(request);
    if (!user) return errJson(401, "Your session has expired. Sign in again.");
    userId = user.id;

    // Validate the documents before anything is counted against the user's allowance.
    const { files, totalChars } = normaliseDocuments(body?.tender, { kind: "tender" });

    quota = await getQuota();
    claim = await quota.claim({ user, requestId: body?.requestId, kind: "tender", reserveUsd: estimateRunCostUsd({ kind: "tender", chars: totalChars }) });
    if (!claim.ok) {
      // Same request again after a dropped connection: hand back the tender it already read.
      if (claim.code === "duplicate" && claim.existing?.status === "succeeded" && claim.existing.analysisId) {
        const { data } = await client.from("analyses").select("id, project_name, analysis_data").eq("id", claim.existing.analysisId).eq("user_id", user.id).single();
        if (data?.analysis_data) return NextResponse.json({ success: true, analysisId: data.id, tender: summaryFromRow(data), replayed: true });
      }
      return errJson(claim.status, claim.reason, { code: claim.code }, claim.retryAfterSec ? { "Retry-After": String(claim.retryAfterSec) } : undefined);
    }

    const t0 = Date.now();
    const { analysisData, summary, aiCostUsd } = await readTenderRequirements({ files });

    // Save as the user's own analysis (RLS: users may insert their own rows). Retry once.
    const row = tenderAnalysisRow({ userId: user.id, files, analysisData });
    let saved = null;
    let saveError = null;
    for (let attempt = 1; attempt <= 2 && !saved; attempt++) {
      const res = await client.from("analyses").insert(row).select("id").single();
      saved = res.data;
      saveError = res.error;
    }
    if (!saved?.id) {
      console.error("[submission-check/tender] save failed:", saveError?.message);
      await quota.finish(claim, { userId, status: "failed", costUsd: aiCostUsd, errorCode: "save_failed" });
      return errJson(500, "The tender was read but could not be saved, so it has not been counted against your allowance. Please try again in a few minutes.");
    }
    const pages = files.reduce((n, f) => n + f.pages.length, 0);
    await quota.finish(claim, { userId, status: "succeeded", costUsd: aiCostUsd, analysisId: saved.id, pages, requirements: summary.requirementsTotal });
    // Sizes and cost only: document text is never logged.
    console.log(`[submission-check/tender] user ${userId.slice(0, 8)}: ${files.length} file(s), ${pages} pages, ${totalChars} chars, ${summary.requirementsTotal} reqs, ${Date.now() - t0} ms, $${aiCostUsd} (${claim.store})`);
    return NextResponse.json({
      success: true,
      analysisId: saved.id,
      source: SOURCE,
      tender: summary,
      files: files.map((f) => ({ key: f.key, filename: f.filename, pages: f.pages.length, unit: f.unit, scannedPages: f.scannedPages })),
      usage: claim.store === "db" ? { used: claim.used, limits: claim.limits } : null,
    });
  } catch (e) {
    if (claim?.ok && quota) await quota.finish(claim, { userId, status: "failed", costUsd: e?.aiCostUsd ?? 0, errorCode: e?.code || "error" });
    if (e instanceof BodyError) return errJson(e.status, e.message);
    if (e instanceof DocumentInputError) return errJson(e.status, e.message, { code: e.code });
    console.error("[submission-check/tender] unexpected error:", e);
    return errJson(500, "Something went wrong while reading the tender. Please try again.");
  }
}
