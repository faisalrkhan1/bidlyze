// Server-side core of the Submission Check beta (used by
// app/api/submission-check/route.js, kept here so it can be unit-tested).
//
// Input: requirements from a saved analysis + the proposal's page text
// (extracted in the user's browser). Output: the result object the UI and the
// export use. Nothing is stored.

import { runSubmissionCheck } from "./check.js";
import { aiFailureStatus } from "../readiness/ai.js";
import { requirementsFromAnalysis } from "./fromAnalysis.js";
import { prepareRequirements, classifyRequirement, documentName, findSeparateMention } from "./obligations.js";
import { DOC_LIMITS, DocumentInputError, normaliseDocuments } from "./documents.js";

export const LIMITS = {
  maxPages: DOC_LIMITS.maxPagesPerFile,
  maxPageChars: DOC_LIMITS.maxPageChars,
  maxTotalChars: DOC_LIMITS.maxTotalChars,
  minReadableChars: DOC_LIMITS.minReadableChars,
};

export const CheckInputError = DocumentInputError;

/**
 * Validate and normalise the proposal sent by the browser: one file (legacy
 * shape: { filename, pages, ... }) or several ({ files: [...] }).
 * Keeps the single-file fields (filename, pages, unit, scannedPages) for the
 * first file so older code and saved results keep working.
 */
export function normaliseResponse(response) {
  if (!response || typeof response !== "object") throw new CheckInputError("No proposal was sent.");
  const { files } = normaliseDocuments(response, { kind: "proposal" });
  const first = files[0];
  return {
    filename: files.length === 1 ? first.filename : files.map((f) => f.filename).join(" + ").slice(0, 300),
    contentType: first.contentType,
    sha256: files.length === 1 ? first.sha256 : null,
    unit: first.unit,
    pages: first.pages,
    scannedPages: first.scannedPages,
    files,
  };
}

/** Pages of every proposal file, tagged with the file key (R1, R2, ...). */
function filePages(responseOrPages) {
  if (Array.isArray(responseOrPages)) return [{ key: "R1", pages: responseOrPages }];
  if (Array.isArray(responseOrPages?.files) && responseOrPages.files.length) return responseOrPages.files.map((f) => ({ key: f.key, pages: f.pages || [] }));
  return [{ key: "R1", pages: responseOrPages?.pages || [] }];
}

/**
 * Documents the tender asks for, and whether the uploaded file contains them.
 * A document that is not in the uploaded file is NOT treated as missing from the
 * bid: the proposal may say it is handed in separately ("Document 2").
 * Also fills in requirement types for results recorded before types existed.
 */
export function addDocumentFindings(result, pagesOrResponse) {
  const sources = filePages(pagesOrResponse);
  const items = (result.items || []).map((it) => {
    let next = it;
    if (!next.type) {
      const t = classifyRequirement({ requirement: it.requirement, tenderQuote: it.tender?.quote, mandatory: it.mandatory, category: it.category });
      const doc = t.type === "mandatory" || t.type === "conditional" ? documentName({ requirement: it.requirement, tenderQuote: it.tender?.quote }) : null;
      next = { ...next, type: t.type, typeReason: t.reason, ...(doc ? { document: { name: doc } } : {}) };
    }
    if (next.document) {
      let mention = null;
      for (const src of sources) {
        const m = findSeparateMention(next.document.name, src.pages);
        if (m) { mention = { ...m, file: src.key }; break; }
      }
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
      const ev = found ? it.evidence.find((e) => e.status !== "unverified") || {} : null;
      return {
        id: it.id,
        name: it.document.name,
        state,
        evidencePage: ev ? ev.page ?? null : null,
        evidenceFile: ev ? ev.file || "R1" : null,
        mentionPage: it.documentMention?.page ?? null,
        mentionFile: it.documentMention?.file || null,
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
  const responseFiles = Array.isArray(response.files) && response.files.length
    ? response.files.map((f) => ({ fileIndex: f.fileIndex, filename: f.filename, role: f.role, pages: f.pages }))
    : [{ fileIndex: 1, filename: response.filename, role: "primary", pages: response.pages }];
  const out = await run({ requirements, responseFiles });
  if (!out?.success) {
    const timedOut = Boolean(out?.meta?.timedOut);
    const code = timedOut ? "ai_timeout" : out?.meta?.aiErrorCode || "ai_failed";
    const e = new CheckInputError(out?.error || "The check could not be completed.", aiFailureStatus(code, timedOut), code);
    e.aiCostUsd = out?.meta?.aiUsage?.costUsd ?? null;
    throw e;
  }
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
    response: {
      filename: response.filename,
      contentType: response.contentType,
      sha256: response.sha256,
      pages: (response.files || [response]).reduce((n, f) => n + f.pages.length, 0),
      unit: response.unit,
      scannedPages: response.scannedPages,
      files: (response.files || []).map((f) => ({ key: f.key, filename: f.filename, sha256: f.sha256, pages: f.pages.length, unit: f.unit, scannedPages: f.scannedPages })),
    },
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
  return addDocumentFindings(result, response);
}
