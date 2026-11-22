// In-browser text extraction for the supplier proposal.
//
// The proposal is read on the user's own device, and only its page text is
// sent for checking (no file upload, no storage). It uses the same libraries
// and the same section rules as the server (lib/readiness/pages.js), so quotes
// are verified against exactly the text the server would have extracted.
// (Parity is tested in tests/submission/extractParity.test.mjs.)

import { CT_PDF, CT_DOCX, CT_TXT, SCANNED_PAGE_CHARS, splitIntoSections } from "../readiness/sections.js";

export const MAX_PROPOSAL_BYTES = 50 * 1024 * 1024;
export const ACCEPTED = {
  [CT_PDF]: "PDF",
  [CT_DOCX]: "Word (.docx)",
  [CT_TXT]: "Text",
};
const BY_EXT = { pdf: CT_PDF, docx: CT_DOCX, txt: CT_TXT };

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
    } else if (contentType === CT_TXT) {
      const text = new TextDecoder("utf-8").decode(arrayBuffer);
      pages = splitIntoSections(text).map((t, i) => ({ unit: "section", n: i + 1, text: t }));
    } else {
      throw new ExtractionError("This file type is not supported. Use a PDF, Word (.docx) or text file.");
    }
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    const msg = String(e?.message || e);
    if (/password/i.test(msg)) throw new ExtractionError("This file is password-protected. Remove the password and try again.");
    throw new ExtractionError("This file could not be read. It may be damaged or not a real PDF/Word file.");
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
