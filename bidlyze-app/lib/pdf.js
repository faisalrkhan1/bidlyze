// Serverless-compatible PDF text extraction using pdf2json.
// pdf2json has its own built-in parser — no pdfjs-dist, no canvas, no DOMMatrix.
import PDFParser from "pdf2json";

export function extractPdfText(buffer) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true);

    parser.on("pdfParser_dataReady", (pdfData) => {
      try {
        const text = pdfData.Pages.map((page) =>
          page.Texts.map((t) =>
            t.R.map((r) => decodeURIComponent(r.T)).join("")
          ).join(" ")
        ).join("\n");
        resolve(text);
      } catch (e) {
        reject(new Error("Failed to extract text from parsed PDF data"));
      }
    });

    parser.on("pdfParser_dataError", (errData) => {
      reject(new Error(errData.parserError || "PDF parsing failed"));
    });

    parser.parseBuffer(buffer);
  });
}
