// Read a tender's requirements for a Submission Check, reusing the Tender
// Intelligence engine (lib/readiness/engine.js) with only the passes the check
// needs: the overview (name, reference, deadline) and the requirement list with
// page-cited, code-verified tender quotes.
//
// The result has the same shape as a Tender Intelligence analysis, so it is
// saved as a normal row in `analyses` (no schema change) and appears in History.
// The tender file itself is not uploaded or stored: only the extracted
// requirement list, the short quotes and the file names.

import { runReadinessAnalysis, REQUIREMENT_PASSES } from "../readiness/engine.js";
import { requirementsFromAnalysis } from "./fromAnalysis.js";
import { prepareRequirements } from "./obligations.js";
import { DocumentInputError } from "./documents.js";
import { AI_SERVICE_PROBLEMS, aiErrorMessage, aiFailureStatus } from "../readiness/ai.js";

export const SOURCE = "submission-check";

/**
 * @param {object} args
 * @param {Array} args.files  output of normaliseDocuments(..., { kind: "tender" }).files
 * @param {Function} [args.run]  engine (injected in tests)
 * @returns {Promise<{ analysisData: object, summary: object, aiCostUsd: number }>}
 * @throws {DocumentInputError} with .aiCostUsd when the AI was called
 */
export async function readTenderRequirements({ files, run = runReadinessAnalysis }) {
  const engineFiles = files.map((f) => ({ fileIndex: f.fileIndex, filename: f.filename, role: f.role, pages: f.pages, scannedPages: f.scannedPages || [] }));
  const out = await run({ files: engineFiles, rfxType: "rfp", passes: REQUIREMENT_PASSES });
  const cost = Number(out?.data?.meta?.aiUsage?.costUsd ?? out?.meta?.aiUsage?.costUsd ?? 0) || 0;
  const fail = (message, status, code) => Object.assign(new DocumentInputError(message, status, code), { aiCostUsd: cost });

  if (!out?.success) {
    const timedOut = Boolean(out?.meta?.timedOut);
    const code = timedOut ? "ai_timeout" : out?.meta?.aiErrorCode || "ai_failed";
    throw fail(out?.error || aiErrorMessage(code, "tender"), aiFailureStatus(code, timedOut), code);
  }
  const meta = out.data?.meta || {};
  // Never save a tender whose requirement list failed: a check against it would look complete but is not.
  if ((meta.failedPasses || []).includes("requirements")) {
    if (AI_SERVICE_PROBLEMS.has(meta.aiErrorCode)) throw fail(aiErrorMessage(meta.aiErrorCode, "tender"), 503, meta.aiErrorCode);
    throw fail("The tender's requirements could not be read this time (the AI service did not answer). Please try again.", 502, "requirements_failed");
  }
  const analysisData = { ...out.data, meta: { ...meta, source: SOURCE } };
  const { requirements, total, cited } = requirementsFromAnalysis(analysisData);
  if (total === 0) {
    throw fail("No requirements were found in this document. Check that it is the buyer's tender (ITT, RFP or RFQ) and not a proposal or a cover letter.", 422, "no_requirements");
  }
  const { checked, excluded } = prepareRequirements(requirements);
  return {
    analysisData,
    aiCostUsd: cost,
    summary: {
      name: analysisData.summary?.projectName || files[0].filename,
      reference: analysisData.summary?.tenderReference || "",
      issuer: analysisData.summary?.issuingAuthority || "",
      deadline: analysisData.summary?.submissionDeadline || "",
      requirementsTotal: total,
      cited,
      checkable: checked.length,
      notCheckable: excluded.length,
      capped: Boolean(meta.requirementsCapped),
      truncated: (meta.truncatedPasses || []).includes("requirements"),
      overviewFailed: (meta.failedPasses || []).includes("overview"),
      scannedPages: files.reduce((n, f) => n + (f.scannedPages?.length || 0), 0),
    },
  };
}

/** The row saved in `analyses` (same columns /api/analyze writes). */
export function tenderAnalysisRow({ userId, files, analysisData }) {
  const first = files[0]?.filename || "tender";
  return {
    user_id: userId,
    file_name: files.length > 1 ? `${first} (+${files.length - 1} more)`.slice(0, 250) : first,
    file_path: null, // the file is read in the browser; nothing is stored
    project_name: analysisData.summary?.projectName || first,
    bid_score: null,
    analysis_data: analysisData,
  };
}
