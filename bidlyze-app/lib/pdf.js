// Serverless-compatible PDF text extraction using unpdf (no DOM dependencies).
import { extractText } from "unpdf";

export async function extractPdfText(buffer) {
  const { text } = await extractText(new Uint8Array(buffer));
  return text;
}
