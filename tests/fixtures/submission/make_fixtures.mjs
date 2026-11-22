// Builds deterministic fixtures for the Submission Check UI tests, with NO AI:
// the real engine (gates, quote verification) runs against the real ECTA
// test PDFs, with a fake "good reviewer" in place of the AI.
//   node --import ./tests/helpers/register-alias.mjs tests/fixtures/submission/make_fixtures.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { extractPages } from "../../../lib/readiness/pages.js";
import { normaliseResponse, checkProposalAgainstAnalysis } from "../../../lib/submission/service.js";
import { sha256Hex } from "../../../lib/submission/extractClient.js";

const E2E = new URL("../../e2e/", import.meta.url);
const OUT = new URL("./", import.meta.url);
const truth = JSON.parse(readFileSync(new URL("submission_truth.json", E2E)));
const quotes = JSON.parse(readFileSync(new URL("ecta_quotes.json", OUT))).quotes;

export const ECTA_ANALYSIS_ID = "11111111-1111-4111-8111-111111111111";
export const LEGACY_ANALYSIS_ID = "22222222-2222-4222-8222-222222222222";

export function ectaAnalysisRow() {
  return {
    id: ECTA_ANALYSIS_ID,
    user_id: "00000000-0000-4000-8000-000000000001",
    project_name: "ECTA Smart Parking Sensors",
    file_name: "ECTA_test_tender.pdf",
    file_path: "00000000-0000-4000-8000-000000000001/ecta/ECTA_test_tender.pdf",
    created_at: "2026-11-20T10:00:00Z",
    analysis_data: {
      rfxType: "rfp",
      summary: { projectName: "ECTA Smart Parking Sensors (fictional test tender)" },
      requirements: truth.requirements.map((t, i) => ({
        id: t.id,
        category: i % 3 === 0 ? "Financial" : i % 3 === 1 ? "Technical" : "Administrative",
        requirement: t.requirement,
        mandatory: true,
        priority: "HIGH",
        sourceRef: `p.${t.tenderPage}`,
        citation: { quote: t.tenderQuote, page: t.tenderPage, fileIndex: 1, fileName: "ECTA_test_tender.pdf", status: "verified", label: `p.${t.tenderPage}` },
      })),
    },
  };
}

// An analysis saved by the older single-prompt engine: requirements without quotes.
export function legacyAnalysisRow() {
  const r = ectaAnalysisRow();
  return {
    ...r,
    id: LEGACY_ANALYSIS_ID,
    project_name: "Legacy analysis (no citations)",
    created_at: "2026-03-01T10:00:00Z",
    analysis_data: {
      rfxType: "rfp",
      summary: { projectName: "Legacy analysis (no citations)" },
      requirements: r.analysis_data.requirements.map(({ citation, id, ...rest }) => ({ ...rest, sourceRef: citation.label })),
    },
  };
}

async function main() {
  const pdf = readFileSync(new URL("ECTA_test_response.pdf", E2E));
  const { pages, scannedPages } = await extractPages({ buffer: pdf, contentType: "application/pdf" });
  const sha256 = await sha256Hex(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));
  const response = normaliseResponse({ filename: "ECTA_test_response.pdf", contentType: "application/pdf", sha256, pages, scannedPages });

  const fakeRun = async ({ requirements, responseFiles }) => {
    const { runSubmissionCheck } = await import("../../../lib/submission/check.js");
    const real = globalThis.fetch;
    process.env.OPENROUTER_API_KEY ||= "fixture";
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      json: async () => ({
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ results: truth.requirements.map((t) => ({ id: t.id, status: t.expected, evidence: quotes[t.id] ? [{ quote: quotes[t.id][0], file: "R1", page: quotes[t.id][1] }] : [], gap: t.expected === "answered" ? "" : `Fixture: ${t.trap}.` })) }) } }],
        usage: { prompt_tokens: 3000, completion_tokens: 1500, cost: 0 },
      }),
    });
    try {
      return await runSubmissionCheck({ requirements, responseFiles });
    } finally {
      globalThis.fetch = real;
    }
  };
  const row = ectaAnalysisRow();
  const result = await checkProposalAgainstAnalysis({
    analysis: { id: row.id, name: row.analysis_data.summary.projectName, fileName: row.file_name, analysisData: row.analysis_data },
    response,
    run: fakeRun,
  });
  result.checkedAt = "2026-11-22T08:00:00.000Z";
  result.meta.model = "fixture (no AI)";
  writeFileSync(new URL("ecta-analysis.json", OUT), JSON.stringify(row, null, 1));
  writeFileSync(new URL("legacy-analysis.json", OUT), JSON.stringify(legacyAnalysisRow(), null, 1));
  writeFileSync(new URL("ecta-result.json", OUT), JSON.stringify(result, null, 1));
  console.log("fixtures written:", result.items.length, "items", JSON.stringify(result.summary));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) await main();
