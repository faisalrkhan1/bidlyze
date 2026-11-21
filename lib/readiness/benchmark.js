// Scores a Bidlyze analysis of the known-answer test tender
// (tests/e2e/ECTA_test_tender.pdf + tests/e2e/ground_truth.json).
// Used by the CLI (tests/e2e/score.mjs), the offline test and the preview-only
// live self-test (/api/selftest).

export function score(truth, data, disq) {
  const out = { checks: [], misses: [], falseAlarms: [], wrongPage: [], dates: {}, traps: {}, citations: null, aiUsage: null };
  const fixed = new Map((disq?.fixed_checks || data?.disqualification?.fixed_checks || []).map((f) => [f.id, f]));
  const pageOf = (ref) => Number(String(ref || "").match(/p\.(\d+)/)?.[1]) || null;

  for (const [id, page] of Object.entries(truth.required)) {
    const f = fixed.get(id);
    const found = f?.status === "required";
    const p = pageOf(f?.page_reference);
    const pageOk = found && (p === page || (id === "mandatory_site_visit" && (p === 5 || p === 6)));
    out.checks.push({ id, found, page: p, expected: page, pageOk, citation: f?.citation_status || null });
    if (!found) out.misses.push(id);
    else if (!pageOk) out.wrongPage.push(`${id} (p.${p}, expected p.${page})`);
  }
  for (const id of truth.not_specified) {
    if (fixed.get(id)?.status === "required") out.falseAlarms.push(id);
  }

  const blob = (x) => JSON.stringify(x || "").toLowerCase();
  // Collect every date the report mentions as YYYY-MM-DD (handles "10 December 2026",
  // "2026-12-10" and "10/12/2026"), so "2026" can't be mistaken for the 20th.
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const iso = new Set();
  const pad = (n) => String(n).padStart(2, "0");
  const text = blob(data?.keyDates);
  for (const m of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*,?\s+(\d{4})\b/g)) iso.add(`${m[3]}-${pad(MONTHS.indexOf(m[2]) + 1)}-${pad(m[1])}`);
  for (const m of text.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/g)) iso.add(`${m[3]}-${pad(MONTHS.indexOf(m[1]) + 1)}-${pad(m[2])}`);
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) iso.add(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) iso.add(`${m[3]}-${pad(m[2])}-${pad(m[1])}`);
  out.dates = {
    siteVisit: iso.has("2026-12-10"),
    clarificationDeadline: iso.has("2026-12-20"),
    closing: iso.has("2027-01-15"),
  };

  const qs = blob(data?.clarificationQuestions);
  out.traps = {
    integrationPlatformNotNamed: /platform|parking management/.test(qs),
    boqQuantityConflict: /2,?400|2,?600|quantit/.test(qs),
  };

  out.citations = data?.citations || null;
  out.aiUsage = data?.meta?.aiUsage || null;
  out.requirements = (data?.complianceMatrix?.items || data?.requirements || []).length;

  const req = Object.keys(truth.required).length;
  const found = out.checks.filter((c) => c.found).length;
  const pagesOk = out.checks.filter((c) => c.pageOk).length;
  out.summary = {
    disqualificationRecall: `${found}/${req}`,
    correctPages: `${pagesOk}/${found}`,
    falseAlarms: `${out.falseAlarms.length}/${truth.not_specified.length}`,
    keyDates: `${Object.values(out.dates).filter(Boolean).length}/3`,
    clarificationTraps: `${Object.values(out.traps).filter(Boolean).length}/2`,
  };
  return out;
}
