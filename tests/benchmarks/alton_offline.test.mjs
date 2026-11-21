// Real-world benchmark (Alton Town Council CCTV tender) — offline checks.
//
// The authentic tender is not stored in this repository (it is fetched by the
// preview self-test); the fictional supplier proposal and the answer key are.
// These tests run without any AI:
//   1. the answer key's response quotes are all on their stated pages, and the
//      terms behind "missing"/"partial" verdicts are really absent;
//   2. the tender side too, when a local cache of the tender exists;
//   3. a fake "perfect reviewer" (the answer key itself) goes through the real
//      Submission Check pipeline: the code gates must not turn any correct
//      verdict into a wrong one (gate false alarms);
//   4. the requirement matcher used to score Tender Intelligence.
// Run: npm test

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import { extractPages } from "../../lib/readiness/pages.js";
import { runSubmissionCheck } from "../../lib/submission/check.js";
import { scoreSubmission } from "../../lib/submission/benchmark.js";
import { validateKey } from "../../lib/benchmarks/validateKey.js";
import { matchRequirements, longestCommonRun } from "../../lib/benchmarks/match.js";

const DIR = new URL("./alton-cctv-2026/", import.meta.url);
const key = JSON.parse(readFileSync(new URL("answer_key.json", DIR)));
const CACHE = new URL(".cache/tender_pages.json", DIR);

let responseFiles;
before(async () => {
  const { pages, scannedPages } = await extractPages({ buffer: readFileSync(new URL("supplier_proposal.pdf", DIR)), contentType: "application/pdf" });
  responseFiles = [{ fileIndex: 1, filename: "supplier_proposal.pdf", role: "primary", pages, scannedPages }];
});

test("answer key: 38 requirements, valid statuses, evidence for every non-missing item", () => {
  assert.equal(key.requirements.length, 38);
  for (const r of key.requirements) {
    assert.ok(["answered", "partial", "conflict", "missing"].includes(r.expected), r.id);
    assert.ok(r.justification && r.tenderQuote, r.id);
    if (r.expected !== "missing") assert.ok(r.responseEvidence.length > 0, `${r.id} needs response evidence`);
  }
});

test("answer key: response quotes on their stated pages; absent terms really absent", () => {
  // Tender side is checked against an empty tender here; only response problems matter.
  const v = validateKey(key, [{ fileIndex: 1, pages: [] }], responseFiles);
  const responseProblems = v.problems.filter((p) => !p.includes("tender quote"));
  assert.deepEqual(responseProblems, []);
  assert.equal(v.responseQuotes, "39/39");
});

test("answer key: tender quotes on their stated pages (needs local tender cache)", { skip: !existsSync(CACHE) && "no local tender cache (the preview self-test checks the live tender)" }, () => {
  const t = JSON.parse(readFileSync(CACHE));
  const v = validateKey(key, [{ fileIndex: 1, pages: t.pages }], responseFiles);
  assert.deepEqual(v.problems, []);
  assert.equal(v.tenderQuotes, "38/38");
});

// ── Perfect reviewer through the real pipeline ──────────────────────────────
const realFetch = globalThis.fetch;
before(() => {
  process.env.OPENROUTER_API_KEY = "test-key";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    const ids = JSON.parse(body.messages[1].content.at(-1).text.split("\n")[1]).map((r) => r.id);
    const results = key.requirements.filter((k) => ids.includes(k.id)).map((k) => ({
      id: k.id,
      status: k.expected,
      evidence: k.responseEvidence.slice(0, 2).map((e) => ({ quote: e.quote, file: "R1", page: e.page })),
      gap: k.expected === "answered" ? "" : k.justification,
    }));
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ results }) }, finish_reason: "stop" }], usage: { prompt_tokens: 9000, completion_tokens: 6000, cost: 0.1 } }) };
  };
});
after(() => { globalThis.fetch = realFetch; });

test("perfect reviewer: code gates keep every correct verdict (no gate false alarms)", async () => {
  const requirements = key.requirements.map((k) => ({ id: k.id, requirement: k.requirement, tenderQuote: k.tenderQuote, tenderFile: "F1", tenderPage: k.tenderPage }));
  const result = await runSubmissionCheck({ requirements, responseFiles, tenderFiles: [] });
  assert.equal(result.success, true, result.error);
  const s = scoreSubmission(key, result);
  assert.deepEqual(s.changedByCode, [], `gates changed correct verdicts: ${s.changedByCode.join("; ")}`);
  assert.equal(s.final.exact, "38/38");
  assert.equal(s.evidence.contradictionsBothSidesCited, "4/4");
});

// ── Matcher ────────────────────────────────────────────────────────────────
test("matcher: finds a paraphrased extracted requirement by its tender quote, rejects unrelated ones", () => {
  assert.equal(longestCommonRun("all reported faults are to be remedied within three days", "Faults are to be remedied within three days."), 8);
  const ti = [
    { id: "R1", requirement: "Contractor must remedy reported faults within 3 days including weekends", citation: { quote: "All reported faults are to be remedied within three days. Weekends shall not be excluded", page: 3 } },
    { id: "R2", requirement: "Provide two references from the last 12 months", citation: { quote: "The names and contact details of two references who have received a similar service in the past 12 months.", page: 4 } },
    { id: "R3", requirement: "Submit by 4:30pm on 14 August 2026", citation: { quote: "Written tenders are to be submitted to the Town Clerk by 4:30pm on Friday 14th August", page: 4 } },
  ];
  const m = matchRequirements(key.requirements, ti);
  assert.equal(m.get("A16")?.tiId, "R1");
  assert.equal(m.get("A35")?.tiId, "R2");
  assert.equal(m.get("A13"), null); // signage: nothing extracted
});
