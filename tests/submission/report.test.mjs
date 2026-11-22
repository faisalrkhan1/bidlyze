// Exported compliance review report (.xlsx): built and read back with SheetJS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { buildReportWorkbook, findingRows, reportFileName, DISCLAIMER } from "../../lib/submission/report.js";

const result = JSON.parse(readFileSync(new URL("../fixtures/submission/ecta-result.json", import.meta.url)));

test("report: Summary + Findings sheets, both-side evidence, reviewer decisions, disclaimer", () => {
  const reviews = { Q01: { reviewed: true, verdict: "agree", note: "Bond to be re-issued at 2%" }, Q03: { reviewed: true, verdict: "attention", note: "Portal receipt missing" } };
  const wb = buildReportWorkbook(XLSX, result, reviews);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const back = XLSX.read(buf, { type: "buffer" });
  assert.deepEqual(back.SheetNames, ["Summary", "Findings"]);

  const summary = XLSX.utils.sheet_to_json(back.Sheets.Summary, { header: 1 }).map((r) => r.join(" | ")).join("\n");
  assert.match(summary, /Bidlyze Submission Check: compliance review \(beta\)/);
  assert.match(summary, /Needs attention \| 13/, "includes the reviewer override (Q03 -> needs attention)");
  assert.match(summary, /Reviewed by a person \| 2 of 18/);
  for (const d of DISCLAIMER) assert.ok(summary.includes(d), "disclaimer line present");
  assert.doesNotMatch(summary, /fully compliant/i);

  const rows = XLSX.utils.sheet_to_json(back.Sheets.Findings);
  assert.equal(rows.length, 18);
  const cols = Object.keys(rows[0]);
  for (const c of ["Req. ID", "Result", "Classification", "Requirement", "Tender quote", "Tender page", "Tender quote check", "Proposal evidence 1", "Evidence 1 page", "Evidence 1 check", "Explanation (AI)", "Reviewer decision", "Reviewer note"]) {
    assert.ok(cols.includes(c), `column ${c}`);
  }
  assert.equal(rows[0].Result, "Needs attention", "most serious first");
  const q01 = rows.find((r) => r["Req. ID"] === "Q01");
  assert.equal(q01.Classification, "Conflict");
  assert.match(q01["Tender quote"], /bid bond of 2%/);
  assert.equal(q01["Tender page"], "ECTA_test_tender.pdf p.2");
  assert.match(q01["Proposal evidence 1"], /bid bond of 1%/);
  assert.equal(q01["Evidence 1 page"], "p.4");
  assert.equal(q01["Evidence 1 check"], "Found on this page");
  assert.equal(q01["Reviewer note"], "Bond to be re-issued at 2%");
  const q03 = rows.find((r) => r["Req. ID"] === "Q03");
  assert.equal(q03.Result, "Needs attention");
  assert.equal(q03["Automated result"], "OK");
  assert.equal(q03["Reviewer decision"], "Overridden: needs attention");
});

test("report: file name and empty review", () => {
  assert.equal(reportFileName(result), "Bidlyze_Submission_Check_ECTA_Smart_Parking_Sensors_fictional_tes_2026-11-22.xlsx");
  assert.equal(findingRows(result, {}).filter((r) => r.Reviewed === "Yes").length, 0);
});
