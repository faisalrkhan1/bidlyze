// Regression: do the new requirement types (optional, recommendation,
// submission, scored criteria, returnable documents) hide any real issue?
//
// Replays the AI verdicts recorded in every earlier live run (ECTA known-answer
// test x4, Alton answer-key runs x8, the Alton chained demo run) through the
// old grouping and the new type-aware grouping. No AI, no network.
//
// "Flagged" = the item is NOT shown as OK (it is either "Needs attention" or
// "Check manually"). An issue may move from "Needs attention" to "Check
// manually" only when it is a returnable document not found in the upload or a
// submission step; it must never become "OK".

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { classifyRequirement, documentName, prepareRequirements } from "../../lib/submission/obligations.js";
import { requirementsFromAnalysis } from "../../lib/submission/fromAnalysis.js";
import { groupOf, STATUS } from "../../lib/submission/review.js";

const RUNS = new URL("./alton-cctv-2026/runs/", import.meta.url);
const altonKey = JSON.parse(readFileSync(new URL("./alton-cctv-2026/answer_key.json", import.meta.url)));
const ectaKey = JSON.parse(readFileSync(new URL("../e2e/submission_truth.json", import.meta.url)));
const ISSUE = new Set(["partial", "missing", "conflict"]);

function statusesFromRun(run, key) {
  const got = Object.fromEntries(key.requirements.map((r) => [r.id, r.expected]));
  const wrong = run.wrong ?? run.final?.wrong ?? [];
  for (const w of Array.isArray(wrong) ? wrong : []) {
    const m = String(w).match(/^(\w+): expected (\w+), got (\w+)/);
    if (m) got[m[1]] = m[3];
  }
  return got;
}

function item(req, status) {
  const t = classifyRequirement(req);
  const doc = t.type === "mandatory" || t.type === "conditional" ? documentName(req) : null;
  return {
    id: req.id,
    status,
    evidence: status === "missing" ? [] : [{ status: "verified", file: "R1", page: 1 }],
    type: t.excluded ? "evaluation" : t.type,
    ...(doc ? { document: { name: doc } } : {}),
  };
}
const oldGroup = (status) => (STATUS[status] ? STATUS[status].group : "attention");

function compare(key, runs) {
  const out = { runs: runs.length, issues: 0, flaggedBefore: 0, flaggedAfter: 0, movedToManual: new Set(), falseAlarmsBefore: 0, falseAlarmsAfter: 0 };
  for (const run of runs) {
    const got = statusesFromRun(run, key);
    for (const r of key.requirements) {
      const it = item(r, got[r.id]);
      const before = oldGroup(got[r.id]);
      const after = groupOf(it);
      if (ISSUE.has(r.expected)) {
        out.issues += 1;
        if (before !== "ok") out.flaggedBefore += 1;
        if (after !== "ok") out.flaggedAfter += 1;
        if (before === "attention" && after === "manual") out.movedToManual.add(`${r.id} (${it.document ? `document: ${it.document.name}` : it.type})`);
      } else if (r.expected === "answered") {
        if (before === "attention") out.falseAlarmsBefore += 1;
        if (after === "attention") out.falseAlarmsAfter += 1;
      }
    }
  }
  return out;
}

const runsOf = (pred) =>
  readdirSync(RUNS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(new URL(f, RUNS))))
    .filter(pred);

test("Alton answer-key runs: no issue lost; only a document with no evidence moves to 'Check manually'", () => {
  const runs = runsOf((r) => r.mode === "bench-submission");
  assert.equal(runs.length, 8);
  const c = compare(altonKey, runs);
  assert.equal(c.flaggedAfter, c.flaggedBefore, "issues still flagged");
  assert.equal(c.flaggedAfter, c.issues, "19/19 issues flagged in all 8 runs");
  // sc-run3: the code's echo gate turned A34 (price schedule) into "missing". With no evidence in the
  // uploaded file it is now "Not in uploaded file: confirm" (High priority) instead of a proven violation.
  assert.deepEqual([...c.movedToManual], ["A34 (document: Price schedule)"]);
  assert.ok(c.falseAlarmsAfter <= c.falseAlarmsBefore);
});

test("ECTA runs: no issue lost; only documents not in the upload move to 'Check manually'", () => {
  const runs = runsOf((r) => /ECTA/.test(String(r.mode)));
  assert.equal(runs.length, 4);
  const c = compare(ectaKey, runs);
  assert.equal(c.flaggedAfter, c.flaggedBefore);
  assert.equal(c.flaggedAfter, c.issues, "12/12 issues flagged in every run");
  assert.deepEqual([...c.movedToManual].sort(), ["Q06 (document: In-Country Value (ICV) certificate)", "Q17 (document: Compliance statement)"]);
  assert.ok(c.falseAlarmsAfter <= c.falseAlarmsBefore);
});

test("Alton chained demo run (Tender Intelligence requirements): every answer-key issue is still flagged", () => {
  const rec = JSON.parse(readFileSync(new URL("demo-recorded-result.json", RUNS)));
  const exp = JSON.parse(readFileSync(new URL("ti-run3.expected.json", RUNS)));
  const ti = JSON.parse(readFileSync(new URL("ti-run3.requirements.json", RUNS)));
  const analysisData = { requirements: ti.requirements.map((r) => ({ id: r.id, requirement: r.requirement, citation: { quote: r.quote, page: r.page, fileIndex: 1, status: r.status } })) };
  const { checked, excluded } = prepareRequirements(requirementsFromAnalysis(analysisData).requirements);
  const prepared = new Map(checked.map((r) => [r.id, r]));
  const from = new Map(exp.requirements.map((r) => [r.id, r.from || []]));
  const issuesA = altonKey.requirements.filter((a) => ISSUE.has(a.expected)).map((a) => a.id);

  const flagged = (items, grouping) => {
    const set = new Set();
    for (const it of items) {
      const base = it.id.split(".")[0];
      if (grouping(it) === "ok") continue;
      for (const a of from.get(base) || []) set.add(a);
    }
    return set;
  };
  const before = flagged(rec.items, (it) => oldGroup(it.status));
  const after = flagged(
    rec.items.filter((it) => !excluded.some((e) => e.id === it.id)).map((it) => {
      const p = prepared.get(it.id) || prepared.get(`${it.id}.1`) || {};
      return { ...it, type: p.type, ...(p.document ? { document: p.document } : {}) };
    }),
    groupOf
  );
  const lost = issuesA.filter((a) => before.has(a) && !after.has(a));
  assert.deepEqual(lost, [], "no answer-key issue lost");
  assert.ok(issuesA.filter((a) => after.has(a)).length >= issuesA.filter((a) => before.has(a)).length);
});
