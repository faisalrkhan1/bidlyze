// Server-side PDF text extraction using pdf-parse v1.
// CRITICAL: import from 'pdf-parse/lib/pdf-parse.js' NOT 'pdf-parse'.
// The default entry point loads a test worker that needs DOMMatrix (missing on Vercel).
// This direct path loads ONLY the parser.
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export async function extractPdfText(buffer) {
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const parsed = await pdfParse(buffer);
  return parsed.text;
}
