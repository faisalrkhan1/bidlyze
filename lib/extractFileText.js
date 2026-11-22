// Per-content-type text extraction. Reused by single-file and Tender Package
// analysis flows so the extraction logic lives in one place.

import { TEXT_LIMITS } from "@/lib/constants";

const CT_PDF = "application/pdf";
const CT_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const CT_TXT = "text/plain";
const CT_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function extractFromPDF(buffer) {
  const { extractText } = await import("unpdf");
  const data = new Uint8Array(buffer);
  const result = await extractText(data);
  return result.text.join("\n");
}

async function extractFromDOCX(buffer) {
  const mammoth = await import("mammoth");
  const extracted = await mammoth.extractRawText({ buffer });
  return extracted.value || "";
}

function extractFromTXT(buffer) {
  return buffer.toString("utf-8");
}

async function extractFromXLSX(buffer) {
  const { xlsxSheets } = await import("./sheetText.js");
  const sheets = await xlsxSheets(buffer, { maxCharsPerSheet: TEXT_LIMITS.MAX_XLSX_SHEET_CHARS });
  return sheets
    .map((sh) => `--- SHEET: ${sh.name} ---\n${sh.csv}${sh.truncated ? "\n[... sheet truncated ...]" : ""}`)
    .join("\n\n");
}

/**
 * Extract plain text from an uploaded file buffer.
 *
 * @param {object} args
 * @param {Buffer} args.buffer       Raw file bytes
 * @param {string} args.contentType  MIME type (already lowercased + param-stripped)
 * @returns {Promise<string>}        Extracted text. Empty string if nothing extractable.
 * @throws on hard extraction failure so callers can surface a per-file error.
 */
export async function extractFileText({ buffer, contentType }) {
  switch (contentType) {
    case CT_PDF:
      return extractFromPDF(buffer);
    case CT_DOCX:
      return extractFromDOCX(buffer);
    case CT_TXT:
      return extractFromTXT(buffer);
    case CT_XLSX:
      return extractFromXLSX(buffer);
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }
}
