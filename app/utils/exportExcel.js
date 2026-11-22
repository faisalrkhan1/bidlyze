// Simple table exports for the Tender Intelligence pages.
// Written with exceljs (the SheetJS "xlsx" npm package has unfixed advisories).

const COL_MAX = 50;

async function newWorkbook() {
  const mod = await import("exceljs");
  const ExcelJS = mod.default || mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Bidlyze";
  wb.created = new Date();
  return wb;
}

function addTableSheet(wb, name, data) {
  const keys = Object.keys(data[0] || {});
  const ws = wb.addWorksheet(String(name).replace(/[\\/?*[\]:]/g, " ").substring(0, 31) || "Sheet1");
  ws.columns = keys.map((key) => {
    const maxLen = Math.max(key.length, ...data.map((r) => String(r[key] ?? "").length));
    return { header: key, key, width: Math.min(maxLen + 2, COL_MAX) };
  });
  data.forEach((row) => {
    const clean = {};
    keys.forEach((k) => {
      const v = row[k];
      clean[k] = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : v;
    });
    ws.addRow(clean);
  });
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return ws;
}

async function download(wb, fileName) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Export an array of objects as an Excel file.
 * @param {Object[]} data - Array of row objects
 * @param {string} sheetName - Sheet name
 * @param {string} fileName - Output filename
 */
export async function exportToExcel(data, sheetName = "Sheet1", fileName = "export.xlsx") {
  const wb = await newWorkbook();
  addTableSheet(wb, sheetName, data || []);
  await download(wb, fileName);
}

/**
 * Export multiple sheets as one Excel file.
 * @param {Array<{name: string, data: Object[]}>} sheets
 * @param {string} fileName
 */
export async function exportMultiSheetExcel(sheets, fileName = "export.xlsx") {
  const wb = await newWorkbook();
  sheets.forEach(({ name, data }) => {
    if (!data || data.length === 0) return;
    addTableSheet(wb, name, data);
  });
  if (wb.worksheets.length === 0) addTableSheet(wb, "Sheet1", [{ Note: "No data" }]);
  await download(wb, fileName);
}

/** For tests: build the workbook without downloading it. */
export async function buildMultiSheetWorkbook(sheets) {
  const wb = await newWorkbook();
  sheets.forEach(({ name, data }) => data?.length && addTableSheet(wb, name, data));
  return wb;
}

/**
 * Format comparison matrix for Excel export.
 */
export function formatComparisonForExcel(matrix, submissions) {
  if (!matrix || !submissions) return [];
  return matrix.map((row) => {
    const obj = { Dimension: row.dimension, Category: row.category };
    submissions.forEach((s) => {
      const val = row.values?.find((v) => v.submissionName === s.name);
      obj[s.name] = val ? `${val.value} (${val.rating})` : "—";
    });
    obj.Winner = row.winner || "";
    obj.Notes = row.notes || "";
    return obj;
  });
}

/**
 * Format package summary data for Excel.
 */
export function formatPackageSummaryForExcel(analysis) {
  const sheets = [];

  // Submission Requirements
  if (analysis.submissionRequirements?.length) {
    sheets.push({
      name: "Submission Requirements",
      data: analysis.submissionRequirements.map((r, i) => ({
        "#": i + 1,
        Requirement: r.requirement,
        Source: r.source || "",
        Mandatory: r.mandatory ? "Yes" : "No",
        Format: r.format || "",
        Notes: r.notes || "",
      })),
    });
  }

  // Compliance Matrix
  if (analysis.complianceMatrix?.length) {
    sheets.push({
      name: "Compliance Matrix",
      data: analysis.complianceMatrix.map((r, i) => ({
        "#": i + 1,
        Requirement: r.requirement,
        Source: r.source || "",
        Category: r.category || "",
        Severity: r.severity || "",
        Status: r.status || "Needs Review",
        "Action Needed": r.notes || "",
      })),
    });
  }

  // Risk Flags
  if (analysis.riskFlags?.length) {
    sheets.push({
      name: "Risk Flags",
      data: analysis.riskFlags.map((r, i) => ({
        "#": i + 1,
        Risk: r.risk,
        Severity: r.severity,
        Source: r.source || "",
        Mitigation: r.mitigation || "",
      })),
    });
  }

  // Key Deadlines
  if (analysis.keyDeadlines?.length) {
    sheets.push({
      name: "Key Deadlines",
      data: analysis.keyDeadlines.map((d) => ({
        Event: d.event,
        Date: d.date,
        Source: d.source || "",
      })),
    });
  }

  // Clarification Points
  if (analysis.clarificationPoints?.length) {
    sheets.push({
      name: "Clarification Questions",
      data: analysis.clarificationPoints.map((q, i) => ({
        "#": i + 1,
        Question: q.question,
        Reason: q.reason || "",
        Source: q.source || "",
      })),
    });
  }

  return sheets;
}

const CITATION_LABEL = {
  verified: "Verified",
  relocated: "Verified (page corrected)",
  approximate: "Close match - check",
  unverified: "NOT FOUND - check",
};

/**
 * Tender Readiness workbook (readiness-v2 engine).
 * One file a bid engineer can forward to their manager:
 * Summary · Compliance Matrix · Disqualification Checklist · Clarifications · Key Dates.
 */
export function buildReadinessSheets({ analysis, complianceEdits = {}, disqualification = null }) {
  const s = analysis.summary || {};
  const bid = analysis.bidScore || {};
  const c = analysis.citations || {};
  const sheets = [];

  sheets.push({
    name: "Summary",
    data: [
      { Field: "Project", Value: s.projectName },
      { Field: "Issuing authority", Value: s.issuingAuthority },
      { Field: "Tender reference", Value: s.tenderReference },
      { Field: "Submission deadline", Value: s.submissionDeadline },
      { Field: "Estimated value", Value: [s.currency, s.estimatedValue].filter(Boolean).join(" ") },
      { Field: "Recommendation", Value: bid.recommendation },
      { Field: "Bid attractiveness (0-100)", Value: bid.score ?? "" },
      { Field: "Reasoning", Value: bid.reasoning },
      { Field: "Bid only if", Value: (bid.conditions || []).join("; ") },
      { Field: "Showstoppers", Value: (analysis.readiness?.showstoppers || []).join("; ") || "None identified" },
      { Field: "Disqualification risk", Value: disqualification ? `${disqualification.risk_level} (${disqualification.risk_score}/100)` : "" },
      { Field: "Statements checked against tender text", Value: `${(c.verified || 0) + (c.relocated || 0)} of ${c.total || 0} verified; ${c.approximate || 0} close match; ${c.unverified || 0} not found` },
      { Field: "Prepared with", Value: "Bidlyze Tender Readiness Report - AI-assisted, verify before submission" },
    ],
  });

  sheets.push({
    name: "Compliance Matrix",
    data: (analysis.requirements || []).map((r, i) => {
      const e = complianceEdits[`cm-${i}`] || {};
      return {
        "#": r.id || i + 1,
        Requirement: e.requirement ?? r.requirement,
        Category: e.category ?? r.category,
        Mandatory: r.mandatory ? "Yes" : "No",
        Priority: e.severity ?? r.priority,
        Source: r.sourceRef || "",
        "Tender Text": r.citation?.quote || "",
        "Source Check": CITATION_LABEL[r.citation?.status] || "",
        "What To Submit": e.action ?? r.responseNeeded ?? "",
        "Our Status": e.status ?? "Needs Review",
        Owner: e.owner ?? "",
        Evidence: e.evidence ?? "",
        "Due Date": e.dueDate ?? "",
        Notes: e.notes ?? "",
      };
    }),
  });

  if (disqualification) {
    const statusLabel = { required: "REQUIRED", not_required: "Not required", not_specified: "Not stated - confirm" };
    sheets.push({
      name: "Disqualification Checks",
      data: [
        ...(disqualification.fixed_checks || []).map((f) => ({
          Check: f.label,
          Severity: f.severity,
          "Tender Says": statusLabel[f.status] || f.status,
          Details: f.details || "",
          Source: f.page_reference || "",
          "Tender Text": f.evidence_quote || "",
          "Source Check": CITATION_LABEL[f.citation_status] || "",
        })),
        ...(disqualification.dynamic_findings || []).map((d) => ({
          Check: d.title,
          Severity: d.severity,
          "Tender Says": "REQUIRED",
          Details: d.details || "",
          Source: d.page_reference || "",
          "Tender Text": d.evidence_quote || "",
          "Source Check": CITATION_LABEL[d.citation_status] || "",
        })),
      ],
    });
  }

  sheets.push({
    name: "Clarifications",
    data: (analysis.clarificationQuestions || []).map((q, i) => ({
      "#": i + 1,
      Question: q.question,
      Reason: q.reason,
      Priority: q.priority,
      Source: q.source || "",
      "Tender Text": q.citation?.quote || "",
    })),
  });

  sheets.push({
    name: "Key Dates",
    data: (analysis.keyDates || []).map((d) => ({ Event: d.event, Date: d.date, Source: d.sourceRef || "" })),
  });

  return sheets;
}

export async function exportReadinessWorkbook({ analysis, complianceEdits = {}, disqualification = null, fileName }) {
  await exportMultiSheetExcel(buildReadinessSheets({ analysis, complianceEdits, disqualification }), fileName);
}
