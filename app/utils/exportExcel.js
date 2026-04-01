import * as XLSX from "xlsx";

/**
 * Export an array of objects as an Excel file.
 * @param {Object[]} data - Array of row objects
 * @param {string} sheetName - Sheet name
 * @param {string} fileName - Output filename
 */
export function exportToExcel(data, sheetName = "Sheet1", fileName = "export.xlsx") {
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map((key) => {
    const maxLen = Math.max(key.length, ...data.map((r) => String(r[key] || "").length));
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

/**
 * Export multiple sheets as one Excel file.
 * @param {Array<{name: string, data: Object[]}>} sheets
 * @param {string} fileName
 */
export function exportMultiSheetExcel(sheets, fileName = "export.xlsx") {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    if (!data || data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const colWidths = Object.keys(data[0] || {}).map((key) => {
      const maxLen = Math.max(key.length, ...data.map((r) => String(r[key] || "").length));
      return { wch: Math.min(maxLen + 2, 50) };
    });
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
  });
  XLSX.writeFile(wb, fileName);
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
