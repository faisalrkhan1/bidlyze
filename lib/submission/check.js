// Submission Check (prototype): does the bidder's response answer every tender
// requirement? Two-sided evidence:
//   tender side   — each requirement's tender quote is checked on the tender page
//   response side — each AI quote from the bid is checked on the response page
// then deterministic gates (gates.js) decide what the evidence actually proves.
//
// Input requirements come from Tender Intelligence (the requirements pass, with
// verified tender citations) or, in tests, from a known-answer list.
// Returns { success, items, summary, meta } — never throws.

import { askJSON, currentModel, aiErrorMessage, pickAiErrorCode } from "../readiness/ai.js";
import { buildMarkedDocument } from "../readiness/pages.js";
import { buildIndex, verifyCitation } from "../readiness/verify.js";
import { SUBMISSION_SYSTEM, coverageTask } from "./prompts.js";
import { applyGates } from "./gates.js";

const MAX_RESPONSE_CHARS = 600_000;
const BATCH = 40; // requirements per AI call (keeps each answer well inside the output limit)

/**
 * @param {object} args
 * @param {Array<{id, requirement, tenderQuote, tenderFile?, tenderPage?}>} args.requirements
 * @param {Array<{fileIndex, filename, role, pages}>} args.responseFiles  page-extracted bid response
 * @param {Array<{fileIndex, filename, role, pages}>} [args.tenderFiles]  page-extracted tender (to verify tender quotes)
 */
export async function runSubmissionCheck({ requirements, responseFiles, tenderFiles = [] }) {
  const t0 = Date.now();
  try {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return { success: false, error: "No requirements to check." };
    }
    const { text: document, chars, skipped } = buildMarkedDocument(responseFiles, MAX_RESPONSE_CHARS, "R");
    if (chars < 100) {
      return { success: false, error: "Could not read enough text from the response. If it is scanned, it needs OCR first." };
    }

    // Tender side: verify each requirement's tender quote (independent of the AI).
    const tenderIndex = tenderFiles.length ? buildIndex(tenderFiles) : null;
    const tenderCheck = (r) => {
      if (!r.tenderQuote) return null;
      // No tender text supplied (the beta UI): keep the verification that
      // Tender Intelligence already did in code when the analysis was made.
      if (!tenderIndex) {
        return { quote: r.tenderQuote, file: r.tenderFile || "F1", page: r.tenderPage ?? null, status: r.tenderCitationStatus || "unverified", fileName: r.tenderFileName || "", checkedBy: "analysis" };
      }
      const v = verifyCitation(tenderIndex, { quote: r.tenderQuote, file: r.tenderFile || "F1", page: r.tenderPage });
      return { quote: r.tenderQuote, file: `F${v.fileIndex}`, page: v.pageN, status: v.status };
    };

    // Response side: one AI pass per batch of requirements (batches run in parallel).
    const batches = [];
    for (let i = 0; i < requirements.length; i += BATCH) batches.push(requirements.slice(i, i + BATCH));
    const settled = await Promise.allSettled(
      batches.map((b, i) =>
        askJSON({
          system: SUBMISSION_SYSTEM,
          document,
          documentTag: "bid_response",
          task: coverageTask(b),
          maxTokens: 16000,
          label: `submission:batch${i + 1}`,
        })
      )
    );

    const aiById = new Map();
    const aiUsage = { model: currentModel(), calls: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, costUsd: 0 };
    const failedBatches = [];
    const truncatedBatches = [];
    let timedOut = false;
    settled.forEach((s, i) => {
      if (s.status !== "fulfilled") {
        failedBatches.push(i + 1);
        if (s.reason?.timeout) timedOut = true;
        const fu = s.reason?.usage;
        if (fu) { aiUsage.promptTokens += Number(fu.prompt_tokens) || 0; aiUsage.completionTokens += Number(fu.completion_tokens) || 0; aiUsage.costUsd += Number(fu.cost) || 0; }
        return;
      }
      const u = s.value.usage || {};
      aiUsage.calls += 1;
      aiUsage.promptTokens += Number(u.prompt_tokens) || 0;
      aiUsage.completionTokens += Number(u.completion_tokens) || 0;
      aiUsage.cachedTokens += Number(u.prompt_tokens_details?.cached_tokens) || 0;
      aiUsage.costUsd += Number(u.cost) || 0;
      if (s.value.truncated) truncatedBatches.push(i + 1);
      for (const r of s.value.json?.results || []) if (r?.id) aiById.set(String(r.id), r);
    });

    if (failedBatches.length === batches.length) {
      const aiErrorCode = pickAiErrorCode(settled.map((x) => x.reason));
      return {
        success: false,
        error: timedOut
          ? "The check took too long and was stopped. Try again; if it happens again, upload a shorter proposal (only the sections that answer the tender)."
          : aiErrorMessage(aiErrorCode, "proposal"),
        meta: { timedOut, aiErrorCode, aiUsage: { ...aiUsage, costUsd: Math.round(aiUsage.costUsd * 10000) / 10000 } },
      };
    }

    const responseIndex = buildIndex(responseFiles);
    const items = requirements.map((req) => {
      const ai = aiById.get(String(req.id));
      const gated = ai
        ? applyGates(req, ai, responseIndex)
        : { id: req.id, status: "unproven", aiStatus: null, decidedBy: "code", notChecked: true, evidence: [], checks: [], flags: ["Not checked (the AI did not return this requirement) — check it yourself."], gap: "" };
      return { ...gated, requirement: req.requirement, tender: tenderCheck(req) };
    });

    const summary = { total: items.length, answered: 0, partial: 0, conflict: 0, missing: 0, manual: 0, unproven: 0, decidedByCode: 0 };
    for (const it of items) {
      summary[it.status] += 1;
      if (it.decidedBy === "code" && it.status !== it.aiStatus) summary.decidedByCode += 1;
    }

    return {
      success: true,
      items,
      summary,
      meta: {
        model: currentModel(),
        skipped,
        failedBatches,
        truncatedBatches,
        aiUsage: { ...aiUsage, costUsd: Math.round(aiUsage.costUsd * 10000) / 10000 },
        durationMs: Date.now() - t0,
      },
    };
  } catch (e) {
    console.error("[submission] unexpected error:", e);
    return { success: false, error: "Unexpected error while checking the response." };
  }
}
