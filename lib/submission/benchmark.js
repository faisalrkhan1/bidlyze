// Scores a Submission Check run against a known-answer list
// (tests/e2e/submission_truth.json).
//
// The metric that matters most is MISSED ISSUES: a requirement that is really
// partial / missing / in conflict but is reported as "answered". That is the
// error that lets a non-compliant bid go out. "unproven" counts as flagged
// (the user is told to check it), not as answered.

const NON_COMPLIANT = new Set(["partial", "missing", "conflict"]);

const ISSUE = (s) => s !== "answered"; // partial/missing/conflict/unproven/none = flagged

function scoreStatuses(truth, statusOf) {
  const rows = truth.requirements.map((t) => ({ id: t.id, expected: t.expected, got: statusOf(t.id) ?? "none", trap: t.trap }));
  const exact = rows.filter((r) => r.got === r.expected).length;
  const nonCompliant = rows.filter((r) => NON_COMPLIANT.has(r.expected));
  const answered = rows.filter((r) => r.expected === "answered");
  const missed = nonCompliant.filter((r) => r.got === "answered");
  const falseAlarms = answered.filter((r) => r.got !== "answered");
  // Issue vs no-issue agreement (a partial reported as conflict still warns the user).
  const issueAgreement = rows.filter((r) => ISSUE(r.got) === NON_COMPLIANT.has(r.expected)).length;
  const matrix = {};
  for (const r of rows) {
    matrix[r.expected] ??= {};
    matrix[r.expected][r.got] = (matrix[r.expected][r.got] || 0) + 1;
  }
  return {
    exact: `${exact}/${rows.length}`,
    issuesFlagged: `${nonCompliant.length - missed.length}/${nonCompliant.length}`,
    issueAgreement: `${issueAgreement}/${rows.length}`,
    falseAlarmCount: `${falseAlarms.length}/${answered.length}`,
    missedIssues: missed.map((r) => `${r.id} (${r.expected}: ${r.trap})`),
    falseAlarms: falseAlarms.map((r) => `${r.id} (got ${r.got})`),
    wrongStatus: rows.filter((r) => r.got !== r.expected).map((r) => `${r.id}: expected ${r.expected}, got ${r.got}`),
    matrix,
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
  let contradictions = 0;
  let bothSides = 0;
  const citeStatus = {};
  for (const t of truth.requirements) {
    const it = byId.get(t.id);
    for (const e of it?.evidence || []) {
      quotes += 1;
      if (e.status !== "unverified") found += 1;
    }
    // Expected evidence pages: answer keys list several when the response
    // contradicts itself (e.g. 31 days in the text, 30 days in an appendix).
    const pages = t.responseEvidence ? [...new Set(t.responseEvidence.map((e) => e.page))] : t.responsePage ? [t.responsePage] : [];
    if (pages.length && it && it.status !== "missing" && it.status !== "unproven") {
      needPage += 1;
      if ((it.evidence || []).some((e) => e.status !== "unverified" && pages.includes(e.page))) rightPage += 1;
    }
    if (pages.length > 1 && it) {
      contradictions += 1;
      const cited = new Set((it.evidence || []).filter((e) => e.status !== "unverified").map((e) => e.page));
      if (pages.every((p) => cited.has(p))) bothSides += 1;
    }
    for (const e of it?.evidence || []) citeStatus[e.status] = (citeStatus[e.status] || 0) + 1;
  }
  const tenderVerified = (result?.items || []).filter((i) => i.tender && i.tender.status !== "unverified").length;
  return {
    final,
    aiOnly,
    evidence: {
      responseQuotesFound: `${found}/${quotes}`,
      evidenceOnExpectedPage: `${rightPage}/${needPage}`,
      tenderQuotesVerified: `${tenderVerified}/${(result?.items || []).length}`,
      // verified = quote on the page the AI cited; relocated = right quote, wrong page
      responseCitationStatus: citeStatus,
      contradictionsBothSidesCited: `${bothSides}/${contradictions}`,
    },
    changedByCode: (result?.items || []).filter((i) => i.status !== i.aiStatus).map((i) => `${i.id}: AI ${i.aiStatus} -> ${i.status}`),
  };
}
