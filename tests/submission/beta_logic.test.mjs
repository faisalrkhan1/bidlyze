// Submission Check beta: pure logic (no AI, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { submissionCheckBetaEnabled } from "../../lib/submission/beta.js";
import { requirementsFromAnalysis, MAX_CHECK_REQUIREMENTS } from "../../lib/submission/fromAnalysis.js";
import { STATUS, displayStatus, groupOf, effectiveGroup, summarize, headline, filterItems, sortItems, contradiction, locLabel } from "../../lib/submission/review.js";
import { loadDemoAnalysis } from "../../lib/submission/demo.js";

const FX = new URL("../fixtures/submission/", import.meta.url);
const ecta = JSON.parse(readFileSync(new URL("ecta-analysis.json", FX)));
const legacy = JSON.parse(readFileSync(new URL("legacy-analysis.json", FX)));
const result = JSON.parse(readFileSync(new URL("ecta-result.json", FX)));

test("beta switch: on in preview and development, off in production unless explicitly enabled", () => {
  assert.equal(submissionCheckBetaEnabled({ VERCEL_ENV: "preview" }), true);
  assert.equal(submissionCheckBetaEnabled({}), true, "local development");
  assert.equal(submissionCheckBetaEnabled({ VERCEL_ENV: "production" }), false);
  assert.equal(submissionCheckBetaEnabled({ VERCEL_ENV: "production", SUBMISSION_CHECK_BETA: "on" }), true);
  assert.equal(submissionCheckBetaEnabled({ VERCEL_ENV: "preview", SUBMISSION_CHECK_BETA: "off" }), false);
});

test("requirements from a page-cited (readiness-v2) analysis keep the verified tender quote", () => {
  const r = requirementsFromAnalysis(ecta.analysis_data);
  assert.equal(r.total, 18);
  assert.equal(r.cited, 18);
  assert.equal(r.truncated, false);
  assert.deepEqual(
    { id: r.requirements[0].id, page: r.requirements[0].tenderPage, status: r.requirements[0].tenderCitationStatus, file: r.requirements[0].tenderFile },
    { id: "Q01", page: 2, status: "verified", file: "F1" }
  );
  assert.ok(r.requirements[0].tenderQuote.startsWith("The bidder shall submit"));
});

test("requirements from an older analysis (no citations) still work, without tender quotes", () => {
  const r = requirementsFromAnalysis(legacy.analysis_data);
  assert.equal(r.total, 18);
  assert.equal(r.cited, 0);
  assert.equal(r.requirements[0].id, "R1", "ids are created when the old format has none");
  assert.equal(r.requirements[0].tenderQuote, "");
  assert.equal(r.requirements[0].tenderCitationStatus, "none");
  assert.equal(r.requirements[0].sourceRef, "p.2");
});

test("requirements: empty, malformed, duplicate ids and the 150 cap", () => {
  assert.equal(requirementsFromAnalysis(null).total, 0);
  assert.equal(requirementsFromAnalysis({ requirements: "nope" }).total, 0);
  assert.equal(requirementsFromAnalysis({ requirements: [{ requirement: "  " }, {}] }).total, 0);
  const dup = requirementsFromAnalysis({ requirements: [{ id: "R1", requirement: "a" }, { id: "R1", requirement: "b" }] });
  assert.deepEqual(dup.requirements.map((x) => x.id), ["R1", "R1b"]);
  const many = requirementsFromAnalysis({ requirements: Array.from({ length: 200 }, (_, i) => ({ requirement: `Req ${i}` })) });
  assert.equal(many.requirements.length, MAX_CHECK_REQUIREMENTS);
  assert.equal(many.truncated, true);
});

test("the sample (demo) tender goes through the same adapter as a saved analysis", async () => {
  const demo = await loadDemoAnalysis();
  const r = requirementsFromAnalysis(demo.analysisData);
  assert.equal(r.total, 39);
  assert.equal(r.cited, 39);
});

test("grouping: Needs attention / Check manually / OK, and processing errors are never OK", () => {
  assert.equal(groupOf({ status: "answered" }), "ok");
  for (const s of ["partial", "conflict", "missing", "unproven"]) assert.equal(groupOf({ status: s }), "attention", s);
  assert.equal(groupOf({ status: "manual" }), "manual");
  assert.equal(displayStatus({ status: "unproven", notChecked: true }), "not_checked");
  assert.equal(groupOf({ status: "unproven", notChecked: true }), "attention");
  assert.equal(groupOf({ status: "something-new" }), "attention", "unknown statuses fail safe");
  assert.equal(effectiveGroup({ status: "missing" }, { verdict: "ok" }), "ok", "a reviewer can override");
  assert.equal(effectiveGroup({ status: "answered" }, { verdict: "attention" }), "attention");
  assert.equal(effectiveGroup({ status: "missing" }, { verdict: "agree" }), "attention");
});

test("wording: no screen or report sentence calls a proposal compliant", () => {
  const all = summarize([{ id: "a", status: "answered" }, { id: "b", status: "answered" }]);
  assert.match(headline(all), /not a confirmation of compliance/);
  assert.doesNotMatch(headline(all), /\bis compliant|fully compliant/i);
  const mixed = summarize(result.items);
  assert.equal(headline(mixed), "Of 18 requirements: 12 need attention, 6 OK.");
  for (const s of Object.values(STATUS)) assert.doesNotMatch(`${s.label} ${s.help}`, /\bcompliant\b/i);
});

test("summary counts, reviewed progress and overrides", () => {
  const reviews = { Q01: { reviewed: true, verdict: "agree" }, Q03: { reviewed: true, verdict: "attention" } };
  const s = summarize(result.items, reviews);
  assert.deepEqual(s.byGroup, { attention: 13, manual: 0, ok: 5 });
  assert.equal(s.byStatus.conflict, 4);
  assert.equal(s.reviewed, 2);
  assert.equal(s.overridden, 1);
});

test("filters: group, classification, search (requirement, quotes, explanation) and unreviewed only", () => {
  const items = result.items;
  assert.equal(filterItems(items, { group: "attention" }).length, 12);
  assert.equal(filterItems(items, { group: "ok" }).length, 6);
  assert.equal(filterItems(items, { status: "conflict" }).length, 4);
  assert.deepEqual(filterItems(items, { query: "bid bond" }).map((i) => i.id), ["Q01"]);
  assert.deepEqual(filterItems(items, { query: "gulf sensors" }).map((i) => i.id), ["Q11"], "searches proposal quotes");
  assert.ok(filterItems(items, { query: "BATTERY life" }).some((i) => i.id === "Q10"), "case-insensitive");
  assert.equal(filterItems(items, { query: "zzzz" }).length, 0);
  assert.equal(filterItems(items, { unreviewedOnly: true }, { Q01: { reviewed: true } }).length, 17);
});

test("sorting: most serious first, then manual, then OK", () => {
  const sorted = sortItems(result.items);
  assert.equal(groupOf(sorted[0]), "attention");
  assert.equal(displayStatus(sorted[0]), "conflict");
  assert.equal(groupOf(sorted.at(-1)), "ok");
});

test("contradiction: a conflict with evidence on two different pages shows both statements", () => {
  const item = { status: "conflict", evidence: [{ quote: "31 days", file: "R1", page: 6, status: "verified" }, { quote: "30 days", file: "R1", page: 10, status: "verified" }] };
  assert.equal(contradiction(item).length, 2);
  assert.equal(contradiction({ ...item, status: "partial" }), null);
  assert.equal(contradiction({ status: "conflict", evidence: [item.evidence[0]] }), null);
  assert.equal(contradiction({ status: "conflict", evidence: [item.evidence[0], { ...item.evidence[1], status: "unverified" }] }), null, "an unverified quote is not evidence");
});

test("location labels: pages for PDFs, sections for Word/text", () => {
  assert.equal(locLabel({ R1: "page" }, "R1", 9), "p.9");
  assert.equal(locLabel({ R1: "section" }, "R1", 3), "§3");
  assert.equal(locLabel({}, "F1", 2), "p.2");
  assert.equal(locLabel({}, "F1", null), "");
});
