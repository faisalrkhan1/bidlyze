// Exported Submission Check workbook (.xlsx): built with ExcelJS, written to a
// real file buffer and read back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { buildReportWorkbook, actionRows, evidenceRows, reportFileName, DISCLAIMER, DECISION } from "../../lib/submission/report.js";
import { formatTimestamp, formatUtc } from "../../lib/submission/actions.js";

const result = JSON.parse(readFileSync(new URL("../fixtures/submission/ecta-result.json", import.meta.url)));
const reviews = {
  Q01: { reviewed: true, verdict: "agree", note: "Bond to be re-issued at 2%" },
  Q04: { reviewed: true, verdict: "attention", note: "Portal registration receipt missing" },
  Q12: { reviewed: true, verdict: "ok", note: "TDRA approval confirmed by phone" },
};
const NOW = "2026-11-22T06:30:00.000Z";

async function roundTrip(res = result, rev = reviews) {
  const wb = buildReportWorkbook(ExcelJS, res, rev, { timeZone: "Asia/Dubai", now: NOW });
  const buf = await wb.xlsx.writeBuffer();
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(buf);
  return back;
}

const text = (ws) => {
  const out = [];
  ws.eachRow((row) => out.push(row.values.slice(1).map((v) => (v && typeof v === "object" ? v.result ?? v.text ?? JSON.stringify(v) : v ?? "")).join(" | ")));
  return out.join("\n");
};

test("workbook: Summary, Action register, Evidence; headings frozen, filters, wrapped text, Arial", async () => {
  const wb = await roundTrip();
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Summary", "Action register", "Evidence"]);
  for (const [name, reqCol] of [["Action register", 7], ["Evidence", 2]]) {
    const ws = wb.getWorksheet(name);
    const v = ws.views[0];
    assert.equal(v.state, "frozen", `${name} frozen`);
    assert.ok(v.ySplit >= 1 && v.xSplit === 2, `${name} heading + ID columns frozen`);
    assert.ok(ws.autoFilter, `${name} has filters`);
    const c = ws.getRow(v.ySplit + 1).getCell(reqCol);
    assert.equal(c.alignment?.wrapText, true, `${name} wraps text`);
    assert.equal(c.font?.name, "Arial");
    assert.ok(ws.getColumn(reqCol).width >= 30, `${name} readable widths`);
  }
});

test("action register: concise columns, priority order, AI vs team columns, reviewer decisions and final result", async () => {
  const wb = await roundTrip();
  const ws = wb.getWorksheet("Action register");
  const band = ws.getRow(1);
  assert.match(String(band.getCell(1).value), /^BIDLYZE: automated findings/);
  assert.match(String(band.getCell(12).value), /^YOUR TEAM/);
  const head = ws.getRow(2).values.slice(1);
  assert.deepEqual(head, ["#", "Req. ID", "Priority", "Type", "Bidlyze result", "Classification", "Requirement", "Issue found (AI explanation)", "Recommended action", "Tender ref.", "Proposal ref.", "Owner", "Status", "Reviewer decision", "Final result", "Reviewer note"]);
  assert.equal(head.length, 16, "16 columns instead of 26");
  // Team columns look editable (yellow) and have dropdowns.
  assert.equal(ws.getRow(2).getCell(13).fill.fgColor.argb, "FFFACC15");
  assert.equal(ws.getRow(3).getCell(12).fill.fgColor.argb, "FFFEFCE8");
  assert.equal(ws.getRow(3).getCell(13).dataValidation.type, "list");
  assert.match(ws.getRow(3).getCell(14).dataValidation.formulae[0], /Override: OK/);

  const rows = [];
  for (let i = 3; i <= ws.rowCount; i++) rows.push(ws.getRow(i));
  assert.equal(rows.length, 18);
  const pri = rows.map((r) => r.getCell(3).value);
  const order = ["High", "Medium", "Low", "None"];
  assert.deepEqual([...pri].sort((a, b) => order.indexOf(a) - order.indexOf(b)), pri, "sorted by priority");
  const byId = Object.fromEntries(rows.map((r) => [r.getCell(2).value, r]));
  assert.equal(byId.Q01.getCell(14).value, DECISION.agree);
  assert.equal(byId.Q01.getCell(16).value, "Bond to be re-issued at 2%");
  // Overrides: Bidlyze result stays as found; Final result follows the reviewer (live formula).
  assert.equal(byId.Q04.getCell(5).value, "OK");
  assert.equal(byId.Q04.getCell(14).value, DECISION.attention);
  assert.equal(byId.Q04.getCell(15).value.result, "Needs attention");
  assert.match(byId.Q04.getCell(15).value.formula, /^IF\(N\d+="Override: OK"/);
  assert.equal(byId.Q12.getCell(5).value, "Needs attention");
  assert.equal(byId.Q12.getCell(15).value.result, "OK");
  assert.equal(byId.Q09.getCell(14).value, DECISION.none);
  // Returnable document not found → confirm, not a violation.
  assert.equal(byId.Q06.getCell(6).value, "Not in uploaded file");
  assert.equal(byId.Q06.getCell(5).value, "Check manually");
  assert.match(byId.Q06.getCell(9).value, /^Confirm the In-Country Value \(ICV\) certificate is in the submission pack/);
  assert.equal(byId.Q03.getCell(4).value, "Submission process");
  assert.equal(byId.Q13.getCell(13).value, "No action needed");
  assert.equal(byId.Q02.getCell(13).value, "Open");
});

test("evidence sheet: every quote kept in full, both documents, page references", async () => {
  const long = structuredClone(result);
  const q = long.items.find((i) => i.id === "Q07");
  const big = `${"A very long supporting statement. ".repeat(300)}END`;
  q.evidence = [...q.evidence, { quote: big, file: "R1", page: 3, status: "verified" }, { quote: "third quote", file: "R1", page: 5, status: "approximate" }, { quote: "fourth quote", file: "R1", page: 6, status: "unverified" }];
  const wb = await roundTrip(long, {});
  const ws = wb.getWorksheet("Evidence");
  const rows = [];
  for (let i = 2; i <= ws.rowCount; i++) rows.push(ws.getRow(i));
  assert.equal(rows.length, 18);
  const q07 = rows.find((r) => r.getCell(1).value === "Q07");
  const cell = String(q07.getCell(8).value);
  assert.ok(cell.includes(big), "very long quote not truncated");
  assert.match(cell, /\[4\] p\.6: fourth quote/, "more than three quotes kept");
  assert.match(String(q07.getCell(9).value), /\[4\] Not found in the document/);
  const q01 = rows.find((r) => r.getCell(1).value === "Q01");
  assert.match(String(q01.getCell(5).value), /bid bond of 2%/);
  assert.equal(q01.getCell(6).value, "ECTA_test_tender.pdf p.2");
  assert.match(String(q01.getCell(8).value), /\[1\] p\.4: .*bid bond of 1%/);
  const total = long.items.reduce((s, it) => s + (it.evidence || []).length, 0);
  assert.equal(evidenceRows(long).reduce((s, r) => s + r._quotes, 0), total);
});

test("summary: dashboard counts (automated vs after review), timestamps with time zone, documents, disclaimer", async () => {
  const wb = await roundTrip();
  const s = text(wb.getWorksheet("Summary"));
  assert.match(s, /Bidlyze Submission Check: compliance review \(beta\)/);
  assert.match(s, /Needs attention \| 10 \| 10/, "Q04 → attention and Q12 → OK cancel out");
  assert.match(s, /Check manually \| 3 \| 3/);
  assert.match(s, /Reviewed by a person \| 3 of 18/);
  assert.match(s, /Reviewer overrides \| 2/);
  assert.match(s, /Checked \| 22 Nov 2026, 12:00 \(UTC\+04:00, Asia\/Dubai\)  ·  2026-11-22 08:00 UTC/);
  assert.match(s, /Report exported \| 22 Nov 2026, 10:30 \(UTC\+04:00, Asia\/Dubai\)  ·  2026-11-22 06:30 UTC/);
  assert.match(s, /Compliance statement \(Q17\) \| No mention found/);
  assert.match(s, /Suggested priority \| High \d+ · Medium \d+ · Low \d+ · No action \d+/);
  for (const d of DISCLAIMER) assert.ok(s.includes(d), "disclaimer");
  assert.doesNotMatch(s, /fully compliant|(?<!certify that the proposal )is compliant\b/i);
});

test("not-checked sheet lists scoring guidance; file name; timestamp helpers", async () => {
  const withExcluded = { ...result, excluded: [{ id: "R36", requirement: "Exceed minimum requirements", type: "evaluation", reason: "Scoring guidance", tender: { quote: "to achieve the highest scores", page: 6 } }] };
  const wb = await roundTrip(withExcluded, {});
  assert.ok(wb.getWorksheet("Not checked"));
  assert.match(text(wb.getWorksheet("Not checked")), /R36 \| Exceed minimum requirements \| to achieve the highest scores \| p\.6 \| Scoring guidance/);
  assert.equal(reportFileName(result), "Bidlyze_Submission_Check_ECTA_Smart_Parking_Sensors_fictional_tes_2026-11-22.xlsx");
  assert.equal(formatTimestamp("2026-11-22T06:14:00Z", "UTC"), "22 Nov 2026, 06:14 (UTC+00:00)");
  assert.equal(formatTimestamp("2026-11-22T06:14:00Z", "Europe/London"), "22 Nov 2026, 06:14 (UTC+00:00, Europe/London)");
  assert.equal(formatUtc("2026-11-22T06:14:59Z"), "2026-11-22 06:14 UTC");
  assert.equal(formatTimestamp("not a date"), "");
  assert.equal(actionRows(result, {}).filter((r) => r.decision !== DECISION.none).length, 0);
});
