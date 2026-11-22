// Requirement types, duplicates, compound requirements and returnable documents
// (lib/submission/obligations.js) on the real Alton tender analysis and the
// ECTA test tender. No AI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareRequirements, classifyRequirement, documentName, findSeparateMention, resolveOverlaps, splitCompound, coverage } from "../../lib/submission/obligations.js";
import { requirementsFromAnalysis } from "../../lib/submission/fromAnalysis.js";
import { extractPages } from "../../lib/readiness/pages.js";

const ALTON = new URL("../benchmarks/alton-cctv-2026/", import.meta.url);
const ti = JSON.parse(readFileSync(new URL("runs/ti-run3.requirements.json", ALTON)));
const key = JSON.parse(readFileSync(new URL("answer_key.json", ALTON)));
const ecta = JSON.parse(readFileSync(new URL("../e2e/submission_truth.json", import.meta.url)));

function altonPrepared() {
  const analysisData = { requirements: ti.requirements.map((r) => ({ id: r.id, requirement: r.requirement, citation: { quote: r.quote, page: r.page, fileIndex: 1, status: r.status } })) };
  return prepareRequirements(requirementsFromAnalysis(analysisData).requirements);
}

test("Alton: the four reported problems are fixed (R5, R27, R6/R7, R36)", () => {
  const { checked, excluded, prep } = altonPrepared();
  const by = Object.fromEntries(checked.map((r) => [r.id, r]));
  // R5 "Site visit recommended" is advice, not an obligation.
  assert.equal(by.R5.type, "recommendation");
  // R27 "outside the scope … invited to comment" is optional.
  assert.equal(by.R27.type, "optional");
  // R6 no longer repeats R7's retained-camera upgrades; R7 is conditional ("Where existing cameras are to be retained").
  assert.equal(by.R6.requirement, "Recommend cameras that give image quality suitable for the Police and Courts.");
  assert.deepEqual(by.R6.narrowed, [{ part: "include upgrades for any existing cameras retained", checkedUnder: "R7" }]);
  assert.equal(by.R7.type, "conditional");
  assert.deepEqual(prep.narrowed.map((n) => n.id), ["R6"]);
  // R36 (and R34) are scoring guidance: left out of the compliance check.
  assert.deepEqual(excluded.map((e) => e.id), ["R34", "R36"]);
  assert.ok(excluded.every((e) => e.type === "evaluation"));
  assert.ok(!by.R36 && !by.R34);
});

test("Alton: every item gets a type; submission steps, scored criteria and documents are recognised", () => {
  const { checked } = altonPrepared();
  const by = Object.fromEntries(checked.map((r) => [r.id, r]));
  for (const id of ["R28", "R29", "R33", "R37", "R38"]) assert.equal(by[id].type, "submission", id);
  assert.equal(by.R35.type, "evaluation", "scored criterion (key personnel evidence) is checked, not excluded");
  assert.equal(by.R31.document?.name, "Price schedule");
  assert.equal(by.R32.document?.name, "References");
  assert.equal(by.R30.document?.name, "Technical proposal");
  // Qualifications to HOLD are obligations, not documents to hand in.
  assert.equal(by.R24.document, undefined);
  assert.equal(by.R25.document, undefined);
  // "should" in this tender expresses a requirement, not a recommendation.
  assert.equal(by.R15.type, "mandatory");
  assert.equal(by.R23.type, "mandatory", "'in advance of submitting their tender' is not a submission step");
  const mandatory = checked.filter((r) => r.type === "mandatory").length;
  assert.ok(mandatory >= 25, `most items stay mandatory (${mandatory})`);
});

test("Alton: R16 is split into its two obligations, R13 is not (its second sentence depends on the first)", () => {
  const { checked, prep } = altonPrepared();
  assert.deepEqual(prep.split, [{ id: "R16", into: ["R16.1", "R16.2"] }]);
  const r162 = checked.find((r) => r.id === "R16.2");
  assert.equal(r162.requirement, "Testing shall be carried out to ISO standards.");
  assert.equal(r162.tenderQuote, "Testing shall be carried out to ISO standards.");
  assert.equal(r162.splitFrom.id, "R16");
  assert.ok(checked.find((r) => r.id === "R13"), "R13 kept whole");
  assert.equal(checked.length, 38, "39 - 2 excluded + 1 from the split");
});

test("answer keys: no requirement the keys call an issue is typed as optional, recommendation or excluded", () => {
  const issues = [...key.requirements, ...ecta.requirements].filter((r) => r.expected !== "answered");
  for (const r of issues) {
    const t = classifyRequirement(r);
    assert.ok(!t.excluded, `${r.id} must still be checked`);
    assert.ok(!["optional", "recommendation"].includes(t.type), `${r.id} (${r.expected}) typed ${t.type}`);
  }
  assert.equal(classifyRequirement(key.requirements.find((r) => r.id === "A32")).type, "optional");
  assert.equal(classifyRequirement(key.requirements.find((r) => r.id === "A09")).type, "conditional");
});

test("ECTA: documents vs qualifications, eligibility vs submission", () => {
  const by = Object.fromEntries(ecta.requirements.map((r) => [r.id, r]));
  assert.equal(documentName(by.Q01), "Bid bond / tender security");
  assert.equal(documentName(by.Q06), "In-Country Value (ICV) certificate");
  assert.equal(documentName(by.Q17), "Compliance statement");
  assert.equal(documentName(by.Q05), null, "hold a trade licence = qualification");
  assert.equal(documentName(by.Q18), null, "hold ISO certificates = qualification");
  assert.equal(classifyRequirement(by.Q03).type, "submission");
  assert.equal(classifyRequirement(by.Q04).type, "mandatory", "registration before closing is eligibility, not a submission step");
  assert.equal(classifyRequirement(by.Q14).type, "mandatory", "a MANDATORY site visit is an obligation");
});

test("older analyses (no tender quote) are typed from the requirement text and the analysis flags", () => {
  assert.equal(classifyRequirement({ requirement: "Submit the tender by 12:00 on 5 March through the portal" }).type, "submission");
  assert.equal(classifyRequirement({ requirement: "Provide 24/7 support", mandatory: false }).type, "optional");
  assert.equal(classifyRequirement({ requirement: "Bidders are encouraged to propose energy-saving options" }).type, "recommendation");
  assert.equal(classifyRequirement({ requirement: "Provide 24/7 support" }).type, "mandatory");
  assert.equal(classifyRequirement({ requirement: "Late bids", category: "Submission" }).type, "submission");
});

test("duplicates: same tender wording and same requirement → checked once; different aspects of one sentence are kept", () => {
  const q = "All parking sensors shall have an IP68 rating and a minimum battery life of 5 years.";
  const out = resolveOverlaps([
    { id: "A", requirement: "Sensors shall have an IP68 rating", tenderQuote: q },
    { id: "B", requirement: "Sensors shall have an IP68 rating.", tenderQuote: q },
    { id: "C", requirement: "Sensors have a minimum battery life of 5 years", tenderQuote: q },
  ]);
  assert.deepEqual(out.requirements.map((r) => r.id), ["A", "C"]);
  assert.deepEqual(out.merged, [{ kept: "A", removed: "B" }]);
  assert.deepEqual(splitCompound({ id: "X", requirement: "Remedy faults in 3 days incl. weekends", tenderQuote: "All reported faults are to be remedied within three days. Weekends shall not be excluded from this arrangement." }).map((r) => r.id), ["X"]);
  assert.ok(coverage("include upgrades for retained cameras", "Where existing cameras are to be retained, any upgrades to be included.") >= 0.75);
});

test("returnables: the sample proposal's 'Document 2 (Price Schedule)' is found as a separate document", async () => {
  const { pages } = await extractPages({ buffer: readFileSync(new URL("supplier_proposal.pdf", ALTON)), contentType: "application/pdf" });
  const m = findSeparateMention("Price schedule", pages);
  assert.ok(m, "mention found");
  assert.equal(m.page, 1);
  assert.match(m.text, /Document 2 \(Price Schedule\)/);
  assert.equal(findSeparateMention("Bid bond / tender security", pages), null);
});
