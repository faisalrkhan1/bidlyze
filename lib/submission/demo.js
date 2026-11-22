// Demo data for the Submission Check beta (preview only): the authentic Alton
// Town Council CCTV tender (fetched from the Council at run time) analysed by
// Tender Intelligence (benchmark run 3), and the fictional supplier proposal.
import { readFile } from "node:fs/promises";
import path from "node:path";

const DIR = "tests/benchmarks/alton-cctv-2026";
export const DEMO_ID = "demo-alton";
export const DEMO_PROPOSAL_FILE = "supplier_proposal.pdf";

/** The demo tender in the same shape as a saved analysis (analysis_data.requirements). */
export async function loadDemoAnalysis(root = process.cwd()) {
  const fx = JSON.parse(await readFile(path.join(root, DIR, "runs", "ti-run3.requirements.json"), "utf8"));
  return {
    id: DEMO_ID,
    name: "Alton Town Council: CCTV review, installation and 3-year maintenance (sample)",
    fileName: "Alton-Town-Council-Invitation-to-Tender-CCTV-system.pdf",
    analysisData: {
      requirements: fx.requirements.map((r) => ({
        id: r.id,
        requirement: r.requirement,
        citation: { quote: r.quote, page: r.page, fileIndex: 1, fileName: "Alton-Town-Council-Invitation-to-Tender-CCTV-system.pdf", status: r.status, label: `p.${r.page}` },
      })),
    },
  };
}

export async function loadDemoProposal(root = process.cwd()) {
  return readFile(path.join(root, DIR, DEMO_PROPOSAL_FILE));
}

/** A recorded live result for the sample proposal (so demos cost nothing). */
export async function loadRecordedDemoResult(root = process.cwd()) {
  try {
    return JSON.parse(await readFile(path.join(root, DIR, "runs", "demo-recorded-result.json"), "utf8"));
  } catch {
    return null;
  }
}
