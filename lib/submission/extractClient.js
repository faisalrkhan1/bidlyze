// In-browser text extraction for the tender and the supplier proposal.
//
// Documents are read on the user's own device, and only their page text is
// sent (no file upload, no storage of the files). It uses the same libraries
// and the same section rules as the server (lib/readiness/pages.js), so quotes
// are verified against exactly the text the server would have extracted.
// (Parity is tested in tests/submission/extractParity.test.mjs.)

import { CT_PDF, CT_DOCX, CT_TXT, CT_XLSX, SCANNED_PAGE_CHARS, splitIntoSections } from "../readiness/sections.js";

export const MAX_PROPOSAL_BYTES = 50 * 1024 * 1024;
export const MAX_FILES = 5;
export const ACCEPTED = {
  [CT_PDF]: "PDF",
  [CT_DOCX]: "Word (.docx)",
  [CT_XLSX]: "Excel (.xlsx)",
  [CT_TXT]: "Text",
};
export const ACCEPT_ATTR = ".pdf,.docx,.xlsx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain";
const BY_EXT = { pdf: CT_PDF, docx: CT_DOCX, xlsx: CT_XLSX, txt: CT_TXT };
// Formats people often try that the beta cannot read, with what to do instead.
const UNSUPPORTED_HINT = {
  doc: "Old Word files (.doc) cannot be read. Save it as .docx or PDF and try again.",
  xls: "Old Excel files (.xls) cannot be read. Save it as .xlsx and try again.",
  pptx: "Presentations cannot be read. Save it as PDF and try again.",
  ppt: "Presentations cannot be read. Save it as PDF and try again.",
  zip: "Zip files cannot be read. Unzip it and add the documents one by one (up to 5).",
  rar: "Archives cannot be read. Extract it and add the documents one by one (up to 5).",
  jpg: "Images cannot be read. Add the document as PDF with selectable text (run OCR first if it is a scan).",
  jpeg: "Images cannot be read. Add the document as PDF with selectable text (run OCR first if it is a scan).",
  png: "Images cannot be read. Add the document as PDF with selectable text (run OCR first if it is a scan).",
  msg: "E-mails cannot be read. Save the attachment itself and add that.",
  eml: "E-mails cannot be read. Save the attachment itself and add that.",
};

/** Why a file cannot be read, in plain words (or null if it can). */
export function unsupportedReason(name) {
  const ext = String(name || "").toLowerCase().split(".").pop();
  return UNSUPPORTED_HINT[ext] || `“${name}” is not a supported file. Use PDF, Word (.docx), Excel (.xlsx) or text.`;
}

/** Resolve a usable content type from the browser's type or the extension. */
export function proposalContentType(name, type) {
  if (type && ACCEPTED[type]) return type;
  const ext = String(name || "").toLowerCase().split(".").pop();
  return BY_EXT[ext] || null;
}

export class ExtractionError extends Error {}

/**
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} contentType one of ACCEPTED
 * @returns {Promise<{pages: Array<{unit,n,text}>, scannedPages: number[], chars: number}>}
 */
export async function extractProposalPages(arrayBuffer, contentType) {
  let pages;
  try {
    if (contentType === CT_PDF) {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(arrayBuffer), { mergePages: false });
      const texts = Array.isArray(result.text) ? result.text : [String(result.text || "")];
      pages = texts.map((t, i) => ({ unit: "page", n: i + 1, text: t || "" }));
    } else if (contentType === CT_DOCX) {
      const mod = await import("mammoth/mammoth.browser.js");
      const mammoth = mod.default || mod;
      const { value } = await mammoth.extractRawText({ arrayBuffer });
      pages = splitIntoSections(value || "").map((t, i) => ({ unit: "section", n: i + 1, text: t }));
    } else if (contentType === CT_XLSX) {
      const { xlsxSheets } = await import("../sheetText.js");
      const sheets = await xlsxSheets(arrayBuffer, { maxCharsPerSheet: 50_000 });
      pages = sheets.map((sh, i) => ({ unit: "sheet", n: i + 1, label: sh.name, text: sh.csv }));
    } else if (contentType === CT_TXT) {
      const text = new TextDecoder("utf-8").decode(arrayBuffer);
      pages = splitIntoSections(text).map((t, i) => ({ unit: "section", n: i + 1, text: t }));
    } else {
      throw new ExtractionError("This file type is not supported. Use PDF, Word (.docx), Excel (.xlsx) or text.");
    }
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    const msg = String(e?.message || e);
    if (/password/i.test(msg)) throw new ExtractionError("This file is password-protected. Remove the password and try again.");
    throw new ExtractionError("This file could not be read. It may be damaged, or not really the type its name says.");
  }
  const scannedPages = contentType === CT_PDF
    ? pages.filter((p) => p.text.replace(/\s/g, "").length < SCANNED_PAGE_CHARS).map((p) => p.n)
    : [];
  const chars = pages.reduce((s, p) => s + p.text.trim().length, 0);
  return { pages, scannedPages, chars };
}

/** SHA-256 of the file bytes (hex), using Web Crypto (browser and Node 20+). */
export async function sha256Hex(arrayBuffer) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", arrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fmtSize(bytes) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Read one file the user picked: type and size checks, page text, scanned pages, hash.
 * @returns {Promise<{filename, contentType, size, sha256, pages, scannedPages, chars, objectUrl}>}
 * @throws {ExtractionError} with a message that says what to do
 */
export async function readDocumentFile(file) {
  const contentType = proposalContentType(file.name, file.type);
  if (!contentType) throw new ExtractionError(unsupportedReason(file.name));
  if (file.size === 0) throw new ExtractionError(`“${file.name}” is empty.`);
  if (file.size > MAX_PROPOSAL_BYTES) throw new ExtractionError(`“${file.name}” is ${fmtSize(file.size)}. The beta accepts files up to 50 MB.`);
  const buf = await file.arrayBuffer();
  const [sha256, extracted] = await Promise.all([sha256Hex(buf.slice(0)), extractProposalPages(buf, contentType)]);
  const readableChars = extracted.pages.reduce((s, p) => s + p.text.replace(/\s/g, "").length, 0);
  if (readableChars < 40) {
    throw new ExtractionError(
      contentType === CT_PDF
        ? `No readable text was found in “${file.name}”. It looks like a scanned document: run it through OCR (text recognition) first, then add it again.`
        : `No readable text was found in “${file.name}”.`
    );
  }
  return {
    filename: file.name,
    contentType,
    size: file.size,
    sha256,
    pages: extracted.pages,
    scannedPages: extracted.scannedPages,
    chars: extracted.chars,
    objectUrl: contentType === CT_PDF && typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(file) : null,
  };
}

/** Request id for one paid run: the same id is never charged twice (see lib/submission/quota.js). */
export function newRequestId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Text size of a set of read files, to warn before sending (limit: 600,000 characters). */
export function totalChars(files) {
  return (files || []).reduce((n, f) => n + (f.pages || []).reduce((m, p) => m + p.text.length, 0), 0);
}
