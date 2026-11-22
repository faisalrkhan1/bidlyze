// Server-side core of the Submission Check beta (used by
// app/api/submission-check/route.js, kept here so it can be unit-tested).
//
// Input: requirements from a saved analysis + the proposal's page text
// (extracted in the user's browser). Output: the result object the UI and the
// export use. Nothing is stored.

import { runSubmissionCheck } from "./check.js";
import { requirementsFromAnalysis } from "./fromAnalysis.js";
import { prepareRequirements, classifyRequirement, documentName, findSeparateMention } from "./obligations.js";

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
 * Documents the tender asks for, and whether the uploaded file contains them.
 * A document that is not in the uploaded file is NOT treated as missing from the
 * bid: the proposal may say it is handed in separately ("Document 2").
 * Also fills in requirement types for results recorded before types existed.
 */
export function addDocumentFindings(result, pages) {
  const items = (result.items || []).map((it) => {
    let next = it;
    if (!next.type) {
      const t = classifyRequirement({ requirement: it.requirement, tenderQuote: it.tender?.quote, mandatory: it.mandatory, category: it.category });
      const doc = t.type === "mandatory" || t.type === "conditional" ? documentName({ requirement: it.requirement, tenderQuote: it.tender?.quote }) : null;
      next = { ...next, type: t.type, typeReason: t.reason, ...(doc ? { document: { name: doc } } : {}) };
    }
    if (next.document) {
      const mention = findSeparateMention(next.document.name, pages);
      next = { ...next, documentMention: mention };
    }
    return next;
  });
  const documents = items
    .filter((it) => it.document)
    .map((it) => {
      const found = (it.evidence || []).some((e) => e.status && e.status !== "unverified");
      // described: the proposal talks about the document (e.g. "We enclose a bid bond of 1%");
      // separate:  only a reference to it as a separate file/annex; not_found: no mention at all.
      const state = it.notChecked ? "not_checked" : found ? "described" : it.documentMention ? "separate" : "not_found";
      return {
        id: it.id,
        name: it.document.name,
        state,
        evidencePage: found ? (it.evidence.find((e) => e.status !== "unverified") || {}).page ?? null : null,
        mentionPage: it.documentMention?.page ?? null,
        mentionText: it.documentMention?.text || "",
      };
    });
  return { ...result, items, documents };
}

/**
 * @param {object} args
 * @param {object} args.analysis   { id, name, fileName, analysisData }
 * @param {object} args.response   output of normaliseResponse()
 * @param {Function} [args.run]    engine (injected in tests)
 */
export async function checkProposalAgainstAnalysis({ analysis, response, run = runSubmissionCheck }) {
  const { requirements: fromAnalysis, total, truncated, cited } = requirementsFromAnalysis(analysis.analysisData);
  if (fromAnalysis.length === 0) {
    throw new CheckInputError("This analysis has no requirement list to check against. Run a new analysis of the tender first.", 422);
  }
  const { checked: requirements, excluded, prep } = prepareRequirements(fromAnalysis);
  if (requirements.length === 0) {
    throw new CheckInputError("None of this analysis's requirements can be checked against a proposal (they are all scoring guidance).", 422);
  }
  const out = await run({
    requirements,
    responseFiles: [{ fileIndex: 1, filename: response.filename, role: "primary", pages: response.pages }],
  });
  if (!out?.success) throw new CheckInputError(out?.error || "The check could not be completed.", 502);
  const byId = new Map(requirements.map((r) => [r.id, r]));
  const items = out.items.map((it) => {
    const r = byId.get(it.id) || {};
    return {
      ...it,
      category: r.category,
      mandatory: r.type === "mandatory" || r.type === "conditional",
      priority: r.priority,
      sourceRef: r.sourceRef,
      type: r.type,
      typeReason: r.typeReason,
      ...(r.document ? { document: r.document } : {}),
      ...(r.splitFrom ? { splitFrom: r.splitFrom } : {}),
      ...(r.narrowed ? { narrowed: r.narrowed } : {}),
      ...(r.duplicates ? { duplicates: r.duplicates } : {}),
    };
  });
  const result = {
    success: true,
    checkedAt: new Date().toISOString(),
    tender: { analysisId: analysis.id, name: analysis.name, fileName: analysis.fileName, requirementsTotal: total, cited },
    response: { filename: response.filename, contentType: response.contentType, sha256: response.sha256, pages: response.pages.length, unit: response.unit, scannedPages: response.scannedPages },
    items,
    excluded: excluded.map((e) => ({
      id: e.id,
      requirement: e.requirement,
      type: e.type,
      reason: e.typeReason,
      tender: e.tenderQuote ? { quote: e.tenderQuote, page: e.tenderPage, fileName: e.tenderFileName, status: e.tenderCitationStatus } : null,
    })),
    prep,
    summary: out.summary,
    meta: {
      model: out.meta?.model,
      durationMs: out.meta?.durationMs,
      failedBatches: out.meta?.failedBatches || [],
      truncatedBatches: out.meta?.truncatedBatches || [],
      skipped: out.meta?.skipped || [],
      aiCostUsd: out.meta?.aiUsage?.costUsd ?? null,
    },
    truncated: truncated || prep.overLimit > 0,
    legacy: cited === 0,
  };
  return addDocumentFindings(result, response.pages);
}
