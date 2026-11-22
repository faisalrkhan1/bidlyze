// Read the text of an uploaded .xlsx workbook, sheet by sheet, as CSV.
//
// Uses exceljs (maintained) instead of the SheetJS "xlsx" npm package, whose
// published versions have unfixed prototype-pollution and ReDoS advisories
// (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9). Uploaded workbooks are untrusted,
// so they must not be parsed with a library that has known parser flaws.

function cellText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text || "").join("");
    if ("result" in value) return cellText(value.result); // formula: keep the cached result
    if ("text" in value) return String(value.text ?? ""); // hyperlink
    if ("error" in value) return String(value.error ?? "");
    return "";
  }
  return String(value);
}

function csvField(s) {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 * @param {{ maxCharsPerSheet?: number }} [opts]
 * @returns {Promise<Array<{ name: string, csv: string, truncated: boolean }>>}
 */
export async function xlsxSheets(buffer, { maxCharsPerSheet = 50_000 } = {}) {
  const mod = await import("exceljs");
  const ExcelJS = mod.default || mod;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const out = [];
  wb.eachSheet((ws) => {
    const lines = [];
    let size = 0;
    let truncated = false;
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (truncated) return;
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const line = values.map((v) => csvField(cellText(v).trim())).join(",").replace(/,+$/, "");
      if (!line) return;
      if (size + line.length + 1 > maxCharsPerSheet) {
        truncated = true;
        return;
      }
      lines.push(line);
      size += line.length + 1;
    });
    out.push({ name: ws.name, csv: lines.join("\n"), truncated });
  });
  return out;
}
