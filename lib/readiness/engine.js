// Tender Readiness engine (MVP).
//
//   files ──► page-numbered text ──► 4 focused AI passes (parallel)
//         ──► every citation checked against the real page text (no AI)
//         ──► decision pass on verified findings only
//         ──► report in the shape the existing UI/exports already read,
//             plus new fields: engine, citations, clarificationQuestions, readiness
//
// Returns { success, data, disqualification, meta } — never throws.

import { askJSON, currentModel } from "@/lib/readiness/ai";
import { buildMarkedDocument, locationLabel } from "@/lib/readiness/pages";
import { buildIndex, verifyCitation, summarizeCitations } from "@/lib/readiness/verify";
import {
  SYSTEM,
  OVERVIEW_TASK,
  REQUIREMENTS_TASK,
  CLARIFICATIONS_TASK,
  DECISION_SYSTEM,
  disqualificationTask,
  decisionTask,
} from "@/lib/readiness/passes";
import { DISQUALIFICATION_CHECKLIST } from "@/lib/disqualificationChecklist";

// ~600k chars ≈ 150k tokens: fits comfortably in Claude's context with room
// for output. Anything beyond is listed in meta.skipped so the reviewer knows.
const MAX_DOC_CHARS = 600_000;

// Risk = how many pass/fail hoops this tender sets, weighted by severity.
// "Required" hoops count most; items the tender is silent on count a little
// (the bidder should confirm them with the buyer).
const REQUIRED_POINTS = { critical: 8, high: 4, medium: 2 };
const SILENT_POINTS = { critical: 3, high: 1, medium: 0 };
const DYN_POINTS = { critical: 12, high: 6, medium: 2 };

function levelFor(score) {
  if (score <= 25) return "low";
  if (score <= 50) return "medium";
  if (score <= 75) return "high";
  return "critical";
}

/** Attach a checked citation + human-readable source label to an item. */
function makeCiter(index, files) {
  const nameOf = new Map(files.map((f) => [f.fileIndex, f.filename]));
  const multi = files.length > 1;
  return (raw) => {
    if (!raw || typeof raw !== "object" || !raw.quote) return null;
    const v = verifyCitation(index, raw);
    const entry = index.byKey.get(`${v.fileIndex}:${v.pageN}`);
    const loc = entry ? locationLabel(entry.page) : v.pageN ? `p.${v.pageN}` : "";
    const fileName = nameOf.get(v.fileIndex) || "";
    return {
      quote: String(raw.quote).slice(0, 400),
      fileIndex: v.fileIndex,
      fileName,
      page: v.pageN,
      status: v.status,
      label: multi && fileName ? `${fileName} · ${loc}` : loc,
    };
  };
}

function text(v, fallback = "Not specified") {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

export async function runReadinessAnalysis({ files, rfxType = "rfp" }) {
  const t0 = Date.now();
  try {
    const { text: document, chars, skipped } = buildMarkedDocument(files, MAX_DOC_CHARS);
    if (chars < 200) {
      return { success: false, error: "Could not read enough text from these files. If they are scanned images, they need OCR first." };
    }

    // ── Passes 1–4 in parallel ──
    const settled = await Promise.allSettled([
      askJSON({ system: SYSTEM, document, task: OVERVIEW_TASK, maxTokens: 6000, label: "pass:overview" }),
      askJSON({ system: SYSTEM, document, task: REQUIREMENTS_TASK, maxTokens: 20000, label: "pass:requirements" }),
      askJSON({ system: SYSTEM, document, task: disqualificationTask(), maxTokens: 10000, label: "pass:disqualification" }),
      askJSON({ system: SYSTEM, document, task: CLARIFICATIONS_TASK, maxTokens: 6000, label: "pass:clarifications" }),
    ]);
    const [ov, rq, dq, cl] = settled.map((s) => (s.status === "fulfilled" ? s.value.json : null));
    const failedPasses = ["overview", "requirements", "disqualification", "clarifications"]
      .filter((_, i) => settled[i].status === "rejected");

    if (!ov && !rq) {
      return { success: false, error: "The AI service could not analyse this tender. Please try again in a few minutes." };
    }

    // ── Verify every citation ──
    const index = buildIndex(files);
    const cite = makeCiter(index, files);

    const summaryRaw = ov?.summary || {};
    const summary = {
      projectName: text(summaryRaw.projectName, "Untitled tender"),
      issuingAuthority: text(summaryRaw.issuingAuthority),
      tenderReference: text(summaryRaw.tenderReference),
      estimatedValue: text(summaryRaw.estimatedValue),
      currency: text(summaryRaw.currency, ""),
      submissionDeadline: text(summaryRaw.submissionDeadline),
      projectDuration: text(summaryRaw.projectDuration),
      location: text(summaryRaw.location),
      sector: text(summaryRaw.sector),
      briefDescription: text(summaryRaw.briefDescription, ""),
      citation: cite(summaryRaw.citation),
    };

    const keyDates = (ov?.keyDates || []).slice(0, 25).map((d) => {
      const c = cite(d.citation);
      return { event: text(d.event, ""), date: text(d.date), citation: c, sourceRef: c?.label || "" };
    });

    const evaluationCriteria = (ov?.evaluationCriteria || []).slice(0, 30).map((e) => ({
      criterion: text(e.criterion, ""),
      weight: text(e.weight),
      details: text(e.details, ""),
      citation: cite(e.citation),
    }));

    const fin = ov?.financialRequirements || {};
    const finField = (k) => ({ text: text(fin[k]?.text), citation: cite(fin[k]?.citation) });
    const financialRequirements = {
      bidBond: finField("bidBond").text,
      performanceBond: finField("performanceBond").text,
      minimumTurnover: finField("minimumTurnover").text,
      otherFinancial: [finField("paymentTerms").text, finField("penalties").text].filter((x) => x !== "Not specified").join(" · ") || "Not specified",
      cited: {
        bidBond: finField("bidBond"),
        performanceBond: finField("performanceBond"),
        minimumTurnover: finField("minimumTurnover"),
        paymentTerms: finField("paymentTerms"),
        penalties: finField("penalties"),
      },
    };

    const submission = ov?.submission
      ? {
          method: text(ov.submission.method),
          envelopes: text(ov.submission.envelopes),
          copies: text(ov.submission.copies),
          language: text(ov.submission.language),
          bidValidity: text(ov.submission.bidValidity),
          citation: cite(ov.submission.citation),
        }
      : null;

    const requirements = (rq?.requirements || []).slice(0, 150).map((r, i) => {
      const c = cite(r.citation);
      const priority = ["HIGH", "MEDIUM", "LOW"].includes(String(r.priority).toUpperCase()) ? String(r.priority).toUpperCase() : "MEDIUM";
      return {
        id: `R${i + 1}`,
        category: text(r.category, "Technical"),
        requirement: text(r.requirement, ""),
        mandatory: r.mandatory !== false,
        priority,
        responseNeeded: text(r.responseNeeded, ""),
        sourceRef: c?.label || "",
        citation: c,
      };
    }).filter((r) => r.requirement);

    // ── Disqualification: fixed checklist + dynamic findings ──
    const fixedById = new Map((dq?.fixed_checks || []).filter((x) => x?.id).map((x) => [x.id, x]));
    const fixed_checks = DISQUALIFICATION_CHECKLIST.map((item) => {
      const raw = fixedById.get(item.id) || {};
      const status = ["required", "not_required", "not_specified"].includes(raw.status) ? raw.status : "not_specified";
      const c = status === "not_specified" ? null : cite(raw.citation);
      return {
        id: item.id,
        label: item.label,
        severity: item.severity,
        status,
        details: text(raw.details, ""),
        evidence_quote: c?.quote?.slice(0, 200) || "",
        page_reference: c?.label || null,
        citation_status: c?.status || null,
      };
    });
    const dynamic_findings = (dq?.dynamic_findings || []).filter((d) => d?.title).slice(0, 15).map((d) => {
      const c = cite(d.citation);
      const severity = ["critical", "high", "medium"].includes(d.severity) ? d.severity : "medium";
      return {
        title: String(d.title).slice(0, 200),
        severity,
        details: text(d.details, ""),
        evidence_quote: c?.quote?.slice(0, 200) || "",
        page_reference: c?.label || null,
        citation_status: c?.status || null,
      };
    });

    // "Required" items are what the bidder must have; silent critical items are
    // flagged too because the bidder should confirm them with the buyer.
    let risk_score = 0;
    for (const fc of fixed_checks) {
      if (fc.status === "required") risk_score += REQUIRED_POINTS[fc.severity] || 0;
      else if (fc.status === "not_specified") risk_score += SILENT_POINTS[fc.severity] || 0;
    }
    for (const df of dynamic_findings) risk_score += DYN_POINTS[df.severity] || 0;
    risk_score = Math.min(100, risk_score);

    const disqualification = dq
      ? {
          risk_score,
          risk_level: levelFor(risk_score),
          fixed_checks,
          dynamic_findings,
          summary: text(dq.summary, "Disqualification check complete."),
        }
      : null;

    const clarificationQuestions = (cl?.clarifications || []).slice(0, 15).map((q) => {
      const c = cite(q.citation);
      return {
        question: text(q.question, ""),
        reason: text(q.reason, ""),
        priority: ["HIGH", "MEDIUM", "LOW"].includes(String(q.priority).toUpperCase()) ? String(q.priority).toUpperCase() : "MEDIUM",
        source: c?.label || "",
        citation: c,
      };
    }).filter((q) => q.question);

    // ── Pass 5: decision on verified findings only ──
    const verifiedOnly = (arr) => arr.filter((x) => x.citation && x.citation.status !== "unverified");
    let decision = null;
    try {
      const r = await askJSON({
        system: DECISION_SYSTEM,
        task: decisionTask({
          summary: { ...summary, citation: undefined },
          keyDates: verifiedOnly(keyDates).map(({ event, date }) => ({ event, date })),
          submission: submission ? { ...submission, citation: undefined } : null,
          financial: financialRequirements.cited,
          mandatoryRequirements: verifiedOnly(requirements).filter((r) => r.mandatory).slice(0, 80).map((r) => `${r.priority}: ${r.requirement}`),
          disqualificationRequired: fixed_checks.filter((f) => f.status === "required").map((f) => `${f.label}: ${f.details}`),
          disqualificationSilent: fixed_checks.filter((f) => f.status === "not_specified" && f.severity === "critical").map((f) => f.label),
          otherDisqualifiers: dynamic_findings.map((d) => `${d.severity}: ${d.title} — ${d.details}`),
        }),
        maxTokens: 3000,
        label: "pass:decision",
      });
      decision = r.json;
    } catch (e) {
      console.error("[readiness] decision pass failed:", e?.message);
      failedPasses.push("decision");
    }

    const recommendation = ["BID", "CONDITIONAL BID", "NO-BID"].includes(decision?.recommendation) ? decision.recommendation : "REVIEW";
    const bidScore = {
      score: Number.isFinite(Number(decision?.score)) ? Math.max(0, Math.min(100, Math.round(Number(decision.score)))) : null,
      recommendation,
      reasoning: text(decision?.reasoning, "Recommendation pending human review."),
      conditions: Array.isArray(decision?.conditions) ? decision.conditions.slice(0, 10) : [],
    };

    // ── Compliance matrix rows (existing ComplianceMatrix + Excel export read these) ──
    const complianceItems = requirements.map((r) => ({
      item: r.requirement,
      requirement: r.requirement,
      category: r.category,
      severity: r.priority,
      status: "needs_review",
      source: r.sourceRef,
      remediation: r.responseNeeded,
      commonIssue: r.citation?.quote ? `Tender text: "${r.citation.quote}"` : "",
      citationStatus: r.citation?.status || "unverified",
    }));

    const allCited = [
      { citation: summary.citation },
      ...keyDates, ...evaluationCriteria, ...requirements, ...clarificationQuestions,
      ...fixed_checks.filter((f) => f.citation_status).map((f) => ({ citation: { status: f.citation_status } })),
      ...dynamic_findings.filter((f) => f.citation_status).map((f) => ({ citation: { status: f.citation_status } })),
    ];
    const citations = summarizeCitations(allCited);

    const data = {
      engine: "readiness-v2",
      model: currentModel(),
      rfxType,
      summary,
      keyDates,
      submission,
      evaluationCriteria,
      financialRequirements,
      requirements,
      complianceAnalysis: {
        overallComplianceScore: null, // unknown until the bidder's own documents are checked
        summary: {
          totalItems: requirements.length,
          compliant: 0,
          gaps: 0,
          critical: requirements.filter((r) => r.priority === "HIGH" && r.mandatory).length,
        },
        items: complianceItems,
        missingDocuments: [],
        certificationGaps: [],
        actionPlan: (decision?.topActions || []).slice(0, 8).map((a, i) => ({
          priority: i + 1,
          action: text(a.action, ""),
          deadline: text(a.deadline, ""),
          owner: text(a.owner, ""),
        })),
      },
      clarificationQuestions,
      bidScore,
      readiness: {
        showstoppers: Array.isArray(decision?.showstoppers) ? decision.showstoppers.slice(0, 5) : [],
        mandatoryCount: requirements.filter((r) => r.mandatory).length,
        disqualifiersRequired: fixed_checks.filter((f) => f.status === "required").length,
        criticalSilent: fixed_checks.filter((f) => f.status === "not_specified" && f.severity === "critical").map((f) => f.label),
      },
      citations,
      meta: {
        files: files.map((f) => ({ fileIndex: f.fileIndex, filename: f.filename, role: f.role, pages: f.pages.length, scannedPages: f.scannedPages || [] })),
        skipped,
        failedPasses,
        durationMs: Date.now() - t0,
      },
    };

    console.log(`[readiness] done in ${Date.now() - t0}ms — reqs=${requirements.length} cites=${JSON.stringify(citations)} failed=${failedPasses.join(",") || "none"}`);
    return { success: true, data, disqualification };
  } catch (e) {
    console.error("[readiness] unexpected error:", e);
    return { success: false, error: "Unexpected error while analysing the tender. Please try again." };
  }
}
