// Scores a Submission Check run against a known-answer list
// (tests/e2e/submission_truth.json).
//
// The metric that matters most is MISSED ISSUES: a requirement that is really
// partial / missing / in conflict but is reported as "answered". That is the
// error that lets a non-compliant bid go out. "unproven" counts as flagged
// (the user is told to check it), not as answered.

const NON_COMPLIANT = new Set(["partial", "missing", "conflict"]);

function scoreStatuses(truth, statusOf) {
  const rows = truth.requirements.map((t) => ({ id: t.id, expected: t.expected, got: statusOf(t.id) ?? "none", trap: t.trap }));
  const exact = rows.filter((r) => r.got === r.expected).length;
  const nonCompliant = rows.filter((r) => NON_COMPLIANT.has(r.expected));
  const answered = rows.filter((r) => r.expected === "answered");
  const missed = nonCompliant.filter((r) => r.got === "answered");
  const falseAlarms = answered.filter((r) => r.got !== "answered");
  return {
    exact: `${exact}/${rows.length}`,
    issuesFlagged: `${nonCompliant.length - missed.length}/${nonCompliant.length}`,
    missedIssues: missed.map((r) => `${r.id} (${r.expected}: ${r.trap})`),
    falseAlarms: falseAlarms.map((r) => `${r.id} (got ${r.got})`),
    wrongStatus: rows.filter((r) => r.got !== r.expected).map((r) => `${r.id}: expected ${r.expected}, got ${r.got}`),
  };
}

/**
 * @param {object} truth   submission_truth.json
 * @param {object} result  runSubmissionCheck() result
 * @returns {{ final, aiOnly, evidence }}  final = after code gates; aiOnly = the AI's own verdicts
 */
export function scoreSubmission(truth, result) {
  const byId = new Map((result?.items || []).map((i) => [i.id, i]));
  const final = scoreStatuses(truth, (id) => byId.get(id)?.status);
  const aiOnly = scoreStatuses(truth, (id) => byId.get(id)?.aiStatus);

  // Evidence: quotes found on the response page, and on the RIGHT page.
  let quotes = 0;
  let found = 0;
  let rightPage = 0;
  let needPage = 0;
  for (const t of truth.requirements) {
    const it = byId.get(t.id);
    for (const e of it?.evidence || []) {
      quotes += 1;
      if (e.status !== "unverified") found += 1;
    }
    if (t.responsePage && it && it.status !== "missing" && it.status !== "unproven") {
      needPage += 1;
      if ((it.evidence || []).some((e) => e.status !== "unverified" && e.page === t.responsePage)) rightPage += 1;
    }
  }
  const tenderVerified = (result?.items || []).filter((i) => i.tender && i.tender.status !== "unverified").length;
  return {
    final,
    aiOnly,
    evidence: {
      responseQuotesFound: `${found}/${quotes}`,
      evidenceOnExpectedPage: `${rightPage}/${needPage}`,
      tenderQuotesVerified: `${tenderVerified}/${(result?.items || []).length}`,
    },
    changedByCode: (result?.items || []).filter((i) => i.status !== i.aiStatus).map((i) => `${i.id}: AI ${i.aiStatus} -> ${i.status}`),
  };
}
