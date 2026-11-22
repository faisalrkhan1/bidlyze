// Offline end-to-end test of the Tender Readiness pipeline on the real
// known-answer PDF (ECTA_test_tender.pdf) — everything except the AI model.
//
// The AI is replaced by a fake OpenRouter that answers like a good model
// would, plus four deliberate mistakes the pipeline must catch:
//   1. an invented requirement (quote not in the tender)       -> "unverified"
//   2. a right quote cited on the wrong page                   -> page corrected
//   3. a quote with a changed number (90 days instead of 120)  -> "unverified"
//   4. the requirements answer cut off at the token limit      -> report flags it
//
// It then scores the result with tests/e2e/score.mjs and builds the Excel
// export, reading the file back to check what a customer would receive.
// Run: npm test

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";

import { extractPages } from "../../lib/readiness/pages.js";
import { runReadinessAnalysis, runDisqualificationCheck } from "../../lib/readiness/engine.js";
import { SYSTEM } from "../../lib/readiness/passes.js";
import { score } from "./score.mjs";


/** Read a sheet back as objects keyed by its header row (like sheet_to_json). */
function sheetRows(ws) {
  const header = ws.getRow(1).values.slice(1).map(String);
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const o = {};
    row.values.slice(1).forEach((v, i) => { if (v !== null && v !== undefined && v !== "") o[header[i]] = v; });
    rows.push(o);
  });
  return rows;
}

const HERE = new URL("./", import.meta.url);
const truth = JSON.parse(readFileSync(new URL("ground_truth.json", HERE)));
const cite = (quote, page) => ({ quote, file: "F1", page });

// ── What a good model would answer, with the deliberate mistakes ────────────

const OVERVIEW = {
  summary: {
    projectName: "Supply, Installation and Maintenance of Smart Parking Sensors and Guidance System",
    issuingAuthority: "Example City Transport Authority",
    tenderReference: "ECTA/ICT/2026/014",
    estimatedValue: "Not specified",
    currency: "Not specified",
    submissionDeadline: "15 January 2027 at 14:00 (UAE time)",
    projectDuration: "Not specified",
    location: "Not specified",
    sector: "Smart parking / ITS",
    briefDescription: "Smart parking sensors and guidance system.",
    citation: cite("Supply, Installation and Maintenance of Smart Parking Sensors and Guidance System", 1),
  },
  keyDates: [
    { event: "Site visit", date: "10 December 2026 at 10:00", citation: cite("A mandatory site visit will be held on 10 December 2026 at 10:00.", 5) },
    { event: "Clarification deadline", date: "20 December 2026", citation: cite("All clarification questions must be submitted through the portal no later than 20 December 2026.", 6) },
    // Mistake 2: right quote, wrong page (it is on page 1)
    { event: "Closing", date: "15 January 2027", citation: cite("Tender closing date: 15 January 2027 at 14:00 (UAE time).", 2) },
  ],
  submission: { method: "e-Procurement Portal", envelopes: "Not specified", copies: "Not specified", language: "English / Arabic", bidValidity: "120 days", citation: cite("Bids shall be submitted through the Example e-Procurement Portal only.", 2) },
  evaluationCriteria: [{ criterion: "Technical", weight: "70%", details: "", citation: cite("Evaluation weighting: technical 70%, commercial 30%.", 8) }],
  financialRequirements: {
    bidBond: { text: "2% unconditional, valid 150 days", citation: cite("The bidder shall submit an unconditional bid bond of 2% of the total bid value", 2) },
    performanceBond: { text: "Not specified", citation: null },
    minimumTurnover: { text: "Not specified", citation: null },
    paymentTerms: { text: "30/60/10", citation: cite("Payment terms: 30% on delivery, 60% on commissioning, 10% after the", 7) },
    penalties: { text: "0.1% per day, cap 10%", citation: cite("Liquidated damages of 0.1% of the contract value per day of delay, capped at 10%.", 7) },
  },
};

// Mistake 4: cut off mid-item. Mistake 1: item 3 is invented.
const REQUIREMENTS_CUT =
  JSON.stringify({
    requirements: [
      { category: "Technical", requirement: "Sensors IP68 with 5-year battery", mandatory: true, priority: "HIGH", responseNeeded: "Datasheet", citation: cite("All parking sensors shall have an IP68 rating and a minimum battery life of 5 years.", 4) },
      { category: "Technical", requirement: "Integrate with existing parking platform", mandatory: true, priority: "HIGH", responseNeeded: "Integration approach", citation: cite("The system shall integrate with the Authority's existing parking management platform.", 4) },
      { category: "Technical", requirement: "24/7 Arabic helpdesk", mandatory: true, priority: "MEDIUM", responseNeeded: "Support plan", citation: cite("The bidder shall provide a 24/7 helpdesk staffed by Arabic speakers.", 4) },
      { category: "Documentation", requirement: "Compliance statement", mandatory: true, priority: "HIGH", responseNeeded: "Clause-by-clause statement", citation: cite("The bidder shall submit a clause-by-clause compliance statement.", 6) },
      { category: "Commercial", requirement: "Payment terms", mandatory: true, priority: "MEDIUM", responseNeeded: "Accept terms", citation: cite("Payment terms: 30% on delivery, 60% on commissioning, 10% after the", 7) },
    ],
  }).slice(0, -2) + ',{"category":"Techn';

const DQ_QUOTES = {
  bid_bond: ["The bidder shall submit an unconditional bid bond of 2% of the total bid value", 2],
  bid_validity: ["Offers shall remain valid for 120 days from the tender closing date.", 2],
  submission_format: ["Bids shall be submitted through the Example e-Procurement Portal only.", 2],
  vendor_registration: ["Only suppliers registered on the Example e-Procurement Portal before the closing date may submit a bid.", 2],
  trade_license: ["The bidder shall hold a valid UAE trade licence covering ICT systems integration.", 3],
  icv_certificate: ["Bidders must submit a valid In-Country Value (ICV) certificate.", 3],
  previous_experience: ["The bidder shall provide at least three (3) completion certificates for similar smart parking projects", 3],
  financial_statements: ["Audited financial statements for the last three (3) years shall be submitted.", 3],
  manufacturer_authorization: ["The bidder shall submit a Manufacturer Authorisation Letter (MAL) from the sensor OEM", 4],
  type_approvals: ["All radio equipment shall have TDRA type approval before delivery.", 4],
  // Runs across the page break, with the "Page 5 of 8" footer in between.
  mandatory_site_visit: ["Bidders who do not attend the site visit will be disqualified.", 5],
  clarification_deadline: ["All clarification questions must be submitted through the portal no later than 20 December 2026.", 6],
  stamped_signed_forms: ["All forms in Annex B shall be signed by the authorised signatory and stamped with the company seal.", 6],
  arabic_documents: ["Commercial forms shall be submitted in Arabic and English.", 6],
  deviation_statement: ["Any deviation not declared in the deviation schedule will be treated as full compliance.", 6],
  // Mistake 2 again: it is on page 8, cited as page 7.
  iso_certifications: ["The bidder shall hold valid ISO 9001 and ISO 27001 certificates.", 7],
};

const DISQUALIFICATION = {
  fixed_checks: [
    ...Object.entries(DQ_QUOTES).map(([id, [q, p]]) => ({ id, status: "required", details: id, citation: cite(q, p) })),
    ...truth.not_specified.map((id) => ({ id, status: "not_specified", details: "", citation: null })),
  ],
  dynamic_findings: [
    // Mistake 3: number changed from 120 to 90.
    { title: "Bid validity of 90 days", severity: "high", details: "x", citation: cite("Offers shall remain valid for 90 days from the tender closing date.", 2) },
    { title: "Minimum technical score 70%", severity: "high", details: "x", citation: cite("The minimum technical score to pass is 70%.", 8) },
  ],
  summary: "Several pass/fail items.",
};

const CLARIFICATIONS = {
  clarifications: [
    { question: "Please name the existing parking management platform and its integration interface.", reason: "Scope", priority: "HIGH", citation: cite("The system shall integrate with the Authority's existing parking management platform.", 4) },
    { question: "BOQ item 3.2 says 2,400 sensors but Annex D lists 2,600. Which quantity applies?", reason: "Price", priority: "HIGH", citation: cite("The quantity in BOQ item 3.2 is 2,400 sensors.", 7) },
  ],
};

const DECISION = {
  recommendation: "CONDITIONAL BID",
  score: 62,
  reasoning: "Worth pursuing if prerequisites are in hand.",
  conditions: ["Valid ICV certificate in hand"],
  topActions: [{ action: "Book site visit", deadline: "before 10 December 2026", owner: "Presales" }],
  showstoppers: [],
};

// ── Fake OpenRouter ─────────────────────────────────────────────────────────

const realFetch = globalThis.fetch;
const seen = [];
function reply(content, finish = "stop") {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content }, finish_reason: finish }],
      usage: { prompt_tokens: 5000, completion_tokens: 800, prompt_tokens_details: { cached_tokens: 4000 }, cost: 0.02 },
    }),
  };
}

let tmp;
before(() => {
  process.env.OPENROUTER_API_KEY = "test-key";
  tmp = mkdtempSync(path.join(tmpdir(), "bidlyze-"));
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    const system = body.messages[0].content;
    const task = body.messages[1].content.map((c) => c.text).join("\n");
    seen.push({ provider: body.provider, task: task.slice(0, 60) });
    if (system.startsWith("You are a senior GCC bid manager")) return reply(JSON.stringify(DECISION));
    if (task.includes("could get this bid DISQUALIFIED")) return reply(JSON.stringify(DISQUALIFICATION));
    if (task.includes("Build the compliance matrix")) return reply(REQUIREMENTS_CUT, "length");
    if (task.includes("Draft clarification questions")) return reply(JSON.stringify(CLARIFICATIONS));
    if (task.includes("Extract the tender's key facts")) return reply(JSON.stringify(OVERVIEW));
    throw new Error("unexpected AI call: " + task.slice(0, 80));
  };
});
after(() => {
  globalThis.fetch = realFetch;
  rmSync(tmp, { recursive: true, force: true });
});

async function loadTender() {
  const buffer = readFileSync(new URL("ECTA_test_tender.pdf", HERE));
  const { pages, scannedPages } = await extractPages({ buffer, contentType: "application/pdf" });
  return [{ fileIndex: 1, filename: "ECTA_test_tender.pdf", role: "primary", pages, scannedPages }];
}

let result;
test("pipeline runs end to end on the real PDF", async () => {
  const files = await loadTender();
  assert.equal(files[0].pages.length, 8);
  result = await runReadinessAnalysis({ files, rfxType: "rfp" });
  assert.equal(result.success, true, result.error);
});

test("every AI call asked OpenRouter not to store or train on the tender", () => {
  assert.equal(seen.length, 5);
  for (const s of seen) assert.equal(s.provider?.data_collection, "deny");
});

test("the system prompt tells the model to treat tender text as data, not instructions", () => {
  assert.match(SYSTEM, /untrusted DATA/);
});

test("cut-off requirements answer: complete items kept and the report says the list may be incomplete", () => {
  const d = result.data;
  assert.deepEqual(d.meta.truncatedPasses, ["requirements"]);
  assert.deepEqual(d.meta.failedPasses, []);
  assert.equal(d.requirements.length, 5);
});

test("invented requirement is flagged, not shown as verified", () => {
  const invented = result.data.requirements.find((r) => r.requirement === "24/7 Arabic helpdesk");
  assert.equal(invented.citation.status, "unverified");
  const real = result.data.requirements.filter((r) => r !== invented);
  for (const r of real) assert.notEqual(r.citation.status, "unverified", r.requirement);
});

test("wrong page is corrected: closing date moved to p.1, ISO certificates to p.8", () => {
  const closing = result.data.keyDates.find((k) => k.event === "Closing");
  assert.equal(closing.citation.status, "relocated");
  assert.equal(closing.citation.page, 1);
  const iso = result.disqualification.fixed_checks.find((f) => f.id === "iso_certifications");
  assert.equal(iso.citation_status, "relocated");
  assert.equal(iso.page_reference, "p.8");
});

test("quote with a changed number (90 vs 120 days) is not verified", () => {
  const f = result.disqualification.dynamic_findings.find((x) => x.title.includes("90 days"));
  assert.equal(f.citation_status, "unverified");
});

test("sentence across the page break (with 'Page 5 of 8' footer) verifies", () => {
  const sv = result.disqualification.fixed_checks.find((f) => f.id === "mandatory_site_visit");
  assert.equal(sv.status, "required");
  assert.notEqual(sv.citation_status, "unverified");
});

test("known-answer score: 16/16 required items, correct pages, no false alarms, dates and traps", () => {
  const s = score(truth, result.data, result.disqualification);
  assert.deepEqual(s.summary, {
    disqualificationRecall: "16/16",
    correctPages: "16/16",
    falseAlarms: "0/4",
    keyDates: "3/3",
    clarificationTraps: "2/2",
  });
});

test("AI cost is recorded per analysis", () => {
  const u = result.data.meta.aiUsage;
  assert.equal(u.calls, 5);
  assert.equal(u.promptTokens, 25000);
  assert.equal(u.cachedTokens, 20000);
  assert.ok(Math.abs(u.costUsd - 0.1) < 1e-9);
});

test("stand-alone 'Run check' gives the same cited result as the full analysis", async () => {
  const files = await loadTender();
  const out = await runDisqualificationCheck({ files });
  assert.equal(out.success, true);
  assert.deepEqual(out.record, result.disqualification);
});

test("Excel export: the workbook a customer downloads has the right sheets, rows and source checks", async () => {
  const { buildReadinessSheets, buildMultiSheetWorkbook } = await import("../../app/utils/exportExcel.js");
  const built = await buildMultiSheetWorkbook(buildReadinessSheets({ analysis: result.data, disqualification: result.disqualification }));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await built.xlsx.writeBuffer());
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Summary", "Compliance Matrix", "Disqualification Checks", "Clarifications", "Key Dates"]);

  const matrix = sheetRows(wb.getWorksheet("Compliance Matrix"));
  assert.equal(matrix.length, 5);
  const invented = matrix.find((r) => r.Requirement === "24/7 Arabic helpdesk");
  assert.equal(invented["Source Check"], "NOT FOUND - check");
  assert.ok(matrix.every((r) => r.Source), "every row has a page reference");

  const dq = sheetRows(wb.getWorksheet("Disqualification Checks"));
  assert.equal(dq.length, 20 + 2);
  assert.equal(dq.filter((r) => r["Tender Says"] === "REQUIRED").length, 16 + 2);

  const summary = sheetRows(wb.getWorksheet("Summary"));
  const disclaimer = summary.find((r) => r.Field === "Prepared with");
  assert.match(disclaimer.Value, /verify before submission/);
});
