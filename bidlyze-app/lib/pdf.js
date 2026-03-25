// Server-side PDF text extraction using pdf-parse v2.
// v2 is a pure TypeScript rewrite — no DOMMatrix, no canvas, no test worker.
import { PDFParse } from "pdf-parse";

export async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}
