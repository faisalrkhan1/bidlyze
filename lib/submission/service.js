// Server-side core of the Submission Check beta (used by
// app/api/submission-check/route.js, kept here so it can be unit-tested).
//
// Input: requirements from a saved analysis + the proposal's page text
// (extracted in the user's browser). Output: the result object the UI and the
// export use. Nothing is stored.

import { runSubmissionCheck } from "./check.js";
import { requirementsFromAnalysis } from "./fromAnalysis.js";

export const LIMITS = {
  maxPages: 2000,
  maxPageChars: 60_000,
  maxTotalChars: 1_500_000, // the engine reads the first 600k; anything beyond is reported as skipped
  minReadableChars: 200,
};

export class CheckInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Validate and normalise the proposal pages sent by the browser. */
export function normaliseResponse(response) {
  if (!response || typeof response !== "object") throw new CheckInputError("No proposal was sent.");
  const filename = String(response.filename || "proposal").slice(0, 200);
  const pagesIn = Array.isArray(response.pages) ? response.pages : null;
  if (!pagesIn || pagesIn.length === 0) throw new CheckInputError("The proposal has no pages.");
  if (pagesIn.length > LIMITS.maxPages) throw new CheckInputError(`The proposal has more than ${LIMITS.maxPages} pages; the beta cannot check it in one go.`, 413);
  let total = 0;
  const pages = pagesIn.map((p, i) => {
    const text = typeof p?.text === "string" ? p.text.slice(0, LIMITS.maxPageChars) : "";
    total += text.length;
    const unit = ["page", "section", "sheet"].includes(p?.unit) ? p.unit : "page";
    return { unit, n: Number.isInteger(p?.n) && p.n > 0 ? p.n : i + 1, text };
  });
  if (total > LIMITS.maxTotalChars) throw new CheckInputError("The proposal is too long for the beta (more than 1.5 million characters).", 413);
  const readable = pages.reduce((s, p) => s + p.text.replace(/\s/g, "").length, 0);
  if (readable < LIMITS.minReadableChars) {
    throw new CheckInputError("No readable text was found in the proposal. If it is a scanned document, run it through OCR first.", 422);
  }
  return {
    filename,
    contentType: String(response.contentType || "").slice(0, 120),
    sha256: /^[0-9a-f]{64}$/.test(String(response.sha256 || "")) ? response.sha256 : null,
    unit: pages[0].unit,
    pages,
    scannedPages: Array.isArray(response.scannedPages) ? response.scannedPages.filter(Number.isInteger).slice(0, LIMITS.maxPages) : [],
  };
}

/**
 * @param {object} args
 * @param {object} args.analysis   { id, name, fileName, analysisData }
 * @param {object} args.response   output of normaliseResponse()
 * @param {Function} [args.run]    engine (injected in tests)
 */
export async function checkProposalAgainstAnalysis({ analysis, response, run = runSubmissionCheck }) {
  const { requirements, total, truncated, cited } = requirementsFromAnalysis(analysis.analysisData);
  if (requirements.length === 0) {
    throw new CheckInputError("This analysis has no requirement list to check against. Run a new analysis of the tender first.", 422);
  }
  const out = await run({
    requirements,
    responseFiles: [{ fileIndex: 1, filename: response.filename, role: "primary", pages: response.pages }],
  });
  if (!out?.success) throw new CheckInputError(out?.error || "The check could not be completed.", 502);
  const byId = new Map(requirements.map((r) => [r.id, r]));
  const items = out.items.map((it) => {
    const r = byId.get(it.id) || {};
    return { ...it, category: r.category, mandatory: r.mandatory, priority: r.priority, sourceRef: r.sourceRef };
  });
  return {
    success: true,
    checkedAt: new Date().toISOString(),
    tender: { analysisId: analysis.id, name: analysis.name, fileName: analysis.fileName, requirementsTotal: total, cited },
    response: { filename: response.filename, contentType: response.contentType, sha256: response.sha256, pages: response.pages.length, unit: response.unit, scannedPages: response.scannedPages },
    items,
    summary: out.summary,
    meta: {
      model: out.meta?.model,
      durationMs: out.meta?.durationMs,
      failedBatches: out.meta?.failedBatches || [],
      truncatedBatches: out.meta?.truncatedBatches || [],
      skipped: out.meta?.skipped || [],
      aiCostUsd: out.meta?.aiUsage?.costUsd ?? null,
    },
    truncated,
    legacy: cited === 0,
  };
}
