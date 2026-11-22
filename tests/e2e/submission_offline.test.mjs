// Submission Check prototype — offline tests on the real test PDFs.
//
// Tender:   tests/e2e/ECTA_test_tender.pdf   (fictional, 8 pages)
// Response: tests/e2e/ECTA_test_response.pdf (fictional bid, 6 pages)
// Truth:    tests/e2e/submission_truth.json  (18 requirements: 6 answered,
//           5 partial, 3 missing, 4 conflict — with deliberate traps)
//
// The AI is replaced by three fake reviewers:
//   good          right verdicts, exact quotes
//   overconfident says "answered" to everything — invented quotes, the
//                 requirement copied back, quotes with the wrong value
//   lazy          says "missing" to everything
// The code gates must catch what they can of the overconfident reviewer's
// mistakes on their own, and must never upgrade the lazy reviewer's verdicts.
// Run: npm test

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { extractPages } from "../../lib/readiness/pages.js";
import { buildIndex } from "../../lib/readiness/verify.js";
import { runSubmissionCheck } from "../../lib/submission/check.js";
import { scoreSubmission } from "../../lib/submission/benchmark.js";
import { extractQuantities, extractCodes, isEcho, compareValues, timingConflicts, applyGates } from "../../lib/submission/gates.js";

const HERE = new URL("./", import.meta.url);
const truth = JSON.parse(readFileSync(new URL("submission_truth.json", HERE)));
const requirements = truth.requirements.map((t) => ({
  id: t.id, requirement: t.requirement, tenderQuote: t.tenderQuote, tenderFile: "F1", tenderPage: t.tenderPage,
}));

// ── Exact quotes from the response PDF ──────────────────────────────────────
const Q = (quote, page) => ({ quote, file: "R1", page });
const REAL = {
  Q01: Q("We enclose an unconditional bid bond of 1% of the total bid value, valid for 150 days from the tender closing date.", 4),
  Q02: Q("Our offer remains valid for 90 days from the tender closing date.", 4),
  Q03: Q("This bid is submitted through the Example e-Procurement Portal.", 1),
  Q04: Q("Supplier registration | Registered on the Example e-Procurement Portal on 14 March 2025", 6),
  Q05: Q("Our UAE trade licence No. 123456 covers ICT systems integration and is valid until March 2028.", 2),
  Q07: Q("We provide two completion certificates for smart parking projects delivered in Dubai (2023) and Sharjah (2024)", 2),
  Q08: Q("Audited financial statements for 2023, 2024 and 2025 are provided in Annex 4.", 2),
  Q10: Q("Our PS-200 sensors have a battery life of 3 years under typical traffic.", 3),
  Q11: Q("A Manufacturer Authorisation Letter from our distributor, Gulf Sensors Trading LLC, is attached in Annex 5.", 4),
  Q12: Q("TDRA type approval for the radio units will be obtained within 60 days after delivery.", 3),
  Q13: Q("Our system will integrate with the Authority's existing parking management platform through its REST interface.", 3),
  Q14: Q("Our project manager joined the Authority's compulsory site inspection on 10/12/2026; the attendance sheet is included in Annex 6.", 5),
  Q15: Q("All Annex B forms are signed by our authorised signatory, Mr. A. Rahman.", 5),
  Q16: Q("4.2 Commercial forms are provided in English.", 5),
  Q18: Q("We hold a valid ISO 9001:2015 certificate, provided in Annex 7.", 2),
};
const ECHO_Q09 = Q("All parking sensors shall have an IP68 rating and a minimum battery life of 5 years.", 3);
const FAKE_Q06 = Q("We enclose our valid In-Country Value certificate in Annex 2 of this response.", 2);
const FAKE_Q17 = Q("Our clause-by-clause compliance statement is provided in Section 5 of this response.", 5);

const REVIEWERS = {
  good: () => truth.requirements.map((t) => ({
    id: t.id, status: t.expected, evidence: REAL[t.id] ? [REAL[t.id]] : [], gap: t.expected === "answered" ? "" : t.trap,
  })),
  overconfident: () => truth.requirements.map((t) => ({
    id: t.id, status: "answered",
    evidence: [REAL[t.id] || (t.id === "Q09" ? ECHO_Q09 : t.id === "Q06" ? FAKE_Q06 : FAKE_Q17)],
    gap: "",
  })),
  lazy: () => truth.requirements.map((t) => ({ id: t.id, status: "missing", evidence: [], gap: "not found" })),
};

// ── Fake OpenRouter ─────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
let reviewer = "good";
let calls = [];
before(() => {
  process.env.OPENROUTER_API_KEY = "test-key";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const ids = JSON.parse(body.messages[1].content.at(-1).text.split("\n")[1]).map((r) => r.id);
    const results = REVIEWERS[reviewer]().filter((r) => ids.includes(r.id));
    return {
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ results }) }, finish_reason: "stop" }], usage: { prompt_tokens: 3000, completion_tokens: 2500, cost: 0.03 } }),
    };
  };
});
after(() => { globalThis.fetch = realFetch; });

async function load(name) {
  const { pages, scannedPages } = await extractPages({ buffer: readFileSync(new URL(name, HERE)), contentType: "application/pdf" });
  return [{ fileIndex: 1, filename: name, role: "primary", pages, scannedPages }];
}
async function run(who) {
  reviewer = who;
  calls = [];
  const [tenderFiles, responseFiles] = await Promise.all([load("ECTA_test_tender.pdf"), load("ECTA_test_response.pdf")]);
  const result = await runSubmissionCheck({ requirements, responseFiles, tenderFiles });
  assert.equal(result.success, true, result.error);
  return { result, score: scoreSubmission(truth, result) };
}

// ── Gate unit tests ─────────────────────────────────────────────────────────
test("quantities: numbers, number words, '(3)', units and min/max wording", () => {
  assert.deepEqual(extractQuantities("at least three (3) completion certificates").map((q) => [q.n, q.unit, q.cmp]), [[3, "certificates", ">="]]);
  assert.deepEqual(extractQuantities("a minimum battery life of 5 years").map((q) => [q.n, q.unit, q.cmp]), [[5, "years", ">="]]);
  assert.deepEqual(extractQuantities("bid bond of 2% of the value, valid for 150 days").map((q) => [q.n, q.unit]), [[2, "percent"], [150, "days"]]);
  assert.deepEqual(extractQuantities("response time not to exceed 4 hours").map((q) => [q.n, q.unit, q.cmp]), [[4, "hours", "<="]]);
  assert.deepEqual(extractQuantities("statements for 2023, 2024 and 2025 years"), [], "calendar years are not durations");
});

test("values: below a minimum conflicts; above it is fine; fewer items is a shortfall", () => {
  assert.equal(compareValues("valid for 120 days", "remains valid for 90 days").conflicts.length, 1);
  assert.equal(compareValues("valid for 120 days", "remains valid for 180 days").conflicts.length, 0, "longer validity complies");
  assert.equal(compareValues("not to exceed 4 hours", "within 6 hours").conflicts.length, 1);
  const c = compareValues("at least three certificates", "two certificates");
  assert.equal(c.conflicts.length, 0);
  assert.equal(c.shortfalls.length, 1);
  assert.deepEqual(compareValues("for the last three years", "for 2023, 2024 and 2025").unconfirmed, ["three years"]);
});

test("standard and model numbers are not quantities (found in the live run)", () => {
  assert.deepEqual(extractQuantities("valid ISO 9001 and ISO 27001 certificates"), []);
  assert.deepEqual(extractQuantities("a valid ISO 9001:2015 certificate"), []);
  assert.deepEqual(extractQuantities("ISO/IEC 27001 certificate"), []);
  assert.deepEqual(extractQuantities("at least three (3) ISO-certified projects").map((q) => [q.n, q.unit]), [[3, "projects"]]);
});

test("standards and timing", () => {
  assert.deepEqual(extractCodes("valid ISO 9001 and ISO/IEC 27001 certificates, IP68, Cyber Essentials Plus"), ["ISO 9001", "ISO 27001", "IP68", "Cyber Essentials Plus"]);
  assert.equal(timingConflicts("type approval before delivery", "approval within 60 days after delivery").length, 1);
  assert.equal(timingConflicts("type approval before delivery", "approval obtained before delivery").length, 0);
});

test("echo: copying the requirement is not an answer; a commitment is", () => {
  const req = "All parking sensors shall have an IP68 rating and a minimum battery life of 5 years.";
  assert.equal(isEcho("All parking sensors shall have an IP68 rating and a minimum battery life of 5 years.", req), true);
  assert.equal(isEcho("Our sensors are rated IP68 and we confirm a battery life of 7 years.", req), false);
});

test("gates never upgrade: an AI 'missing' stays missing even with a real quote", async () => {
  const [responseFiles] = await Promise.all([load("ECTA_test_response.pdf")]);
  const g = applyGates(requirements[2], { status: "missing", evidence: [REAL.Q03] }, buildIndex(responseFiles));
  assert.equal(g.status, "missing");
});

// ── Pipeline on the real PDFs ───────────────────────────────────────────────
test("good reviewer: 18/18 exact, every issue flagged, no false alarms, all quotes found on the right page", async () => {
  const { result, score } = await run("good");
  assert.equal(score.final.exact, "18/18");
  assert.equal(score.final.issuesFlagged, "12/12");
  assert.deepEqual(score.final.falseAlarms, []);
  assert.equal(score.evidence.responseQuotesFound, "15/15");
  assert.equal(score.evidence.evidenceOnExpectedPage, "15/15");
  assert.equal(score.evidence.tenderQuotesVerified, "18/18");
  assert.equal(calls[0].provider.data_collection, "deny");
  assert.ok(calls[0].messages[1].content[0].text.startsWith("<bid_response>"));
  assert.equal(result.meta.aiUsage.calls, 1);
});

test("overconfident reviewer: code alone catches 9 of 12 issues the AI missed; the 3 it cannot are named", async () => {
  const { result, score } = await run("overconfident");
  assert.equal(score.aiOnly.issuesFlagged, "0/12", "the AI said everything was answered");
  assert.equal(score.final.issuesFlagged, "9/12");
  const by = Object.fromEntries(result.items.map((i) => [i.id, i.status]));
  // wrong values / timing -> conflict
  for (const id of ["Q01", "Q02", "Q10", "Q12"]) assert.equal(by[id], "conflict", id);
  // fewer certificates, missing ISO 27001 -> partial
  assert.equal(by.Q07, "partial");
  assert.equal(by.Q18, "partial");
  // copied requirement -> missing; invented quotes -> unproven
  assert.equal(by.Q09, "missing");
  assert.equal(by.Q06, "unproven");
  assert.equal(by.Q17, "unproven");
  // Known limit: wrong issuer / no stamp / one language need the AI's judgement.
  assert.deepEqual(score.final.missedIssues.map((m) => m.slice(0, 3)).sort(), ["Q11", "Q15", "Q16"]);
  // and no compliant answer was wrongly flagged
  assert.deepEqual(score.final.falseAlarms, []);
});

test("lazy reviewer: verdicts are never upgraded (6 false alarms, 0 missed issues)", async () => {
  const { score } = await run("lazy");
  assert.equal(score.final.issuesFlagged, "12/12");
  assert.equal(score.final.falseAlarms.length, 6);
});

test("if every AI call fails, the check reports an error instead of a result", async () => {
  const [responseFiles] = await Promise.all([load("ECTA_test_response.pdf")]);
  const saved = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => "down" });
  const r = await runSubmissionCheck({ requirements, responseFiles });
  globalThis.fetch = saved;
  assert.equal(r.success, false);
});

// ── Regression tests for bugs found by the real-world benchmark (Alton) ─────
test("number words are whole words: 'height certificates' is not 'eight certificates'", () => {
  assert.deepEqual(extractQuantities("Hold working at height certificates for operating a cherry picker."), []);
  assert.deepEqual(extractQuantities("we attend site often; someone will call"), []);
  assert.deepEqual(extractQuantities("eight certificates").map((q) => [q.n, q.unit]), [[8, "certificates"]]);
});

test("'within N hours' is a maximum; the nearest min/max word wins", () => {
  assert.deepEqual(extractQuantities("evaluate within 24 hours of the report").map((q) => q.cmp), ["<="]);
  assert.equal(compareValues("Evaluate each reported fault within 24 hours of the report.", "assess the fault within 12 hours").conflicts.length, 0, "a faster promise complies");
  assert.equal(compareValues("Evaluate each reported fault within 24 hours of the report.", "assess the fault within 48 hours").conflicts.length, 1);
  assert.deepEqual(extractQuantities("within 2 weeks of award, provide a minimum of 3 copies").map((q) => [q.n, q.cmp]), [[2, "<="], [3, ">="]]);
  assert.deepEqual(extractQuantities("store at least 31 days of recordings").map((q) => q.cmp), [">="]);
});

test("durations compare across units (72 hours = three days)", () => {
  const ok = compareValues("Remedy all reported faults within three days.", "Faults are remedied within 72 hours of the report");
  assert.deepEqual([ok.conflicts.length, ok.unconfirmed.length], [0, 0]);
  assert.equal(compareValues("Remedy all reported faults within three days.", "remedied within 96 hours").conflicts.length, 1);
  assert.equal(compareValues("a warranty of at least 2 years", "a 36 months warranty").conflicts.length, 0);
});

test("echo: reusing the tender's words is not an echo; copying it is", () => {
  const r31 = "Cover all six contract locations: four High Street positions, the High Street ANPR camera, Market Square, Public Gardens, Jubilee Playing Fields and Anstey Park.";
  assert.equal(isEcho("Street ANPR camera, the Market Square, the Public Gardens, Jubilee Playing Fields and Anstey Park.", r31), false);
  const r34 = "A separate document confirming the total price for the initial installation and annual maintenance contract for a three-year period.";
  assert.equal(isEcho("It covers the initial installation and annual maintenance for Years 1 and 2.", r34), false);
  assert.equal(isEcho("A separate document confirming the total price for the initial installation and annual maintenance contract", r34), true);
});

test("'manual' (submission-process items) is kept, flagged for the user, and never counted as answered", async () => {
  const [responseFiles] = await Promise.all([load("ECTA_test_response.pdf")]);
  const g = applyGates({ id: "X1", requirement: "Seal the tender pack with no supplier markings." }, { status: "manual", evidence: [], gap: "Check the pack is sealed." }, buildIndex(responseFiles));
  assert.equal(g.status, "manual");
  assert.ok(g.flags.some((f) => /Check this yourself/.test(f)));
  const s = scoreSubmission({ requirements: [{ id: "X1", expected: "answered", trap: "" }, { id: "X2", expected: "missing", trap: "" }] }, { items: [{ id: "X1", status: "manual", aiStatus: "manual", evidence: [] }, { id: "X2", status: "manual", aiStatus: "manual", evidence: [] }] });
  assert.deepEqual(s.final.missedIssues, [], "manual is never a silent miss");
  assert.equal(s.final.falseAlarmCount, "1/1", "manual on a real, answered requirement counts against us");
});
