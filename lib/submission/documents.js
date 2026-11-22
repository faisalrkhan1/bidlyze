// Validation of the documents a browser sends for a Submission Check: the tender
// (to extract its requirements) and the supplier proposal (to check). Both are
// sent as page text extracted in the browser; files themselves are never uploaded.
//
// Limits are set by what the AI can read in one pass (600,000 characters, about
// 250 dense pages). Over that, the request is refused with a clear message
// instead of silently skipping pages: a skipped proposal page would turn real
// answers into false "missing" findings, and a skipped tender page would drop
// requirements without anyone noticing.

export const DOC_LIMITS = {
  maxFiles: 5,
  maxPagesPerFile: 1500,
  maxPageChars: 60_000,
  maxTotalChars: 600_000, // = the engine's read limit (lib/readiness/engine.js, lib/submission/check.js)
  minReadableChars: 200, // across all files of the tender or proposal
  minReadableCharsPerFile: 40, // a short price schedule is fine; an empty scan is not
  largeChars: 250_000, // above this, reading takes longer: the UI warns, nothing is refused
};

export const UNITS = ["page", "section", "sheet"];

export class DocumentInputError extends Error {
  constructor(message, status = 400, code = "invalid_document") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const readable = (s) => String(s || "").replace(/\s/g, "").length;

function cleanName(name, fallback) {
  const n = String(name || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200);
  return n || fallback;
}

/**
 * @param {object} body          { files: [...] } or a single legacy file object
 * @param {object} opts
 * @param {"tender"|"proposal"} opts.kind
 * @returns {{ files: Array<{key, fileIndex, filename, role, contentType, sha256, unit, pages, scannedPages, chars}>, totalChars: number, scannedPages: number, large: boolean }}
 */
export function normaliseDocuments(body, { kind }) {
  const label = kind === "tender" ? "tender" : "proposal";
  const prefix = kind === "tender" ? "F" : "R";
  const list = Array.isArray(body?.files) ? body.files : body && typeof body === "object" && Array.isArray(body.pages) ? [body] : null;
  if (!list || list.length === 0) throw new DocumentInputError(`No ${label} file was sent.`);
  if (list.length > DOC_LIMITS.maxFiles) {
    throw new DocumentInputError(`Add at most ${DOC_LIMITS.maxFiles} ${label} files per check.`, 413, "too_many_files");
  }

  let totalChars = 0;
  let totalScanned = 0;
  let totalReadable = 0;
  const files = list.map((f, i) => {
    const filename = cleanName(f?.filename, `${label}-${i + 1}`);
    const pagesIn = Array.isArray(f?.pages) ? f.pages : [];
    if (pagesIn.length === 0) throw new DocumentInputError(`“${filename}” has no pages.`, 400, "empty_file");
    if (pagesIn.length > DOC_LIMITS.maxPagesPerFile) {
      throw new DocumentInputError(`“${filename}” has more than ${DOC_LIMITS.maxPagesPerFile} pages. Upload only the parts the check needs.`, 413, "too_many_pages");
    }
    let chars = 0;
    const pages = pagesIn.map((p, j) => {
      const text = typeof p?.text === "string" ? p.text.slice(0, DOC_LIMITS.maxPageChars) : "";
      chars += text.length;
      return {
        unit: UNITS.includes(p?.unit) ? p.unit : "page",
        n: Number.isInteger(p?.n) && p.n > 0 ? p.n : j + 1,
        ...(typeof p?.label === "string" && p.label ? { label: p.label.slice(0, 80) } : {}),
        text,
      };
    });
    const fileReadable = pages.reduce((s, p) => s + readable(p.text), 0);
    totalReadable += fileReadable;
    if (fileReadable < DOC_LIMITS.minReadableCharsPerFile) {
      throw new DocumentInputError(
        `No readable text was found in “${filename}”. If it is a scanned document, run it through OCR (text recognition) first, or remove it.`,
        422,
        "no_text"
      );
    }
    totalChars += chars;
    const scannedPages = Array.isArray(f?.scannedPages) ? f.scannedPages.filter(Number.isInteger).slice(0, DOC_LIMITS.maxPagesPerFile) : [];
    totalScanned += scannedPages.length;
    return {
      key: `${prefix}${i + 1}`,
      fileIndex: i + 1,
      filename,
      role: i === 0 ? "primary" : "annex",
      contentType: String(f?.contentType || "").slice(0, 120),
      sha256: /^[0-9a-f]{64}$/.test(String(f?.sha256 || "")) ? f.sha256 : null,
      unit: pages[0].unit,
      pages,
      scannedPages,
      chars,
    };
  });

  if (totalReadable < DOC_LIMITS.minReadableChars) {
    throw new DocumentInputError(`Too little readable text was found in the ${label} to check it. If it is a scanned document, run it through OCR (text recognition) first.`, 422, "no_text");
  }
  if (totalChars > DOC_LIMITS.maxTotalChars) {
    const approxPages = Math.round(totalChars / 2400);
    throw new DocumentInputError(
      `The ${label} is too long to check in one go: about ${approxPages} pages of text (${Math.round(totalChars / 1000)}k characters; the limit is 600k, about 250 pages). Upload only the parts that matter for the check${kind === "tender" ? " (the requirements, specification and returnables)" : " (for example the technical and compliance sections)"}.`,
      413,
      "too_long"
    );
  }
  return { files, totalChars, scannedPages: totalScanned, large: totalChars > DOC_LIMITS.largeChars };
}
