// Exported "Submission Check" workbook (.xlsx) for a bid manager.
//
//   Summary          dashboard: counts, review progress, documents, warnings, legend
//   Action register  one row per requirement: priority, type, result, issue,
//                    recommended action + YOUR TEAM columns (owner, status,
//                    reviewer decision, note) and the final result after review
//   Evidence         one row per requirement with every tender and proposal
//                    quote (no truncation), page references, quote checks, the
//                    AI explanation and the code checks
//   Not checked      scoring guidance left out of the compliance check
//
// Columns written by Bidlyze (AI + code) have dark headers; columns for the
// bid team have yellow headers and pale-yellow cells. The reviewer decisions
// made on screen are pre-filled and kept separate from the AI findings.
//
// Built with ExcelJS passed in (browser: dynamic import; Node: tests), from the
// same review/actions helpers as the screen, so the two never disagree.

import { STATUS, GROUPS, QUOTE_CHECK, TYPES, displayStatus, effectiveGroup, groupOf, typeOf, locLabel, sortItems, summarize, headline } from "./review.js";
import { priorityOf, recommendedAction, PRIORITY_ORDER, formatTimestamp, formatUtc } from "./actions.js";

export const DISCLAIMER = [
  "This is an automated review (beta). It does not certify that the proposal is compliant and it can miss or misjudge requirements.",
  "Every finding must be checked by a person against the tender and the proposal before the bid is submitted.",
  "Quotes marked 'Found on this page' were matched word for word in the document by Bidlyze's code; the judgement about whether they meet the requirement was made by AI.",
];

export const DECISION = { none: "Not reviewed", agree: "Agree with Bidlyze", ok: "Override: OK", attention: "Override: needs attention" };
export const TEAM_STATUS = ["Open", "In progress", "Done", "Accepted risk", "Not applicable", "No action needed"];

const FONT = "Arial";
const C = {
  ink: "FF1F2937",
  muted: "FF6B7280",
  aiHead: "FF334155",
  teamHead: "FFFACC15",
  teamCell: "FFFEFCE8",
  band: "FFF1F5F9",
  border: "FFD1D5DB",
  red: "FFDC2626",
  amber: "FFB45309",
  green: "FF047857",
  blue: "FF0369A1",
  redFill: "FFFEE2E2",
  blueFill: "FFE0F2FE",
  greenFill: "FFD1FAE5",
};
const GROUP_FILL = { attention: C.redFill, manual: C.blueFill, ok: C.greenFill };
const GROUP_INK = { attention: C.red, manual: C.blue, ok: C.green };
const PRIORITY_INK = { High: C.red, Medium: C.amber, Low: C.muted, None: C.muted };

export function decisionOf(review) {
  if (!review) return DECISION.none;
  if (review.verdict && DECISION[review.verdict]) return DECISION[review.verdict];
  return review.reviewed ? DECISION.agree : DECISION.none;
}

function units(result) {
  return { R1: result?.response?.unit || "page", F1: "page" };
}

function tenderRef(it) {
  if (it.tender?.page) return `p.${it.tender.page}`;
  return it.sourceRef || "";
}

function proposalRefs(it, u) {
  return [...new Set((it.evidence || []).filter((e) => e.status !== "unverified").map((e) => locLabel(u, e.file, e.page)))].join(", ");
}

function handling(it, u) {
  const out = [];
  if (typeOf(it) !== "mandatory") out.push(`${TYPES[typeOf(it)].label}: ${it.typeReason || TYPES[typeOf(it)].help}`);
  if (it.splitFrom) out.push(`Split from ${it.splitFrom.id} (separate obligations in one tender sentence).`);
  for (const n of it.narrowed || []) out.push(`The part "${n.part}" is checked under ${n.checkedUnder}.`);
  if (it.duplicates?.length) out.push(`Same as ${it.duplicates.join(", ")} in the analysis: checked once.`);
  if (it.document) {
    out.push(
      it.documentMention
        ? `Required document: ${it.document.name}. The proposal refers to it (${locLabel(u, "R1", it.documentMention.page)}: "${it.documentMention.text}"). If it is a separate file, it was not checked: confirm it is in the submission pack.`
        : `Required document: ${it.document.name}. Confirm it is in the submission pack.`
    );
  }
  return out.join("\n");
}

/** Action-register rows (plain data; also used by the tests). Sorted by priority, then most serious first. */
export function actionRows(result, reviews = {}) {
  const u = units(result);
  const sorted = sortItems(result?.items || [], reviews);
  const order = new Map(sorted.map((it, i) => [it.id, i]));
  return [...sorted]
    .sort((a, b) => PRIORITY_ORDER.indexOf(priorityOf(a)) - PRIORITY_ORDER.indexOf(priorityOf(b)) || order.get(a.id) - order.get(b.id))
    .map((it, i) => {
      const r = reviews[it.id];
      const p = priorityOf(it);
      return {
        n: i + 1,
        id: it.id,
        priority: p,
        type: TYPES[typeOf(it)].label,
        bidlyze: GROUPS[groupOf(it)].label,
        classification: STATUS[displayStatus(it)].label,
        requirement: it.requirement || "",
        issue: it.gap || "",
        action: recommendedAction(it, u),
        tenderRef: tenderRef(it),
        proposalRef: proposalRefs(it, u),
        owner: "",
        status: p === "None" ? "No action needed" : "Open",
        decision: decisionOf(r),
        final: GROUPS[effectiveGroup(it, r)].label,
        note: r?.note || "",
        _group: groupOf(it),
        _final: effectiveGroup(it, r),
      };
    });
}

/** Evidence rows: every quote, untruncated. */
export function evidenceRows(result) {
  const u = units(result);
  return (result?.items || []).map((it) => {
    const ev = it.evidence || [];
    return {
      id: it.id,
      requirement: it.requirement || "",
      type: TYPES[typeOf(it)].label,
      classification: STATUS[displayStatus(it)].label,
      tenderQuote: it.tender?.quote || "",
      tenderRef: it.tender?.page ? `${it.tender.fileName ? `${it.tender.fileName} ` : ""}p.${it.tender.page}` : it.sourceRef || "",
      tenderCheck: QUOTE_CHECK[it.tender?.status || "none"]?.label || "",
      proposalQuotes: ev.map((e, i) => `[${i + 1}] ${locLabel(u, e.file, e.page)}: ${e.quote}`).join("\n\n"),
      proposalChecks: ev.map((e, i) => `[${i + 1}] ${QUOTE_CHECK[e.status]?.label || e.status}`).join("\n"),
      explanation: it.gap || "",
      codeChecks: (it.checks || []).filter((c) => c.type !== "evidence").map((c) => `${c.type}: ${c.result}`).join("\n"),
      flags: (it.flags || []).join("\n"),
      handling: handling(it, u),
      _quotes: ev.length,
    };
  });
}

// ── Workbook ────────────────────────────────────────────────────────────────

function styleHeader(cell, team) {
  cell.font = { name: FONT, size: 10, bold: true, color: { argb: team ? C.ink : "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: team ? C.teamHead : C.aiHead } };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  cell.border = { bottom: { style: "thin", color: { argb: C.border } } };
}

function body(cell, { team = false, bold = false, color } = {}) {
  cell.font = { name: FONT, size: 10, bold, color: { argb: color || C.ink } };
  cell.alignment = { vertical: "top", wrapText: true };
  cell.border = { bottom: { style: "hair", color: { argb: C.border } } };
  if (team) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.teamCell } };
}

function table(ws, { columns, rows, bandAi, bandTeam, firstRow = 1 }) {
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));
  let headerRow = firstRow;
  if (bandAi) {
    const aiCols = columns.filter((c) => !c.team).length;
    const band = ws.getRow(firstRow);
    band.getCell(1).value = bandAi;
    ws.mergeCells(firstRow, 1, firstRow, aiCols);
    band.getCell(aiCols + 1).value = bandTeam;
    ws.mergeCells(firstRow, aiCols + 1, firstRow, columns.length);
    for (const [col, team] of [[1, false], [aiCols + 1, true]]) {
      const cell = band.getCell(col);
      cell.font = { name: FONT, size: 9, bold: true, color: { argb: team ? C.ink : "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: team ? C.teamHead : "FF0F172A" } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    }
    band.height = 18;
    headerRow = firstRow + 1;
  }
  const head = ws.getRow(headerRow);
  columns.forEach((c, i) => {
    head.getCell(i + 1).value = c.header;
    styleHeader(head.getCell(i + 1), c.team);
  });
  head.height = 30;
  rows.forEach((r, ri) => {
    const row = ws.getRow(headerRow + 1 + ri);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = c.value ? c.value(r, headerRow + 1 + ri) : r[c.key] ?? "";
      body(cell, { team: c.team, ...(c.style ? c.style(r) : {}) });
    });
  });
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: headerRow, activeCell: `C${headerRow + 1}` }];
  if (rows.length) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + rows.length, column: columns.length } };
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  return headerRow;
}

/**
 * @param {object} ExcelJS  the exceljs module
 * @param {object} result   Submission Check result
 * @param {object} reviews  id -> {reviewed, verdict, note}
 * @param {{timeZone?: string, now?: string}} [opts]
 */
export function buildReportWorkbook(ExcelJS, result, reviews = {}, opts = {}) {
  const tz = opts.timeZone;
  const now = opts.now || new Date().toISOString();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Bidlyze Submission Check (beta)";
  wb.created = new Date(now);

  const items = result?.items || [];
  const s = summarize(items, reviews);
  const auto = summarize(items, {});
  const u = units(result);

  // ── Summary ──
  const sum = wb.addWorksheet("Summary", { properties: { tabColor: { argb: "FF10B981" } } });
  sum.columns = [{ width: 30 }, { width: 22 }, { width: 22 }, { width: 70 }];
  sum.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  let r = 1;
  const put = (a, b = "", opt = {}) => {
    const row = sum.getRow(r++);
    row.getCell(1).value = a;
    row.getCell(2).value = b;
    row.getCell(1).font = { name: FONT, size: opt.size || 10, bold: opt.bold ?? !!b, color: { argb: opt.color || C.ink } };
    row.getCell(2).font = { name: FONT, size: 10, color: { argb: C.ink } };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    if (opt.merge) sum.mergeCells(row.number, 2, row.number, 4);
    return row;
  };
  put("Bidlyze Submission Check: compliance review (beta)", "", { size: 14, bold: true });
  put("Automated review: a person must confirm every finding before the bid is submitted.", "", { color: C.amber, bold: true });
  r++;
  put("Tender", result?.tender?.name || "", { merge: true });
  put("Tender file", result?.tender?.fileName || "", { merge: true });
  put("Proposal file", `${result?.response?.filename || ""} (${result?.response?.pages ?? "?"} ${result?.response?.unit === "page" ? "pages" : "sections"} read)`, { merge: true });
  put(result?.recorded ? "Sample result recorded" : "Checked", `${formatTimestamp(result?.checkedAt, tz)}  ·  ${formatUtc(result?.checkedAt)}`, { merge: true });
  put("Report exported", `${formatTimestamp(now, tz)}  ·  ${formatUtc(now)}`, { merge: true });
  put("AI model", result?.meta?.model || "", { merge: true });
  r++;

  // Result table: Bidlyze vs after review
  const th = sum.getRow(r++);
  ["Result", "Bidlyze (automated)", "After your review", "What it means"].forEach((h, i) => {
    th.getCell(i + 1).value = h;
    styleHeader(th.getCell(i + 1), i === 2);
  });
  for (const g of ["attention", "manual", "ok"]) {
    const row = sum.getRow(r++);
    row.getCell(1).value = GROUPS[g].label;
    row.getCell(2).value = auto.byGroup[g];
    row.getCell(3).value = s.byGroup[g];
    row.getCell(4).value = GROUPS[g].hint;
    [1, 2, 3, 4].forEach((c) => body(row.getCell(c), { bold: c === 1, color: c === 1 ? GROUP_INK[g] : undefined, team: c === 3 }));
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_FILL[g] } };
    [2, 3].forEach((c) => (row.getCell(c).alignment = { horizontal: "center", vertical: "top" }));
  }
  const tot = sum.getRow(r++);
  tot.getCell(1).value = "Requirements checked";
  tot.getCell(2).value = auto.total;
  tot.getCell(3).value = s.total;
  [1, 2, 3].forEach((c) => body(tot.getCell(c), { bold: true }));
  [2, 3].forEach((c) => (tot.getCell(c).alignment = { horizontal: "center", vertical: "top" }));
  r++;
  put("Headline", headline(s), { merge: true });
  put("Reviewed by a person", `${s.reviewed} of ${s.total}`, { merge: true });
  put("Reviewer overrides", String(s.overridden), { merge: true });
  r++;

  const pr = Object.fromEntries(PRIORITY_ORDER.map((p) => [p, 0]));
  for (const it of items) pr[priorityOf(it)] += 1;
  put("Suggested priority", `High ${pr.High} · Medium ${pr.Medium} · Low ${pr.Low} · No action ${pr.None}`, { merge: true });
  put("Classification", Object.entries(STATUS).filter(([k]) => s.byStatus[k]).map(([k, m]) => `${m.label} ${s.byStatus[k]}`).join(" · "), { merge: true });
  put("Requirement type", Object.entries(TYPES).filter(([k]) => s.byType[k]).map(([k, m]) => `${m.label} ${s.byType[k]}`).join(" · "), { merge: true });
  if (result?.excluded?.length) put("Not checked", `${result.excluded.length} scoring/evaluation guidance item(s): see the "Not checked" sheet`, { merge: true });
  const prep = result?.prep || {};
  const adj = [];
  if (prep.split?.length) adj.push(`${prep.split.length} split into separate obligations (${prep.split.map((x) => x.id).join(", ")})`);
  if (prep.narrowed?.length) adj.push(`${prep.narrowed.length} narrowed to avoid double counting (${prep.narrowed.map((x) => x.id).join(", ")})`);
  if (prep.merged?.length) adj.push(`${prep.merged.length} duplicate(s) merged`);
  if (adj.length) put("Requirement list", adj.join("; "), { merge: true });
  r++;

  if (result?.documents?.length) {
    const dh = sum.getRow(r++);
    ["Documents the tender asks for", "What the uploaded proposal says", "Where", "Action"].forEach((h, i) => {
      dh.getCell(i + 1).value = h;
      styleHeader(dh.getCell(i + 1), false);
    });
    const STATE = {
      described: ["Described in the proposal", "Confirm the document itself is in the submission pack and matches what the proposal says."],
      separate: ["Referred to as a separate document", "Confirm it is in the submission pack; its contents were not checked."],
      not_found: ["No mention found", "Confirm it is in the submission pack (it may be a separate file)."],
      not_checked: ["Not checked", "Check it yourself."],
    };
    for (const d of result.documents) {
      const row = sum.getRow(r++);
      row.getCell(1).value = `${d.name} (${d.id})`;
      row.getCell(2).value = STATE[d.state]?.[0] || d.state;
      row.getCell(3).value = [d.evidencePage ? locLabel(u, "R1", d.evidencePage) : "", d.mentionPage && d.mentionPage !== d.evidencePage ? `referred to on ${locLabel(u, "R1", d.mentionPage)}` : ""].filter(Boolean).join("; ");
      row.getCell(4).value = STATE[d.state]?.[1] || "";
      [1, 2, 3, 4].forEach((c) => body(row.getCell(c)));
    }
    r++;
  }

  const warnings = [];
  if (result?.meta?.failedBatches?.length) warnings.push("Some requirements could not be checked because of a processing error; they are listed as 'Not checked'.");
  if (result?.meta?.skipped?.length) warnings.push(`Parts of the proposal were too long to read and were skipped: ${result.meta.skipped.join(", ")}`);
  if (result?.response?.scannedPages?.length) warnings.push(`Pages with no readable text (scanned?): ${result.response.scannedPages.join(", ")}`);
  if (result?.truncated) warnings.push(`The tender has more requirements than the beta checks at once; only the first ${s.total} were checked.`);
  if (result?.legacy) warnings.push("This tender was analysed before page-cited quotes were added, so tender quotes are not available.");
  for (const w of warnings) put("Warning", w, { merge: true, color: C.amber });
  if (warnings.length) r++;

  put("How to use this workbook", "", { bold: true });
  put("Action register", "One row per requirement, highest priority first. Dark columns are Bidlyze's automated findings; yellow columns are for your team (owner, status, decision, notes). 'Final result' follows your decision.", { merge: true, bold: false });
  put("Evidence", "Every tender and proposal quote with its page, Bidlyze's word-for-word quote check, the AI explanation and the code checks.", { merge: true, bold: false });
  put("Priority", "High: mandatory item in conflict or missing, or a required document not found. Medium: partial, unconfirmed or submission steps. Low: optional or recommended items.", { merge: true, bold: false });
  r++;
  put("Important", "", { bold: true, color: C.amber });
  for (const d of DISCLAIMER) put("", d, { merge: true });

  // ── Action register ──
  const ar = wb.addWorksheet("Action register", { properties: { tabColor: { argb: "FFEF4444" } } });
  const rows = actionRows(result, reviews);
  const groupStyle = (key) => (row) => ({ bold: true, color: GROUP_INK[row[key]] });
  const arCols = [
    { key: "n", header: "#", width: 5 },
    { key: "id", header: "Req. ID", width: 8 },
    { key: "priority", header: "Priority", width: 9, style: (x) => ({ bold: x.priority === "High", color: PRIORITY_INK[x.priority] }) },
    { key: "type", header: "Type", width: 15 },
    { key: "bidlyze", header: "Bidlyze result", width: 15, style: groupStyle("_group") },
    { key: "classification", header: "Classification", width: 16 },
    { key: "requirement", header: "Requirement", width: 46 },
    { key: "issue", header: "Issue found (AI explanation)", width: 42 },
    { key: "action", header: "Recommended action", width: 46 },
    { key: "tenderRef", header: "Tender ref.", width: 10 },
    { key: "proposalRef", header: "Proposal ref.", width: 12 },
    { key: "owner", header: "Owner", width: 14, team: true },
    { key: "status", header: "Status", width: 15, team: true },
    { key: "decision", header: "Reviewer decision", width: 22, team: true },
    {
      key: "final",
      header: "Final result",
      width: 16,
      team: true,
      // Follows the reviewer decision column when it is changed in Excel.
      value: (x, rowNo) => ({
        formula: `IF(N${rowNo}="${DECISION.ok}","${GROUPS.ok.label}",IF(N${rowNo}="${DECISION.attention}","${GROUPS.attention.label}",E${rowNo}))`,
        result: x.final,
      }),
      style: groupStyle("_final"),
    },
    { key: "note", header: "Reviewer note", width: 34, team: true },
  ];
  const arHead = table(ar, { columns: arCols, rows, bandAi: "BIDLYZE: automated findings (AI judgement + code checks). Do not edit.", bandTeam: "YOUR TEAM: fill in and update" });
  if (rows.length) {
    const last = arHead + rows.length;
    for (let i = arHead + 1; i <= last; i++) {
      ar.getCell(`M${i}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${TEAM_STATUS.join(",")}"`], showErrorMessage: false };
      ar.getCell(`N${i}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${Object.values(DECISION).join(",")}"`], showErrorMessage: false };
    }
  }

  // ── Evidence ──
  const ev = wb.addWorksheet("Evidence", { properties: { tabColor: { argb: "FF8B5CF6" } } });
  table(ev, {
    columns: [
      { key: "id", header: "Req. ID", width: 8 },
      { key: "requirement", header: "Requirement", width: 40 },
      { key: "type", header: "Type", width: 14 },
      { key: "classification", header: "Classification", width: 15 },
      { key: "tenderQuote", header: "Tender quote", width: 48 },
      { key: "tenderRef", header: "Tender ref.", width: 16 },
      { key: "tenderCheck", header: "Tender quote check", width: 18 },
      { key: "proposalQuotes", header: "Proposal evidence (all quotes)", width: 60 },
      { key: "proposalChecks", header: "Proposal quote checks", width: 22 },
      { key: "explanation", header: "AI explanation", width: 44 },
      { key: "codeChecks", header: "Checked by Bidlyze's code", width: 30 },
      { key: "flags", header: "Notes for the reviewer", width: 36 },
      { key: "handling", header: "How Bidlyze handled this requirement", width: 44 },
    ],
    rows: evidenceRows(result),
  });

  // ── Not checked ──
  if (result?.excluded?.length) {
    const nc = wb.addWorksheet("Not checked", { properties: { tabColor: { argb: "FF94A3B8" } } });
    table(nc, {
      columns: [
        { key: "id", header: "Req. ID", width: 8 },
        { key: "requirement", header: "Item in the analysis", width: 50 },
        { key: "quote", header: "Tender quote", width: 60 },
        { key: "ref", header: "Tender ref.", width: 10 },
        { key: "reason", header: "Why it was not checked", width: 60 },
      ],
      rows: result.excluded.map((e) => ({ id: e.id, requirement: e.requirement, quote: e.tender?.quote || "", ref: e.tender?.page ? `p.${e.tender.page}` : "", reason: e.reason || "" })),
    });
  }
  return wb;
}

export function reportFileName(result) {
  const base = String(result?.tender?.name || "tender").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "tender";
  const d = (result?.checkedAt || new Date().toISOString()).slice(0, 10);
  return `Bidlyze_Submission_Check_${base}_${d}.xlsx`;
}
