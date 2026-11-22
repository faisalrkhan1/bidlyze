// Shared, dependency-free pieces of page extraction. Used by the server
// (lib/readiness/pages.js) and by in-browser extraction
// (lib/submission/extractClient.js), so both produce identical pages.

export const CT_PDF = "application/pdf";
export const CT_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const CT_TXT = "text/plain";
export const CT_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const SECTION_CHARS = 3500;

// A PDF page with fewer than this many characters is probably a scanned image.
export const SCANNED_PAGE_CHARS = 40;

export function splitIntoSections(text) {
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

/** Human label for a location, e.g. "p.12", "§3", "sheet 'BOQ'". */
export function locationLabel(page) {
  if (!page) return "";
  if (page.unit === "page") return `p.${page.n}`;
  if (page.unit === "sheet") return `sheet '${page.label || page.n}'`;
  return `§${page.n}`;
}
