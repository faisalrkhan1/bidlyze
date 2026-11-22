// Exported "Submission Check — compliance review" workbook (.xlsx).
// Built from the same review.js helpers as the screen, so the export and the
// UI never disagree. Includes the reviewer's decisions and notes.

import { STATUS, GROUPS, QUOTE_CHECK, displayStatus, effectiveGroup, groupOf, locLabel, sortItems, summarize, headline } from "./review.js";

export const DISCLAIMER = [
  "This is an automated review (beta). It does not certify that the proposal is compliant and it can miss or misjudge requirements.",
  "Every finding must be checked by a person against the tender and the proposal before the bid is submitted.",
  "Quotes marked 'Found on this page' were matched word for word in the document by Bidlyze's code; the judgement about whether they meet the requirement was made by AI.",
];

const VERDICT_LABEL = { agree: "Agrees with finding", ok: "Overridden: OK", attention: "Overridden: needs attention" };

function fmtDate(iso) {
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return String(iso || "");
  }
}

/** Rows for the Findings sheet (one per requirement, most serious first). */
export function findingRows(result, reviews = {}) {
  const units = { R1: result?.response?.unit || "page", F1: "page" };
  return sortItems(result?.items || [], reviews).map((it, i) => {
    const r = reviews[it.id] || {};
    const st = displayStatus(it);
    const ev = (it.evidence || []).slice(0, 3);
    const row = {
      "#": i + 1,
      "Req. ID": it.id,
      Category: it.category || "",
      Mandatory: it.mandatory === false ? "No" : "Yes",
      Result: GROUPS[effectiveGroup(it, r)].label,
      "Automated result": GROUPS[groupOf(it)].label,
      Classification: STATUS[st].label,
      Requirement: it.requirement || "",
      "Tender quote": it.tender?.quote || "",
      "Tender page": it.tender?.page ? `${it.tender.fileName ? it.tender.fileName + " " : ""}p.${it.tender.page}` : it.sourceRef || "",
      "Tender quote check": QUOTE_CHECK[it.tender?.status || "none"]?.label || "",
    };
    for (let k = 0; k < 3; k++) {
      const e = ev[k];
      row[`Proposal evidence ${k + 1}`] = e ? e.quote : "";
      row[`Evidence ${k + 1} page`] = e ? locLabel(units, e.file, e.page) : "";
      row[`Evidence ${k + 1} check`] = e ? QUOTE_CHECK[e.status]?.label || e.status : "";
    }
    Object.assign(row, {
      "Explanation (AI)": it.gap || "",
      "Automated checks": (it.checks || []).filter((c) => c.type !== "evidence").map((c) => `${c.type}: ${c.result}`).join("; "),
      "Notes for reviewer": (it.flags || []).join(" "),
      Reviewed: r.reviewed ? "Yes" : "No",
      "Reviewer decision": VERDICT_LABEL[r.verdict] || "",
      "Reviewer note": r.note || "",
    });
    return row;
  });
}

/** Rows for the Summary sheet (two columns). */
export function summaryRows(result, reviews = {}) {
  const s = summarize(result?.items || [], reviews);
  const rows = [
    ["Bidlyze Submission Check: compliance review (beta)", ""],
    ["", ""],
    ["Tender", result?.tender?.name || ""],
    ["Tender file", result?.tender?.fileName || ""],
    ["Proposal file", result?.response?.filename || ""],
    ["Proposal pages read", String(result?.response?.pages ?? "")],
    ["Checked at", fmtDate(result?.checkedAt)],
    ["AI model", result?.meta?.model || ""],
    ["Requirements checked", String(s.total)],
    ["", ""],
    ["Summary", headline(s)],
    ["Needs attention", String(s.byGroup.attention)],
    ["Check manually", String(s.byGroup.manual)],
    ["OK", String(s.byGroup.ok)],
    ["", ""],
  ];
  for (const [k, meta] of Object.entries(STATUS)) rows.push([`  ${meta.label}`, String(s.byStatus[k] || 0)]);
  rows.push(["", ""], ["Reviewed by a person", `${s.reviewed} of ${s.total}`], ["Reviewer overrides", String(s.overridden)], ["", ""]);
  if (result?.meta?.failedBatches?.length) rows.push(["Warning", "Some requirements could not be checked because of a processing error; they are listed as 'Not checked'."]);
  if (result?.meta?.skipped?.length) rows.push(["Warning", `Parts of the proposal were too long to read and were skipped: ${result.meta.skipped.slice(0, 20).join(", ")}`]);
  if (result?.truncated) rows.push(["Warning", `The tender has more requirements than the beta checks at once; only the first ${s.total} were checked.`]);
  if (result?.legacy) rows.push(["Note", "This tender was analysed before page-cited quotes were added, so tender quotes are not available."]);
  rows.push(["", ""], ["Important", ""]);
  for (const d of DISCLAIMER) rows.push(["", d]);
  return rows;
}

/**
 * Build the workbook with the xlsx (SheetJS) module passed in, so it works in
 * the browser (dynamic import) and in Node tests.
 */
export function buildReportWorkbook(XLSX, result, reviews = {}) {
  const wb = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet(summaryRows(result, reviews));
  summary["!cols"] = [{ wch: 28 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, summary, "Summary");

  const rows = findingRows(result, reviews);
  const findings = XLSX.utils.json_to_sheet(rows);
  const widths = { "#": 4, "Req. ID": 8, Category: 14, Mandatory: 10, Result: 16, "Automated result": 16, Classification: 18, Requirement: 60, "Tender quote": 60, "Tender page": 14, "Tender quote check": 22, "Explanation (AI)": 60, "Automated checks": 40, "Notes for reviewer": 50, Reviewed: 9, "Reviewer decision": 24, "Reviewer note": 40 };
  findings["!cols"] = Object.keys(rows[0] || {}).map((k) => ({ wch: widths[k] || (k.startsWith("Proposal evidence") ? 60 : 16) }));
  if (rows.length) findings["!autofilter"] = { ref: findings["!ref"] };
  XLSX.utils.book_append_sheet(wb, findings, "Findings");
  return wb;
}

export function reportFileName(result) {
  const base = String(result?.tender?.name || "tender").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "tender";
  const d = (result?.checkedAt || new Date().toISOString()).slice(0, 10);
  return `Bidlyze_Submission_Check_${base}_${d}.xlsx`;
}
