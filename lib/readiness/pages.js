// Page-aware text extraction for the Tender Readiness engine.
//
// Every piece of text the AI sees carries a [F<file> P<page>] marker so it can
// cite exactly where a requirement came from, and so lib/readiness/verify.js
// can check that each quoted sentence really is on the cited page.
//
// PDFs keep their real page numbers. DOCX/TXT have no pages, so they are split
// into ~3,500-character "sections" (S1, S2, ...). XLSX is one section per sheet.

const CT_PDF = "application/pdf";
const CT_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const CT_TXT = "text/plain";
const CT_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const SECTION_CHARS = 3500;

// A PDF page with fewer than this many characters is probably a scanned image.
const SCANNED_PAGE_CHARS = 40;

function splitIntoSections(text) {
  const out = [];
  const paragraphs = text.split(/\n{2,}/);
  let buf = "";
  for (const p of paragraphs) {
    if (buf.length + p.length > SECTION_CHARS && buf.length > 0) {
      out.push(buf);
      buf = "";
    }
    buf += (buf ? "\n\n" : "") + p;
    while (buf.length > SECTION_CHARS * 2) {
      out.push(buf.slice(0, SECTION_CHARS));
      buf = buf.slice(SECTION_CHARS);
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

async function pdfPages(buffer) {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer), { mergePages: false });
  const texts = Array.isArray(result.text) ? result.text : [String(result.text || "")];
  return texts.map((t, i) => ({ unit: "page", n: i + 1, text: t || "" }));
}

async function docxPages(buffer) {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  return splitIntoSections(value || "").map((t, i) => ({ unit: "section", n: i + 1, text: t }));
}

async function xlsxPages(buffer) {
  const mod = await import("xlsx");
  const XLSX = mod.default || mod;
  const wb = XLSX.read(buffer, { type: "buffer" });
  return wb.SheetNames.map((name, i) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    return { unit: "sheet", n: i + 1, label: name, text: csv.slice(0, 50_000) };
  });
}

/**
 * Extract a file into numbered pages/sections.
 * @returns {Promise<{pages: Array<{unit,n,text,label?}>, scannedPages: number[]}>}
 */
export async function extractPages({ buffer, contentType }) {
  let pages;
  switch (contentType) {
    case CT_PDF: pages = await pdfPages(buffer); break;
    case CT_DOCX: pages = await docxPages(buffer); break;
    case CT_XLSX: pages = await xlsxPages(buffer); break;
    case CT_TXT:
      pages = splitIntoSections(buffer.toString("utf-8")).map((t, i) => ({ unit: "section", n: i + 1, text: t }));
      break;
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }
  const scannedPages = contentType === CT_PDF
    ? pages.filter((p) => p.text.replace(/\s/g, "").length < SCANNED_PAGE_CHARS).map((p) => p.n)
    : [];
  return { pages, scannedPages };
}

/** Human label for a location, e.g. "p.12", "§3", "sheet 'BOQ'". */
export function locationLabel(page) {
  if (!page) return "";
  if (page.unit === "page") return `p.${page.n}`;
  if (page.unit === "sheet") return `sheet '${page.label || page.n}'`;
  return `§${page.n}`;
}

/**
 * Build the single marked-up document string the AI reads.
 * Files are ordered primary-first. Text beyond maxChars is dropped and the
 * dropped locations are reported so the report can say what was NOT read.
 *
 * @param {Array<{fileIndex,filename,role,pages}>} files
 */
export function buildMarkedDocument(files, maxChars) {
  const parts = [];
  const skipped = [];
  let used = 0;

  for (const f of files) {
    parts.push(`\n===== FILE F${f.fileIndex}: ${f.filename} (${f.role}) =====\n`);
    for (const p of f.pages) {
      const body = p.text.trim();
      if (!body) continue;
      const block = `\n[F${f.fileIndex} P${p.n}]\n${body}\n`;
      if (used + block.length > maxChars) {
        skipped.push(`F${f.fileIndex} ${locationLabel(p)}`);
        continue;
      }
      parts.push(block);
      used += block.length;
    }
  }
  return { text: parts.join(""), chars: used, skipped };
}
